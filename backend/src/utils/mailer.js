const nodemailer   = require('nodemailer');
const WeeklyReport = require('../models/WeeklyReport');
const Project      = require('../models/Project');
const User         = require('../models/User');
const { getWeekKey, getWeekStart, getRetentionCutoff } = require('./weekUtils');

// ── SMTP transport ───────────────────────────────────────────────────────────
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Dashboard email ──────────────────────────────────────────────────────────
async function sendDashboardEmail(toAddresses) {
  const weekKey = getWeekKey(new Date());
  const reports = await WeeklyReport.find({ weekKey })
    .populate('project', 'name client')
    .populate('pm', 'name')
    .lean();

  const activeProjects = await Project.find({ status: 'active' }).lean();
  const submitted = new Set(reports.map(r => r.project._id.toString()));
  const pending   = activeProjects.filter(p => !submitted.has(p._id.toString()));

  const reds   = reports.filter(r => r.rag === 'Red');
  const ambers = reports.filter(r => r.rag === 'Amber');
  const greens = reports.filter(r => r.rag === 'Green');

  const ragRow = (r, color) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle"></span>
        <strong>${r.project.name}</strong>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:13px">${r.pm?.name || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:12px">${r.reasonForRag || 'On track'}</td>
    </tr>`;

  const pendingRows = pending.length ? `
    <h3 style="margin:24px 0 8px;color:#888;font-size:14px">⬜ Pending Updates (${pending.length})</h3>
    <table style="width:100%;border-collapse:collapse">
      ${pending.map(p => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999;font-size:13px">${p.name}</td></tr>`).join('')}
    </table>` : '';

  const html = `
  <!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:32px">
    <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
      <div style="background:#0d1117;padding:28px 32px">
        <h1 style="color:#f0b429;margin:0;font-size:22px">⬡ RAG Tracker</h1>
        <p style="color:#7d8590;margin:6px 0 0;font-size:14px">Weekly Project Health Dashboard — Week ${weekKey}</p>
      </div>
      <div style="padding:28px 32px">
        <div style="display:flex;gap:16px;margin-bottom:24px">
          <div style="flex:1;background:#fff0f0;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#da3633">${reds.length}</div>
            <div style="color:#888;font-size:13px">🔴 Red</div>
          </div>
          <div style="flex:1;background:#fffbf0;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#d29922">${ambers.length}</div>
            <div style="color:#888;font-size:13px">🟡 Amber</div>
          </div>
          <div style="flex:1;background:#f0fff4;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#3fb950">${greens.length}</div>
            <div style="color:#888;font-size:13px">🟢 Green</div>
          </div>
        </div>

        ${reds.length ? `<h3 style="color:#da3633;font-size:14px;margin:0 0 8px">🔴 Needs Attention</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${reds.map(r => ragRow(r,'#da3633')).join('')}</table>` : ''}

        ${ambers.length ? `<h3 style="color:#d29922;font-size:14px;margin:0 0 8px">🟡 Under Watch</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${ambers.map(r => ragRow(r,'#d29922')).join('')}</table>` : ''}

        ${greens.length ? `<h3 style="color:#3fb950;font-size:14px;margin:0 0 8px">🟢 On Track</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${greens.map(r => ragRow(r,'#3fb950')).join('')}</table>` : ''}

        ${pendingRows}
      </div>
      <div style="background:#f9f9f9;padding:16px 32px;font-size:11px;color:#999;border-top:1px solid #eee">
        Sent automatically by RAG Tracker · ${new Date().toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
      </div>
    </div>
  </body></html>`;

  const transport = createTransport();
  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM || 'RAG Tracker <no-reply@company.com>',
    to: toAddresses.join(', '),
    subject: `📊 RAG Dashboard — Week ${weekKey} | ${reds.length} Red · ${ambers.length} Amber · ${greens.length} Green`,
    html,
  });

  return { messageId: info.messageId, accepted: info.accepted };
}

// ── PM reminder emails ───────────────────────────────────────────────────────
async function sendReminderEmails() {
  const weekKey = getWeekKey(new Date());
  const submitted = await WeeklyReport.distinct('project', { weekKey });
  const submittedIds = new Set(submitted.map(id => id.toString()));

  // Find PMs with at least one active project not yet submitted
  const activeProjects = await Project.find({ status: 'active', pm: { $ne: null } })
    .populate('pm', 'name email')
    .lean();

  const pmPending = {};
  for (const proj of activeProjects) {
    if (!submittedIds.has(proj._id.toString())) {
      const pmId = proj.pm._id.toString();
      if (!pmPending[pmId]) pmPending[pmId] = { pm: proj.pm, projects: [] };
      pmPending[pmId].projects.push(proj.name);
    }
  }

  const transport = createTransport();
  const results   = [];

  for (const { pm, projects } of Object.values(pmPending)) {
    const html = `
    <!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        <div style="background:#0d1117;padding:24px 28px">
          <h1 style="color:#f0b429;margin:0;font-size:20px">⬡ RAG Tracker</h1>
        </div>
        <div style="padding:28px">
          <p>Hi <strong>${pm.name}</strong>,</p>
          <p style="color:#555">This is your weekly reminder to submit RAG status updates for the following project${projects.length > 1 ? 's' : ''}:</p>
          <ul style="color:#333;line-height:2">
            ${projects.map(p => `<li><strong>${p}</strong></li>`).join('')}
          </ul>
          <p style="color:#555">Please log in and submit your updates before end of day today.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#f0b429;color:#0d1117;font-weight:600;border-radius:8px;text-decoration:none">
            Open RAG Tracker →
          </a>
        </div>
        <div style="background:#f9f9f9;padding:14px 28px;font-size:11px;color:#999;border-top:1px solid #eee">
          You are receiving this because you are a Project Manager in RAG Tracker.
        </div>
      </div>
    </body></html>`;

    try {
      const info = await transport.sendMail({
        from: process.env.EMAIL_FROM || 'RAG Tracker <no-reply@company.com>',
        to: pm.email,
        subject: `🔔 Reminder: Submit your RAG updates for Week ${weekKey}`,
        html,
      });
      results.push({ pm: pm.email, status: 'sent', messageId: info.messageId });
    } catch (err) {
      results.push({ pm: pm.email, status: 'failed', error: err.message });
    }
  }

  return {
    weekKey,
    remindersTotal: results.length,
    results,
  };
}

module.exports = { sendDashboardEmail, sendReminderEmails };
