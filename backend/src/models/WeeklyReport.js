const mongoose = require('mongoose');

// ── Sub-schemas ──────────────────────────────────────
const deliverableSchema = new mongoose.Schema({
  type:   { type: String, enum: ['Story', 'Hotfix', 'Bug', 'Task', 'Other'], default: 'Task' },
  task:   { type: String, required: true, trim: true },
  owner:  { type: String, trim: true },
  eta:    { type: Date },
  status: { type: String, enum: ['On Track', 'Completed', 'Delayed', 'At Risk'], default: 'On Track' },
  delayReason: { type: String },
}, { _id: false });

const attritionSchema = new mongoose.Schema({
  engineerName:    { type: String, required: true },
  informedToClient: { type: Boolean, default: false },
  billable:        { type: Boolean, default: true },
  keyPlayer:       { type: Boolean, default: false },
  actionTaken:     { type: String },
  comments:        { type: String },
}, { _id: false });

const escalationSchema = new mongoose.Schema({
  engineerName: { type: String },
  details:      { type: String, required: true },
  severity:     { type: String, enum: ['Low', 'Medium', 'Major', 'Critical'], default: 'Medium' },
  actionTaken:  { type: String },
  status:       { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
  comments:     { type: String },
}, { _id: false });

// ── Main report schema ───────────────────────────────
const weeklyReportSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  pm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Week identification
  // ISO year-week string e.g. "2026-06" — used for deduplication
  weekKey: {
    type: String,
    required: true,
    // format: YYYY-WW
    match: /^\d{4}-\d{2}$/,
  },
  weekStartDate: { type: Date, required: true }, // Monday of that week

  // RAG status
  rag:  { type: String, enum: ['Red', 'Amber', 'Green'], required: true },
  prevRag: { type: String, enum: ['Red', 'Amber', 'Green', 'NA'], default: 'NA' },

  // Narrative
  reasonForRag:  { type: String, default: '' },
  pathToGreen:   { type: String, default: '' },
  overallSummary:{ type: String, default: '' },

  // Team
  teamSize:      { type: String, default: '' }, //historical data compatibility
  plannedTeamSize: { type: String, default: '' },
  actualTeamSize: { type: String, default: '' },
  billingCount:  { type: Number, default: 0 },
  currentBillableCount: { type: Number, default: 0 },
  yetToBill:     { type: Number, default: 0 },
  buffer:        { type: Number, default: 0 },

  // Details
  deliverables:  [deliverableSchema],
  attrition:     [attritionSchema],
  escalations:   [escalationSchema],

  // Meta
  submittedAt:   { type: Date, default: Date.now },
  lastEditedAt:  { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// ── Compound unique index: one report per project per week ──
weeklyReportSchema.index({ project: 1, weekKey: 1 }, { unique: true });

// ── TTL index: auto-delete reports older than DATA_RETENTION_MONTHS ──
// MongoDB TTL runs ~every 60 seconds.
// Retention is enforced at 6 months (26 weeks) = ~183 days.
// Developers can adjust DATA_RETENTION_MONTHS in .env (default 6).
// Note: TTL on weekStartDate; reports older than retention window are purged automatically.
weeklyReportSchema.index(
  { weekStartDate: 1 },
  { expireAfterSeconds: parseInt(process.env.DATA_RETENTION_MONTHS || '6') * 30 * 24 * 3600 }
);

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
