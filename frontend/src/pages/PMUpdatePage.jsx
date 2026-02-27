import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectsApi, reportsApi } from '../utils/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { Spinner, Modal } from '../components/UI.jsx';

export default function PMUpdatePage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const toast     = useToast();

  const [projects,    setProjects]    = useState([]);
  const [selectedId,  setSelectedId]  = useState(location.state?.projectId || '');
  const [existing,    setExisting]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  const [rag,         setRag]         = useState('');
  const [reason,      setReason]      = useState('');
  const [path,        setPath]        = useState('');
  const [teamSize,    setTeamSize]    = useState('');
  const [deliverables, setDeliverables] = useState([]);
  const [attrition,   setAttrition]   = useState([]);
  const [escalations, setEscalations] = useState([]);

  const [plannedTeamSize, setPlannedTeamSize] = useState('');
  const [actualTeamSize, setActualTeamSize] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // Tracks which item to delete

  // Load projects
  useEffect(() => {
    projectsApi.list()
      .then(ps => {
        setProjects(ps.filter(p => p.status === 'active'));
      })
      .finally(() => setLoading(false));
  }, []);

  // When project changes, load existing report for this week
  useEffect(() => {
    if (!selectedId) return;
    reportsApi.list({ projectId: selectedId, months: 1 })
      .then(reports => {
        // Find this week's report
        const thisWeekKey = getCurrentWeekKey();
        const thisWeek = reports.find(r => r.weekKey === thisWeekKey);
        if (thisWeek) {
          setExisting(thisWeek);
          setRag(thisWeek.rag || '');
          setReason(thisWeek.reasonForRag || '');
          setPath(thisWeek.pathToGreen || '');
          setTeamSize(thisWeek.teamSize || '');
          setPlannedTeamSize(thisWeek.plannedTeamSize || thisWeek.teamSize || ''); // Fallback to legacy teamSize
          setActualTeamSize(thisWeek.actualTeamSize || '');
          setDeliverables(thisWeek.deliverables || []);
          setAttrition(thisWeek.attrition || []);
          setEscalations(thisWeek.escalations || []); // Add this line
        } else {
          setExisting(null);
          setRag(''); setReason(''); setPath(''); setTeamSize('');
          setDeliverables([]); setAttrition([]); setEscalations([]); // Add this line
        }
      });
  }, [selectedId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rag) { toast('Please select a RAG status', 'danger'); return; }
    setSaving(true);
    try {
      await reportsApi.submit({
        projectId: selectedId,
        rag, reasonForRag: reason, pathToGreen: path,
        teamSize, plannedTeamSize, actualTeamSize, deliverables, attrition, escalations // Include escalations in the payload and also olanned and actual team size
      });
      toast('Status saved ✓', 'success');
      setTimeout(() => navigate('/dashboard'), 700);
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  }

  function addDeliverable() {
    setDeliverables(prev => [...prev, { type: 'Task', task: '', owner: '', eta: '', status: 'On Track' }]);
  }
  function updateDeliverable(i, field, val) {
    setDeliverables(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  }
  function removeDeliverable(i) {
    setDeliverables(prev => prev.filter((_, idx) => idx !== i));
  }

  function addAttrition() {
    setAttrition(prev => [...prev, { engineerName: '', billable: true, keyPlayer:false, actionTaken: '' }]);
  }
  function updateAttrition(i, field, val) {
    setAttrition(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  }
  function removeAttrition(i) {
    setAttrition(prev => prev.filter((_, idx) => idx !== i));
  }

  // ... (below your removeAttrition function, add these 3 helpers)
  function addEscalation() {
    setEscalations(prev => [...prev, { details: '', severity: 'Medium', status: 'Open', actionTaken: '' }]);
  }
  function updateEscalation(i, field, val) {
    setEscalations(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }
  function removeEscalation(i) {
    setEscalations(prev => prev.filter((_, idx) => idx !== i));
  }
  
  function executeDelete() {
    if (!confirmDelete) return;
    const { type, index } = confirmDelete;
    
    if (type === 'deliverable') removeDeliverable(index);
    if (type === 'attrition') removeAttrition(index);
    if (type === 'escalation') removeEscalation(index);
    
    setConfirmDelete(null);
  }


  if (loading) return <Spinner />;

  return (
    <>
      <div className="panel-title">Update Project Status</div>
      <div className="panel-sub">Submit your weekly RAG update</div>

      <div className="card">
        <div className="form-group">
          <label>Select Project</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— Choose a project —</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>

        {selectedId && (
          <form onSubmit={handleSubmit}>
            {existing && (
              <div style={{ background: 'var(--amber-bg)', border: '1px solid rgba(210,153,34,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--amber)' }}>
                ✏️ Editing existing update for this week
              </div>
            )}

            <hr style={{ borderColor: 'var(--border)', margin: '4px 0 20px' }} />

            {/* RAG selector */}
            <div className="form-group">
              <label>RAG Status — This Week</label>
              <div className="rag-selector">
                {['Red', 'Amber', 'Green'].map(r => (
                  <div
                    key={r}
                    className={`rag-option ${rag === r ? 'selected' : ''}`}
                    data-val={r}
                    onClick={() => setRag(r)}
                  >{r}</div>
                ))}
              </div>
            </div>

            {/* Reason / path (only for Red/Amber) */}
            {rag && rag !== 'Green' && (
              <>
                <div className="form-group">
                  <label>Reason for {rag}</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the issue in detail…" />
                </div>
                <div className="form-group">
                  <label>Path to Green</label>
                  <textarea value={path} onChange={e => setPath(e.target.value)} placeholder="What actions will resolve this?" />
                </div>
              </>
            )}

            {/* Replaced the previous team size input with two separate inputs for planned and actual team size to align with the updated data model */}
            <div className="two-col">
            <div className="form-group">
              <label>Planned Team Size</label>
              <input type="text" value={plannedTeamSize} onChange={e => setPlannedTeamSize(e.target.value)} placeholder="e.g. 2 Dev + 1 QA" />
            </div>
            <div className="form-group">
              <label>Actual Team Size</label>
              <input type="text" value={actualTeamSize} onChange={e => setActualTeamSize(e.target.value)} placeholder="e.g. 1 Dev + 1 QA" />
            </div>
          </div>

            {/* Deliverables */}
            <div className="form-group">
              <label>Deliverables / Tasks</label>
              {deliverables.length > 0 && (
                <div className="desktop-headers" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                  {['Type','Task','Owner','ETA','Status',''].map((h,i) => (
                    <small className="desktop-headers" key={i} style={{ color: 'var(--text-muted)' }}>{h}</small>
                  ))}
                </div>
              )}
              {deliverables.map((d, i) => (
                <div key={i} className="deliverable-row">
                  <select value={d.type} onChange={e => updateDeliverable(i, 'type', e.target.value)}>
                    {['Story','Hotfix','Bug','Task','Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input type="text" value={d.task}  onChange={e => updateDeliverable(i,'task',e.target.value)}  placeholder="Task description" />
                  <input type="text" value={d.owner} onChange={e => updateDeliverable(i,'owner',e.target.value)} placeholder="Owner" />
                  <input 
                    type="date" 
                    value={d.eta} 
                    onChange={e => updateDeliverable(i, 'eta', e.target.value)} 
                    onClick={e => e.target.showPicker()} 
                  />
                  <select value={d.status} onChange={e => updateDeliverable(i,'status',e.target.value)}>
                    {['On Track','Completed','Delayed','At Risk'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'deliverable', index: i })}>✕</button>
                </div>
              ))}
              <button type="button" className="add-row-btn" onClick={addDeliverable}>+ Add task</button>
            </div>

            {/* Attrition */}
            <div className="form-group">
              <label>Attrition / Team Changes</label>
                
              {/* 1. This new block adds the labels above the inputs */}
            {attrition.length > 0 && (
              <div className="desktop-headers" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 8, marginBottom: 6 }}>
                {['Engineer Name', 'Billable', 'Key Resource', 'Action Taken', ''].map((h, i) => (
                  <small key={i} style={{ color: 'var(--text-muted)' }}>{h}</small>
                ))}
              </div>
            )}

              {attrition.map((a, i) => (
                <div key={i} className="dynamic-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 8, marginBottom: 8 }}>
                  <input type="text" value={a.engineerName} onChange={e => updateAttrition(i,'engineerName',e.target.value)} placeholder="Engineer name" style={{ padding:'8px 10px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit' }} />
                  
                <select value={a.billable?'Yes':'No'} onChange={e => updateAttrition(i,'billable',e.target.value==='Yes')} style={{ padding:'8px 6px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)' }}>
                  <option>Yes</option><option>No</option>
                </select>
                  
                <select value={a.keyPlayer?'Yes':'No'} onChange={e => updateAttrition(i,'keyPlayer',e.target.value==='Yes')} style={{ padding:'8px 6px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)' }}>
                  <option>Yes</option><option>No</option>
                </select>
                  
                  <input type="text" value={a.actionTaken} onChange={e => updateAttrition(i,'actionTaken',e.target.value)} placeholder="Action taken" style={{ padding:'8px 10px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit' }} />
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'attrition', index: i })}>✕</button>
                </div>
              ))}
              <button type="button" className="add-row-btn" onClick={addAttrition}>+ Add entry</button>
            </div>

            {/* Customer Escalations */}
            <div className="form-group">
              <label >Customer Escalations</label>
              
              {escalations.length > 0 && (
                <div className="desktop-headers" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 8, marginBottom: 6 }}>
                  {['Details', 'Severity', 'Status', 'Action Taken', ''].map((h, i) => (
                    <small key={i} style={{ color: 'var(--text-muted)' }}>{h}</small>
                  ))}
                </div>
              )}

              {escalations.map((esc, i) => (
                <div key={i} className="dynamic-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 8, marginBottom: 8 }}>
                  <input type="text" value={esc.details} onChange={e => updateEscalation(i,'details',e.target.value)} placeholder="Escalation details" style={{ padding:'8px 10px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit' }} />
                  
                  <select value={esc.severity} onChange={e => updateEscalation(i,'severity',e.target.value)} style={{ padding:'8px 6px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)' }}>
                    {['Low', 'Medium', 'Major', 'Critical'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  
                  <select value={esc.status} onChange={e => updateEscalation(i,'status',e.target.value)} style={{ padding:'8px 6px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)' }}>
                    {['Open', 'In Progress', 'Resolved'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  
                  <input type="text" value={esc.actionTaken} onChange={e => updateEscalation(i,'actionTaken',e.target.value)} placeholder="Action taken" style={{ padding:'8px 10px',fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'inherit' }} />
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'escalation', index: i })}>✕</button>
                </div>
              ))}
              <button type="button" className="add-row-btn" onClick={addEscalation}>+ Add escalation</button>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : '💾 Save Update'}
            </button>
          </form>
        )}
      </div>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirm Removal">
      <div style={{ marginBottom: 20, fontSize: 14, color: 'var(--text)' }}>
        Are you sure you want to remove this entry?
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
        <button className="btn btn-danger" onClick={executeDelete}>Yes, Remove</button>
      </div>
    </Modal>
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
