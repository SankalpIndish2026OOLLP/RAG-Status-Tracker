import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, projectsApi } from '../utils/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { RagBadge, TrendArrow, Spinner } from '../components/UI.jsx';

export default function DashboardPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [data,    setData]    = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([reportsApi.currentWeek(), projectsApi.list()])
      .then(([reportData, projs]) => {
        setData(reportData);
        setProjects(projs);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const reports   = data?.reports || [];
  const weekKey   = data?.weekKey || '';
  const reported  = new Set(reports.map(r => r.project._id));
  const pending   = projects.filter(p => !reported.has(p._id) && p.status === 'active');

  const reds   = reports.filter(r => r.rag === 'Red').length;
  const ambers = reports.filter(r => r.rag === 'Amber').length;
  const greens = reports.filter(r => r.rag === 'Green').length;

  return (
    <>
      <div className="panel-title">Project Health Dashboard</div>
      <div className="panel-sub">Week {weekKey} · {projects.filter(p=>p.status==='active').length} active projects</div>

      {user.role === 'pm' && pending.length > 0 && (
        <div className="reminder-card">
          <span style={{ fontSize: 24 }}>🔔</span>
          <div style={{ fontSize: 13 }}>
            You have <strong style={{ color: 'var(--accent)' }}>{pending.length} project{pending.length > 1 ? 's' : ''}</strong> without a status update this week.{' '}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate('/update')}>Update now</button>
          </div>
        </div>
      )}

      <div className="stats-row">
        <div className="stat-card stat-red">   <div className="stat-value">{reds}</div>  <div className="stat-label">🔴 Red</div></div>
        <div className="stat-card stat-amber">  <div className="stat-value">{ambers}</div><div className="stat-label">🟡 Amber</div></div>
        <div className="stat-card stat-green">  <div className="stat-value">{greens}</div><div className="stat-label">🟢 Green</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--text-muted)' }}>{pending.length}</div><div className="stat-label">⬜ Pending</div></div>
      </div>

      <div className="card">
        <div className="card-title">All Projects — Current Week</div>
        <table className="project-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>{user.role === 'pm' ? 'Client' : 'PM'}</th>
              <th>T-1 Week</th>
              <th>This Week</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {/* Submitted reports */}
            {[...reports].sort((a,b) => {
              const o = { Red:0, Amber:1, Green:2 };
              return (o[a.rag]??3) - (o[b.rag]??3);
            }).map(r => (
              <tr key={r._id}>
                <td><strong>{r.project?.name}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {user.role === 'pm' ? r.project?.client : r.pm?.name}
                </td>
                <td><RagBadge rag={r.prevRag} /></td>
                <td><RagBadge rag={r.rag} /> <TrendArrow cur={r.rag} prev={r.prevRag} /></td>
                <td style={{ maxWidth: 280, fontSize: 12, color: 'var(--text-muted)' }}>
                  {r.reasonForRag || <span style={{ color: 'var(--green)' }}>On track</span>}
                </td>
                <td>
                  {user.role === 'pm'
                    ? <button className="btn btn-ghost btn-sm" onClick={() => navigate('/update', { state: { projectId: r.project._id } })}>Update</button>
                    : <button className="btn btn-ghost btn-sm" onClick={() => navigate('/detail', { state: { projectId: r.project._id } })}>View</button>
                  }
                </td>
              </tr>
            ))}
            {/* Pending (no report yet this week) */}
            {pending.map(p => (
              <tr key={p._id} style={{ opacity: 0.5 }}>
                <td><strong>{p.name}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {user.role === 'pm' ? p.client : p.pm?.name || '—'}
                </td>
                <td><RagBadge rag="NA" /></td>
                <td><RagBadge rag="NA" /></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not submitted</td>
                <td>
                  {user.role === 'pm' && (
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/update', { state: { projectId: p._id } })}>Submit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
