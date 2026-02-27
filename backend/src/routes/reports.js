const express       = require('express');
const { body, query: qv, param, validationResult } = require('express-validator');
const WeeklyReport  = require('../models/WeeklyReport');
const Project       = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');
const { getWeekKey, getWeekStart, getRetentionCutoff } = require('../utils/weekUtils');

const router = express.Router();
router.use(authenticate);

// ── GET /api/reports  ─────────────────────────────────────────────────────────
// Query params:
//   projectId  — filter by project
//   weekKey    — specific week e.g. "2026-06"
//   from       — ISO date (start of range)
//   to         — ISO date (end of range, defaults to today)
//   months     — shortcut: last N months (1–6, default 1)
//   summary    — if "true", return lean summary only (no deliverables/attrition arrays)
router.get('/', async (req, res) => {
  try {
    const { projectId, weekKey, from, to, months, summary } = req.query;

    // ── Build project filter based on role ────────────────────────────────────
    let allowedProjectIds;

    if (req.user.role === 'pm') {
      // PM sees only their own projects
      const myProjects = await Project.find({ pm: req.user._id }).select('_id');
      allowedProjectIds = myProjects.map(p => p._id);
    } else if (req.user.role === 'exec') {
      // Exec sees all active projects
      const activeProjects = await Project.find({ status: 'active' }).select('_id');
      allowedProjectIds = activeProjects.map(p => p._id);
    }
    // Admin: no project filter

    // ── Build query ───────────────────────────────────────────────────────────
    const filter = {};

    if (projectId) {
      // Validate PM access
      if (req.user.role === 'pm') {
        const owned = allowedProjectIds.map(id => id.toString());
        if (!owned.includes(projectId)) {
          return res.status(403).json({ error: 'Access denied to this project' });
        }
      }
      filter.project = projectId;
    } else if (allowedProjectIds) {
      filter.project = { $in: allowedProjectIds };
    }

    if (weekKey) {
      filter.weekKey = weekKey;
    } else {
      // Date range
      const cutoff = getRetentionCutoff();
      let dateFrom = from ? new Date(from) : cutoff;
      let dateTo   = to   ? new Date(to)   : new Date();

      // Enforce 6-month max
      if (dateFrom < cutoff) dateFrom = cutoff;

      if (months) {
        const n = Math.min(6, Math.max(1, parseInt(months)));
        dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - n);
        if (dateFrom < cutoff) dateFrom = cutoff;
      }

      filter.weekStartDate = { $gte: dateFrom, $lte: dateTo };
    }

    // ── Select fields ─────────────────────────────────────────────────────────
    const projection = summary === 'true'
      ? 'project pm weekKey weekStartDate rag prevRag reasonForRag pathToGreen teamSize submittedAt'
      : undefined;

    const reports = await WeeklyReport.find(filter, projection)
      .populate('project', 'name client type')
      .populate('pm', 'name email')
      .sort({ weekStartDate: -1 })
      .lean();

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/history/:projectId  ──────────────────────────────────────
// Returns up to 6 months of weekly summaries for a single project — used for trend chart
router.get('/history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Role check
    if (req.user.role === 'pm') {
      const proj = await Project.findOne({ _id: projectId, pm: req.user._id });
      if (!proj) return res.status(403).json({ error: 'Access denied' });
    }

    const cutoff = getRetentionCutoff();
    const reports = await WeeklyReport.find({
      project: projectId,
      weekStartDate: { $gte: cutoff },
    })
      .select('weekKey weekStartDate rag prevRag reasonForRag pathToGreen teamSize plannedTeamSize actualTeamSize submittedAt')
      .sort({ weekStartDate: 1 })
      .lean();

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/current-week  ───────────────────────────────────────────
// Returns this week's reports (snapshot for dashboard)
router.get('/current-week', async (req, res) => {
  try {
    const weekKey = getWeekKey(new Date());
    const filter  = { weekKey };

    if (req.user.role === 'pm') {
      const myProjects = await Project.find({ pm: req.user._id, status: 'active' }).select('_id');
      filter.project = { $in: myProjects.map(p => p._id) };
    } else if (req.user.role === 'exec') {
      const active = await Project.find({ status: 'active' }).select('_id');
      filter.project = { $in: active.map(p => p._id) };
    }

    const reports = await WeeklyReport.find(filter)
      .populate('project', 'name client type status')
      .populate('pm', 'name email')
      .sort({ 'project.name': 1 })
      .lean();

    res.json({ weekKey, reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reports  ────────────────────────────────────────────────────────
// PM submits or updates their weekly report (upsert by project + weekKey)
router.post('/', requireRole('pm'), [
  body('projectId').isMongoId(),
  body('rag').isIn(['Red', 'Amber', 'Green']),
  body('reasonForRag').optional().isString(),
  body('pathToGreen').optional().isString(),
  body('teamSize').optional().isString(),
  body('deliverables').optional().isArray(),
  body('attrition').optional().isArray(),
  body('escalations').optional().isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { projectId, rag, reasonForRag, pathToGreen, teamSize, plannedTeamSize, actualTeamSize,
            deliverables, attrition, escalations, overallSummary,
            billingCount, currentBillableCount, yetToBill, buffer } = req.body;

    // Verify PM owns this project
    const project = await Project.findOne({ _id: projectId, pm: req.user._id, status: 'active' });
    if (!project) return res.status(403).json({ error: 'Project not found or access denied' });

    const now     = new Date();
    const weekKey = getWeekKey(now);
    const weekStartDate = getWeekStart(now);

    // Get previous week RAG for trend
    const prevWeek  = new Date(weekStartDate);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevKey   = getWeekKey(prevWeek);
    const prevReport = await WeeklyReport.findOne({ project: projectId, weekKey: prevKey }).lean();
    const prevRag    = prevReport ? prevReport.rag : 'NA';

    const reportData = {
      project: projectId,
      pm: req.user._id,
      weekKey,
      weekStartDate,
      rag,
      prevRag,
      reasonForRag:  reasonForRag  || '',
      pathToGreen:   pathToGreen   || '',
      overallSummary: overallSummary || '',
      teamSize:      teamSize       || '',
      plannedTeamSize: plannedTeamSize || '',
      actualTeamSize: actualTeamSize || '',
      billingCount:  billingCount   || 0,
      currentBillableCount: currentBillableCount || 0,
      yetToBill:     yetToBill      || 0,
      buffer:        buffer         || 0,
      deliverables:  deliverables   || [],
      attrition:     attrition      || [],
      escalations:   escalations    || [],
      lastEditedAt:  now,
    };

    // Upsert: one report per project per week
    const report = await WeeklyReport.findOneAndUpdate(
      { project: projectId, weekKey },
      { $set: reportData, $setOnInsert: { submittedAt: now } },
      { upsert: true, new: true }
    ).populate('project', 'name client').populate('pm', 'name');

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
