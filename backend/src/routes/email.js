const express  = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendDashboardEmail, sendReminderEmails } = require('../utils/mailer');
const User     = require('../models/User');

const router = express.Router();
router.use(authenticate);

// POST /api/email/send-dashboard  — admin only
router.post('/send-dashboard', requireRole('admin'), async (req, res) => {
  try {
    const executives = await User.find({ role: 'exec', isActive: true }).select('email name');
    if (!executives.length) {
      return res.status(400).json({ error: 'No executive recipients found. Add executives in Users & Access.' });
    }
    const to = executives.map(u => u.email);
    const result = await sendDashboardEmail(to);
    res.json({ message: `Dashboard sent to ${to.length} recipient(s)`, recipients: to, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/send-reminders  — admin only (also triggered by cron)
router.post('/send-reminders', requireRole('admin'), async (req, res) => {
  try {
    const result = await sendReminderEmails();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/email/recipients — list exec email recipients
router.get('/recipients', requireRole('admin'), async (req, res) => {
  try {
    const executives = await User.find({ role: 'exec', isActive: true }).select('name email');
    res.json(executives);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
