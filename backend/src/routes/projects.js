const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/projects  — admin sees all; PM sees own; exec sees active
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'pm')   query = { pm: req.user._id, status: 'active' };
    if (req.user.role === 'exec') query = { status: 'active' };
    // admin sees everything

    const projects = await Project.find(query)
      .populate('pm', 'name email')
      .sort({ name: 1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects  — admin only
router.post('/', requireRole('admin'), [
  body('name').trim().notEmpty(),
  body('client').trim().notEmpty(),
  body('type').optional().isIn(['T & Material', 'Fixed Price', 'Retainer']),
  body('pm').optional().isMongoId(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const project = await Project.create(req.body);
    const populated = await project.populate('pm', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id  — admin only (edit name, client, type, PM, status)
router.patch('/:id', requireRole('admin'), [
  body('name').optional().trim().notEmpty(),
  body('client').optional().trim().notEmpty(),
  body('type').optional().isIn(['T & Material', 'Fixed Price', 'Retainer']),
  body('pm').optional().isMongoId(),
  body('status').optional().isIn(['active', 'closed']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const update = { ...req.body };
    if (update.status === 'closed') update.closedAt = new Date();
    if (update.status === 'active') update.closedAt = null;

    const project = await Project.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('pm', 'name email');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id  — admin only (hard delete — use status=closed normally)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
