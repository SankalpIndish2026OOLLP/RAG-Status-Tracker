import React, { useState, useEffect } from 'react';
import { projectsApi, usersApi } from '../utils/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { Modal, Spinner } from '../components/UI.jsx';

export default function AdminProjectsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [pms,      setPms]      = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({ name:'', client:'', type:'T & Material', pm:'' });
  const [saving,   setSaving]   = useState(false);

  // Adding for custom confirmation box
  const [targetProject, setTargetProject] = useState(null);

  useEffect(() => {
    Promise.all([projectsApi.list(), usersApi.pms()])
      .then(([ps, pmList]) => { setProjects(ps); setPms(pmList); })
      .finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name:'', client:'', type:'T & Material', pm: pms[0]?._id || '' });
    setModal(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({ name: p.name, client: p.client, type: p.type, pm: p.pm?._id || '' });
    setModal(true);
  }
  async function save() {
    if (!form.name || !form.client) { toast('Name and client required', 'danger'); return; }
    setSaving(true);
    try {
      if (editing) {
        const updated = await projectsApi.update(editing._id, form);
        setProjects(prev => prev.map(p => p._id === editing._id ? updated : p));
        toast('Project updated ✓', 'success');
      } else {
        const created = await projectsApi.create(form);
        setProjects(prev => [...prev, created]);
        toast('Project added ✓', 'success');
      }
      setModal(false);
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  }
  // 1. Triggered when the user clicks either "Close" or "Reopen"
function initiateToggle(p) {
  setTargetProject(p);
}

// 2. Triggered when the user clicks "Yes" in the custom modal
async function executeToggle() {
  if (!targetProject) return;
  const isClosing = targetProject.status === 'active';
  
  try {
    const updated = await projectsApi.update(targetProject._id, { status: isClosing ? 'closed' : 'active' });
    setProjects(prev => prev.map(x => x._id === targetProject._id ? updated : x));
    toast(isClosing ? 'Project closed' : 'Project reopened ✓', isClosing ? 'info' : 'success');
  } catch (err) {
    toast(err.message, 'danger');
  } finally {
    setTargetProject(null); // Close the modal
  }
}

  if (loading) return <Spinner />;

  const active = projects.filter(p => p.status === 'active');
  const closed = projects.filter(p => p.status === 'closed');

  function ProjectRow({ p, isClosed }) {
    return (
      <tr style={{ opacity: isClosed ? 0.5 : 1 }}>
        <td><strong>{p.name}</strong></td>
        <td>{p.client}</td>
        <td>{p.pm?.name || <span style={{ color:'var(--text-muted)' }}>Unassigned</span>}</td>
        <td>{p.type}</td>
        <td>
          {!isClosed
            ? <>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit / Reassign PM</button>
                <button className="btn btn-danger btn-sm" style={{ marginLeft:6 }} onClick={() => initiateToggle(p)}>Close</button>
              </>
            : <>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>Closed</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft:8 }} onClick={() => initiateToggle(p)}>Reopen</button>
              </>
          }
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="panel-title">Manage Projects</div>
      <div className="panel-sub">Add projects, reassign PMs, or close completed projects</div>
      <div className="section-header">
        <div />
        <button className="btn btn-primary" onClick={openAdd}>+ Add Project</button>
      </div>

      <div className="card">
        <div className="card-title">Active Projects ({active.length})</div>
        <table className="project-table">
          <thead><tr><th>Project</th><th>Client</th><th>Assigned PM</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>
            {active.length === 0
              ? <tr><td colSpan={5} style={{ color:'var(--text-muted)', padding:16 }}>No active projects.</td></tr>
              : active.map(p => <ProjectRow key={p._id} p={p} isClosed={false} />)
            }
          </tbody>
        </table>
      </div>

      {closed.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ color:'var(--text-muted)' }}>Closed Projects ({closed.length})</div>
          <table className="project-table">
            <thead><tr><th>Project</th><th>Client</th><th>PM</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>{closed.map(p => <ProjectRow key={p._id} p={p} isClosed={true} />)}</tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Project' : 'Add Project'}>
        <div className="form-group">
          <label>Project Name</label>
          <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. ViewOnIT Phase 2" />
        </div>
        <div className="form-group">
          <label>Client</label>
          <input value={form.client} onChange={e => setForm(f=>({...f,client:e.target.value}))} placeholder="e.g. ACSI Group" />
        </div>
        <div className="form-group">
          <label>Assigned PM</label>
          <select value={form.pm} onChange={e => setForm(f=>({...f,pm:e.target.value}))}>
            <option value="">— No PM assigned —</option>
            {pms.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Project Type</label>
          <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
            <option>T &amp; Material</option>
            <option>Fixed Price</option>
            <option>Retainer</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Project'}</button>
        </div>
      </Modal>

{/* Custom confirmation modal for closing projects */}
<Modal open={!!targetProject} onClose={() => setTargetProject(null)} title={targetProject?.status === 'active' ? 'Close Project' : 'Reopen Project'}>
  <div style={{ marginBottom: 20, fontSize: 14, color: 'var(--text)' }}>
    Are you sure you want to {targetProject?.status === 'active' ? 'close' : 'reopen'} <strong>{targetProject?.name}</strong>?
    <br /><br />
    <span style={{ color: 'var(--text-muted)' }}>
      {targetProject?.status === 'active' 
        ? 'Project Managers will no longer be able to update its status.' 
        : 'Project Managers will once again be able to submit weekly updates for this project.'}
    </span>
  </div>
  <div className="modal-footer">
    <button className="btn btn-ghost" onClick={() => setTargetProject(null)}>Cancel</button>
    <button 
      className={targetProject?.status === 'active' ? 'btn btn-danger' : 'btn btn-primary'} 
      onClick={executeToggle}
    >
      Yes, {targetProject?.status === 'active' ? 'Close' : 'Reopen'} Project
    </button>
  </div>
</Modal>
    </>
  );
}
