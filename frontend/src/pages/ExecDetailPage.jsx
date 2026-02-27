import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { projectsApi, reportsApi } from '../utils/api.js';
import { RagBadge, TrendArrow, Spinner } from '../components/UI.jsx';

export default function ExecDetailPage() {
  const location = useLocation();
  const [projects,  setProjects]  = useState([]);
  const [selectedId, setSelectedId] = useState(location.state?.projectId || '');
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    projectsApi.list()
      .then(ps => {
        const active = ps.filter(p => p.status === 'active');
        setProjects(active);
        if (!selectedId && active.length) setSelectedId(active[0]._id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const thisWeekKey = getCurrentWeekKey();
    reportsApi.list({ projectId: selectedId, weekKey: thisWeekKey })
      .then(reports => setReport(reports[0] || null));
  }, [selectedId]);

  if (loading) return <Spinner />;
  const proj = projects.find(p => p._id === selectedId);

  return (
    <>
      <div className="panel-title">Project Deep Dive</div>
      <div className="panel-sub">Current week detail for any project</div>

      <div className="form-group" style={{ maxWidth: 400, marginBottom: 20 }}>
        <label>Select Project</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {proj && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{proj.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {proj.client} · {proj.type} · PM: {proj.pm?.name || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {report
                ? <><RagBadge rag={report.prevRag} /> → <RagBadge rag={report.rag} /> <TrendArrow cur={report.rag} prev={report.prevRag} /></>
                : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No update this week</span>
              }
            </div>
          </div>

          {report?.reasonForRag && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(218,54,51,0.2)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--red)', marginBottom: 4 }}>Issue</div>
              <div style={{ fontSize: 13 }}>{report.reasonForRag}</div>
            </div>
          )}
          {report?.pathToGreen && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(63,185,80,0.2)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--green)', marginBottom: 4 }}>Path to Green</div>
              <div style={{ fontSize: 13 }}>{report.pathToGreen}</div>
            </div>
          )}

          {report && (
            <>
              <div className="card-title" style={{ marginTop: 16 }}>Deliverables</div>
              <table className="project-table">
                <thead>
                  <tr><th>Type</th><th>Task</th><th>Owner</th><th>ETA</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(report.deliverables || []).length === 0
                    ? <tr><td colSpan={5} style={{ color: 'var(--text-muted)', fontSize: 12, padding: 12 }}>No deliverables recorded.</td></tr>
                    : (report.deliverables || []).map((d, i) => (
                      <tr key={i}>
                        <td>{d.type || '—'}</td>
                        <td>{d.task}</td>
                        <td>{d.owner || '—'}</td>
                        <td style={{ fontSize: 12 }}>{d.eta ? new Date(d.eta).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          <span className={`rag-badge rag-${d.status === 'Completed' || d.status === 'On Track' ? 'Green' : d.status === 'Delayed' || d.status === 'At Risk' ? 'Red' : 'Amber'}`}>
                            <span className="rag-dot" />{d.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>

              {(report.attrition || []).length > 0 && (
                <>
                  <div className="card-title" style={{ marginTop: 20 }}>Team Changes / Attrition</div>
                  <table className="project-table">
                  <thead>
                    <tr>
                      <th>Engineer</th>
                      <th>Billable</th>
                      <th>Key Resource</th>
                      <th>Action Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.attrition.map((a, i) => (
                      <tr key={i}>
                        <td>{a.engineerName}</td>
                        <td>{a.billable ? 'Yes' : 'No'}</td>
                        <td>{a.keyPlayer ? '✓ Yes' : '✗ No'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.actionTaken || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}

              {(report.escalations || []).length > 0 && (
              <>
                <div className="card-title" style={{ marginTop: 20 }}>Customer Escalations</div>
                <table className="project-table">
                  <thead>
                    <tr><th>Details</th><th>Severity</th><th>Status</th><th>Action Taken</th></tr>
                  </thead>
                  <tbody>
                    {report.escalations.map((esc, i) => (
                      <tr key={i}>
                        <td>{esc.details}</td>
                        <td>
                          <span style={{ color: esc.severity === 'Critical' || esc.severity === 'Major' ? 'var(--red)' : 'var(--text)' }}>
                            {esc.severity}
                          </span>
                        </td>
                        <td>{esc.status}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{esc.actionTaken || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              Planned Team: <strong style={{ color: 'var(--text)', marginRight: 12 }}>{report.plannedTeamSize || report.teamSize || '—'}</strong>
              Actual Team: <strong style={{ color: 'var(--text)' }}>{report.actualTeamSize || '—'}</strong>
              <br />
              {report.submittedAt && `Submitted ${new Date(report.submittedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`}
            </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function getCurrentWeekKey() {
  const d = new Date();
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yr = tmp.getUTCFullYear();
  const wk = Math.ceil((((tmp - new Date(Date.UTC(yr,0,1))) / 86400000) + 1) / 7);
  return `${yr}-${String(wk).padStart(2,'0')}`;
}
