const cron = require('node-cron');
const { sendReminderEmails, sendDashboardEmail } = require('./mailer');
const User = require('../models/User');

function startCronJobs() {
  // ── Every Friday at 9:00 AM — PM reminder emails ──────────────────────────
  // Cron: "0 9 * * 5"  (min hour day month weekday)
  cron.schedule('0 9 * * 5', async () => {
    console.log('[CRON] Running Friday PM reminder emails...');
    try {
      const result = await sendReminderEmails();
      console.log(`[CRON] Reminders sent: ${result.remindersTotal}`);
    } catch (err) {
      console.error('[CRON] Reminder error:', err.message);
    }
  }, { timezone: 'Europe/Amsterdam' }); // ← adjust to your org's timezone

  // ── Every Friday at 5:00 PM — auto-send dashboard to executives ──────────
  cron.schedule('0 17 * * 5', async () => {
    console.log('[CRON] Sending weekly dashboard to executives...');
    try {
      const executives = await User.find({ role: 'exec', isActive: true }).select('email');
      if (!executives.length) { console.log('[CRON] No exec recipients.'); return; }
      const result = await sendDashboardEmail(executives.map(e => e.email));
      console.log(`[CRON] Dashboard sent: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error('[CRON] Dashboard email error:', err.message);
    }
  }, { timezone: 'Europe/Amsterdam' });

  console.log('✅ Cron jobs scheduled (Friday 9:00 AM reminders + 5:00 PM dashboard)');
}

module.exports = { startCronJobs };
