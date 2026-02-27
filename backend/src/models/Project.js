const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  client: { type: String, required: true, trim: true },
  type:   { type: String, enum: ['T & Material', 'Fixed Price', 'Retainer'], default: 'T & Material' },
  pm:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
