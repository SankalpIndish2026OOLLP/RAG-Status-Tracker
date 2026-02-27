import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  // Add these lines for the theme toggle:
  const [theme, setTheme] = useState(localStorage.getItem('rag_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rag_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const user = await login(email, pass);
      navigate(user.role === 'admin' ? '/admin/projects' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  function fill(e, p) { setEmail(e); setPass(p); }

  return (
    <div className="auth-screen">
    {/* Add this new button right here */}
      <button 
        className="btn btn-ghost btn-sm" 
        onClick={toggleTheme} 
        style={{ position: 'absolute', top: 20, right: 20 }}
      >
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div className="auth-card">
        <div className="auth-logo">⬡ RAG Tracker</div>
        <div className="auth-subtitle">Project Health Monitoring Platform</div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary btn-full" type="submit" style={{ marginTop: 8 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-demo">
          <p>Demo accounts — click to auto-fill:</p>
          <button className="demo-user-btn" onClick={() => fill('admin@ee.com','admin123')}>🔧 Admin <span>admin@ee.com</span></button>
          <button className="demo-user-btn" onClick={() => fill('jasmine@ee.com','pm123')}>👤 PM — Jasmine Hakim <span>jasmine@ee.com</span></button>
          <button className="demo-user-btn" onClick={() => fill('hina@ee.com','pm123')}>👤 PM — Hina Mundhwa <span>hina@ee.com</span></button>
          <button className="demo-user-btn" onClick={() => fill('ronnit@ee.com','pm123')}>👤 PM — Ronnit Samuel <span>ronnit@ee.com</span></button>
          <button className="demo-user-btn" onClick={() => fill('exec@ee.com','exec123')}>👔 Executive <span>exec@ee.com</span></button>
        </div>
      </div>
    </div>
  );
}
