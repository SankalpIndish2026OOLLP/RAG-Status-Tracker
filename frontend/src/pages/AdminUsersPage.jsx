import React, { useState, useEffect } from 'react';
import { usersApi, projectsApi } from '../utils/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { Modal, RoleChip, Spinner } from '../components/UI.jsx';

const ROLE_LABELS = { pm: 'Project Manager', exec: 'Executive', admin: 'Admin' };
const EMPTY_FORM  = { name:'', email:'', password:'', role:'pm' };

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users,    setUsers]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);

  const [userToRemove, setUserToRemove] = useState(null); // Add this line

  useEffect(() => {
    Promise.all([usersApi.list(), projectsApi.list()])
      .then(([us, ps]) => { setUsers(us); setProjects(ps); })
      .finally(() => setLoading(false));
  }, []);

  function openAdd(role) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role });
    setModal(true);
  }
  function openEdit(u) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password:'', role: u.role });
    setModal(true);
  }

  async function save() {
    if (!form.name || !form.email) { toast('Name and email required', 'danger'); return; }
    if (!editing && !form.password) { toast('Password required for new users', 'danger'); return; }
    setSaving(true);
    try {
      const payload = { name:form.name, email:form.email, role:form.role };
      if (form.password) payload.password = form.password;
      if (editing) {
        const updated = await usersApi.update(editing._id, payload);
        setUsers(prev => prev.map(u => u._id === editing._id ? updated : u));
        toast(`${ROLE_LABELS[form.role]} updated ✓`, 'success');
      } else {
        payload.password = form.password;
        const created = await usersApi.create(payload);
        setUsers(prev => [...prev, created]);
        toast(`${ROLE_LABELS[form.role]} added ✓`, 'success');
      }
      setModal(false);
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  }

  function initiateRemove(u) {
    if (u._id === me._id) { 
      toast("You can't remove your own account", 'danger'); 
      return; 
    }
    setUserToRemove(u);
  }

  async function executeRemove() {
    if (!userToRemove) return;
    try {
      await usersApi.remove(userToRemove._id);
      setUsers(prev => prev.filter(x => x._id !== userToRemove._id));
      // Unassign locally
      setProjects(prev => prev.map(p => p.pm?._id === userToRemove._id ? { ...p, pm: null } : p));
      toast(`${userToRemove.name} removed`, 'info');
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setUserToRemove(null);
    }
  }

  if (loading) return <Spinner />;

  const pms    = users.filter(u => u.role === 'pm');
  const execs  = users.filter(u => u.role === 'exec');
  const admins = users.filter(u => u.role === 'admin');

  function UserCard({ u }) {
    const myProjs  = projects.filter(p => p.pm?._id === u._id && p.status === 'active');
    const isSelf   = u._id === me._id;
    return (
      <div className="user-list-item">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="name">
            {u.name} <RoleChip role={u.role} />
            {isSelf && <span style={{ fontSize:11, color:'var(--accent)', marginLeft:6 }}>(you)</span>}
          </div>
          <div className="email">{u.email}</div>
          {myProjs.length > 0 && (
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
              {myProjs.length} project{myProjs.length>1?'s':''}: {myProjs.map(p=>p.name).join(', ')}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
          {!isSelf && <button className="btn btn-danger btn-sm" onClick={() => initiateRemove(u)}>Remove</button>}
        </div>
      </div>
    );
  }

  function Section({ title, role, icon, list }) {
    return (
      <div className="card">
        <div className="section-header" style={{ marginBottom:12 }}>
          <div className="card-title" style={{ margin:0 }}>{icon} {title}</div>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd(role)}>+ Add {ROLE_LABELS[role]}</button>
        </div>
        {list.length === 0
          ? <p style={{ color:'var(--text-muted)', fontSize:13, padding:'4px 0' }}>No {title.toLowerCase()} yet.</p>
          : list.map(u => <UserCard key={u._id} u={u} />)
        }
      </div>
    );
  }

  return (
    <>
      <div className="panel-title">Users & Access</div>
      <div className="panel-sub">Add or remove Project Managers, Executives, and Admins</div>
      <Section title="Project Managers" role="pm"    icon="👤" list={pms} />
      <Section title="Executives"       role="exec"  icon="👔" list={execs} />
      <Section title="Admins"           role="admin" icon="🔧" list={admins} />

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${ROLE_LABELS[form.role]}` : `Add ${ROLE_LABELS[form.role]}`}>
        <div className="form-group">
          <label>Full Name</label>
          <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Jane Smith" />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="jane@company.com" />
        </div>
        <div className="form-group">
          <label>
            Password{' '}
            {editing && <span style={{ fontSize:10, color:'var(--text-muted)', textTransform:'none', letterSpacing:0 }}>(leave blank to keep current)</span>}
          </label>
          <input type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder={editing ? '••••••••' : 'Set a password'} />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
            <option value="pm">Project Manager</option>
            <option value="exec">Executive</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save User'}</button>
        </div>
      </Modal>

      {userToRemove && (() => {
        const activeProjs = projects.filter(p => p.pm?._id === userToRemove._id && p.status === 'active');
        return (
          <Modal open={!!userToRemove} onClose={() => setUserToRemove(null)} title="Remove User">
            <div style={{ marginBottom: 20, fontSize: 14, color: 'var(--text)' }}>
              Are you sure you want to remove <strong>{userToRemove.name}</strong>?
              {activeProjs.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--amber-bg)', border: '1px solid rgba(210,153,34,0.3)', borderRadius: 8, color: 'var(--amber)' }}>
                  <strong>⚠️ Warning:</strong> This user is assigned to {activeProjs.length} active project(s): {activeProjs.map(p => p.name).join(', ')}.
                  <br /><br />
                  These projects will become unassigned.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setUserToRemove(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={executeRemove}>Yes, Remove User</button>
            </div>
          </Modal>
        );
      })()}
    </>
  );
}
