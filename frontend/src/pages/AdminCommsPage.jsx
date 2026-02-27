import React, { useState, useEffect } from 'react';
import { emailApi, reportsApi, projectsApi } from '../utils/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { Modal, RagBadge, Spinner } from '../components/UI.jsx';

export default function AdminCommsPage() {
  const toast = useToast();
  const [recipients, setRecipients]   = useState([]);
  const [preview,    setPreview]      = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending,    setSending]      = useState(false);
  const [loading,    setLoading]      = useState(true);

  useEffect(() => {
    emailApi.recipients()
      .then(r => setRecipients(r))
      .finally(() => setLoading(false));
  }, []);

  async function sendDashboard() {
    setSending(true);
    try {
      const result = await emailApi.sendDashboard();
      toast(`Dashboard sent to ${result.recipients?.length || 0} recipient(s) ✓`, 'success');
      setPreviewOpen(false);
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setSending(false);
    }
  }

  async function sendReminders() {
    setSending(true);
    try {
      const result = await emailApi.sendReminders();
      toast(`Sent ${result.remindersTotal} reminder(s) ✓`, 'success');
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setSending(false);
    }
  }

  async function openPreview() {
    try {
      const [weekData, projects] = await Promise.all([
        reportsApi.currentWeek(),
        projectsApi.list(),
      ]);
      setPreview({ reports: weekData.reports, weekKey: weekData.weekKey, projects });
      setPreviewOpen(true);
    } catch {
      setPreviewOpen(true);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="panel-title">Communications</div>
      <div className="panel-sub">Manage automated reminders and dashboard distribution</div>

      <div className="card">
        <div className="card-title">📬 Executive Dashboard Recipients</div>
        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>
          These executives receive the weekly RAG dashboard email every Friday at 5:00 PM.
        </p>
        {recipients.length === 0
          ? <p style={{ fontSize:13, color:'var(--text-muted)' }}>No executives added yet. Add executives in <strong>Users & Access</strong>.</p>
          : recipients.map(r => (
            <div key={r._id} className="user-list-item">
              <div>
                <div className="name">{r.name}</div>
                <div className="email">{r.email}</div>
              </div>
            </div>
          ))
        }
      </div>

      <div className="card">
        <div className="card-title">🔔 PM Reminder Schedule</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>
          Automated reminders are sent every <strong style={{ color:'var(--text)' }}>Friday at 9:00 AM</strong> to PMs with pending updates.
        </div>
        <div style={{ background:'var(--green-bg)', border:'1px solid rgba(63,185,80,0.2)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--green)', marginBottom:16 }}>
          ✓ Reminder schedule active — next run: Friday 9:00 AM
        </div>
        <button className="btn btn-ghost" onClick={sendReminders} disabled={sending}>
          {sending ? 'Sending…' : '🔔 Send Reminders Now'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">📤 Send Dashboard Now</div>
        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>
          Preview and send the current week's RAG dashboard to all executive recipients immediately.
        </p>
        <button className="btn btn-primary" onClick={openPreview} disabled={sending}>
          Preview &amp; Send Dashboard
        </button>
      </div>

      {/* Email preview modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="📧 Email Preview — Weekly Dashboard" wide>
        {preview && (
          <div style={{ background:'#fff', borderRadius:8, padding:24, color:'#333', fontFamily:'-apple-system,sans-serif', maxHeight:400, overflowY:'auto' }}>
            <h2 style={{ color:'#111', marginBottom:16, fontSize:18 }}>📊 Weekly RAG Dashboard — Week {preview.weekKey}</h2>
            <div style={{ display:'flex', gap:20, marginBottom:16 }}>
              <span style={{ color:'#da3633', fontWeight:600 }}>🔴 {preview.reports.filter(r=>r.rag==='Red').length} Red</span>
              <span style={{ color:'#d29922', fontWeight:600 }}>🟡 {preview.reports.filter(r=>r.rag==='Amber').length} Amber</span>
              <span style={{ color:'#3fb950', fontWeight:600 }}>🟢 {preview.reports.filter(r=>r.rag==='Green').length} Green</span>
            </div>
            {[...preview.reports].sort((a,b) => {const o={Red:0,Amber:1,Green:2}; return (o[a.rag]??3)-(o[b.rag]??3);}).map(r => (
              <div key={r._id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #eee', fontSize:13 }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background: r.rag==='Red'?'#da3633':r.rag==='Amber'?'#d29922':'#3fb950', flexShrink:0 }} />
                <strong style={{ minWidth:180 }}>{r.project?.name}</strong>
                <span style={{ color:'#666', fontSize:12, flex:1 }}>{r.reasonForRag || 'On track'}</span>
              </div>
            ))}
            <p style={{ fontSize:11, color:'#999', marginTop:16 }}>
              Recipients: {recipients.map(r=>r.email).join(', ')}
            </p>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setPreviewOpen(false)}>Close</button>
          <button className="btn btn-primary" onClick={sendDashboard} disabled={sending}>
            {sending ? 'Sending…' : `Send to ${recipients.length} recipient(s)`}
          </button>
        </div>
      </Modal>
    </>
  );
}
