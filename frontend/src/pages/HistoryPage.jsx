import React, { useState, useEffect } from 'react';
import { reportsApi, projectsApi } from '../utils/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { RagBadge, Spinner } from '../components/UI.jsx';

const RAG_COLOR = { Red: 'var(--red)', Amber: 'var(--amber)', Green: 'var(--green)', NA: 'var(--surface2)' };

export default function HistoryPage() {
  const { user } = useAuth();
  const [projects,  setProjects]  = useState([]);
  const [selected,  setSelected]  = useState('');
  const [history,   setHistory]   = useState([]);
  const [allHistory, setAllHistory] = useState({});  // projectId → reports[]
  const [loading,   setLoading]   = useState(true);
  const [detailWeek, setDetailWeek] = useState(null);

  // Load all projects first
  useEffect(() => {
    projectsApi.list()
      .then(projs => {
        const active = projs.filter(p => p.status === 'active');
        setProjects(active);
        if (active.length) setSelected(active[0]._id);
      })
      .finally(() => setLoading(false));
  }, []);

  // When a project is selected, load its history
  useEffect(() => {
    if (!selected) return;
    if (allHistory[selected]) {
      setHistory(allHistory[selected]);
      return;
    }
    setLoading(true);
    reportsApi.history(selected)
      .then(data => {
        setAllHistory(prev => ({ ...prev, [selected]: data }));
        setHistory(data);
      })
      .finally(() => setLoading(false));
  }, [selected]);

  // For exec: load ALL projects' history for the heatmap
  const [globalHistory, setGlobalHistory] = useState([]);
  useEffect(() => {
    if (user.role !== 'exec') return;
    reportsApi.list({ months: 6, summary: 'true' })
      .then(data => setGlobalHistory(data))
      .catch(() => {});
  }, [user.role]);

  if (loading && !projects.length) return <Spinner />;

  // Build week columns for the last 26 weeks
  const weekCols = buildWeekColumns(26);

  return (
    <>
      <div className="panel-title">History</div>
      <div className="panel-sub">Up to 6 months of weekly RAG data</div>

      {/* ── Heatmap overview (exec only) ─────────────────────────────────── */}
      {user.role === 'exec' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="card-title">Portfolio Heatmap — Last 26 Weeks</div>
          <div style={{ minWidth: 800 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(26,1fr)', gap: 2, marginBottom: 6 }}>
              <div />
              {weekCols.map(w => (
                <div key={w.key} style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', transform: 'rotate(-45deg)', transformOrigin: 'bottom left', whiteSpace: 'nowrap', height: 40, display: 'flex', alignItems: 'flex-end' }}>
                  {w.shortLabel}
                </div>
              ))}
            </div>
            {/* Project rows */}
            {projects.map(proj => {
              const projReports = globalHistory.filter(r => r.project?._id === proj._id || r.project === proj._id);
              const byWeek = {};
              projReports.forEach(r => { byWeek[r.weekKey] = r.rag; });
              return (
                <div key={proj._id} style={{ display: 'grid', gridTemplateColumns: '180px repeat(26,1fr)', gap: 2, marginBottom: 2, alignItems: 'center' }}>
                  <div
                    style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: selected === proj._id ? 'var(--accent)' : 'var(--text)' }}
                    title={proj.name}
                    onClick={() => setSelected(proj._id)}
                  >
                    {proj.name}
                  </div>
                  {weekCols.map(w => {
                    const rag = byWeek[w.key] || 'NA';
                    return (
                      <div
                        key={w.key}
                        className={`timeline-cell`}
                        title={`${proj.name} · ${w.label} · ${rag}`}
                        style={{ background: RAG_COLOR[rag], opacity: rag === 'NA' ? 0.2 : 1 }}
                        onClick={() => { setSelected(proj._id); setDetailWeek(w.key); }}
                      />
                    );
                  })}
                </div>
              );
            })}
            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              {['Green','Amber','Red','NA'].map(r => (
                <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: RAG_COLOR[r], display: 'inline-block', opacity: r === 'NA' ? 0.3 : 1 }} />
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Project selector + trend chart ───────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label>Select Project</label>
            <select value={selected} onChange={e => { setSelected(e.target.value); setDetailWeek(null); }}>
              {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? <Spinner text="Loading history…" /> : (
          <>
            {/* Trend bars */}
            <div className="card-title">Weekly RAG Trend</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60, marginBottom: 8, overflowX: 'auto' }}>
              {weekCols.map(w => {
                const report = history.find(r => r.weekKey === w.key);
                const rag    = report?.rag || 'NA';
                const isSelected = detailWeek === w.key;
                return (
                  <div
                    key={w.key}
                    title={`${w.label} — ${rag}`}
                    onClick={() => setDetailWeek(isSelected ? null : w.key)}
                    style={{
                      width: 18, height: rag === 'NA' ? 8 : rag === 'Green' ? 48 : rag === 'Amber' ? 32 : 48,
                      background: RAG_COLOR[rag],
                      borderRadius: '3px 3px 0 0',
                      cursor: 'pointer',
                      flexShrink: 0,
                      opacity: rag === 'NA' ? 0.25 : 1,
                      outline: isSelected ? `2px solid white` : 'none',
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 20 }}>
              {weekCols.map(w => (
                <div key={w.key} style={{ width: 18, fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0, transform: 'rotate(-45deg)', transformOrigin: 'top center', marginTop: 4 }}>
                  {w.shortLabel}
                </div>
              ))}
            </div>

            {/* Detailed weekly table */}
            <div className="card-title" style={{ marginTop: 8 }}>
              {detailWeek ? `Week ${detailWeek} Detail` : 'All Weeks (newest first)'}
              {detailWeek && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={() => setDetailWeek(null)}>← All weeks</button>}
            </div>
            <table className="project-table">
              <thead>
              <tr>
                <th>Week</th>
                <th>RAG</th>
                <th>Reason / Notes</th>
                <th>Path to Green</th>
                <th>Planned Team</th>
                <th>Actual Team</th>
                <th>Submitted</th>
              </tr>
            </thead>
              <tbody>
                {history
                  .filter(r => !detailWeek || r.weekKey === detailWeek)
                  .sort((a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate))
                  .map(r => (
                    <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => setDetailWeek(r.weekKey === detailWeek ? null : r.weekKey)}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {r.weekKey}<br />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(r.weekStartDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                        </span>
                      </td>
                      <td><RagBadge rag={r.rag} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 240 }}>{r.reasonForRag || <span style={{ color: 'var(--green)' }}>On track</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>{r.pathToGreen || '—'}</td>
                      <td style={{ fontSize: 12 }}>{r.plannedTeamSize || r.teamSize || '—'}</td>
                      <td style={{ fontSize: 12 }}>{r.actualTeamSize || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                    </tr>
                  ))
                }
                {history.filter(r => !detailWeek || r.weekKey === detailWeek).length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No data for this period</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

// Build last N weeks as column descriptors
function buildWeekColumns(n) {
  const cols = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    // Monday of that week
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    // ISO week key
    const tmp = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yr  = tmp.getUTCFullYear();
    const wk  = Math.ceil((((tmp - new Date(Date.UTC(yr,0,1))) / 86400000) + 1) / 7);
    const key = `${yr}-${String(wk).padStart(2,'0')}`;
    cols.push({
      key,
      label:      mon.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
      shortLabel: mon.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }),
    });
  }
  return cols;
}
