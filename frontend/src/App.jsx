import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { RoleChip } from './components/UI.jsx';

// Pages
import LoginPage         from './pages/LoginPage.jsx';
import DashboardPage     from './pages/DashboardPage.jsx';
import HistoryPage       from './pages/HistoryPage.jsx';
import PMUpdatePage      from './pages/PMUpdatePage.jsx';
import ExecDetailPage    from './pages/ExecDetailPage.jsx';
import AdminProjectsPage from './pages/AdminProjectsPage.jsx';
import AdminUsersPage    from './pages/AdminUsersPage.jsx';
import AdminCommsPage    from './pages/AdminCommsPage.jsx';

// ── Route guard ───────────────────────────────────────────────────────────────
function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// ── Main app shell ─────────────────────────────────────────────────────────────
function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // 1. Add Theme State (defaults to dark, or whatever is saved)
  const [theme, setTheme] = React.useState(localStorage.getItem('rag_theme') || 'dark');

  // New state and location for mobile
  const location = useLocation(); // Add this
  const [navOpen, setNavOpen] = React.useState(false); // Add this

  // 2. Apply the theme to the HTML document and save it
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rag_theme', theme);
  }, [theme]);

  // Sidebar auto-close on navigation (for mobile)
  React.useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);


  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isPM  = user.role === 'pm';
  const isExec  = user.role === 'exec';

  return (
    <>
      <div className="topbar">
        {/* Hamburger button for mobile */}
      <button className="mobile-menu-btn" onClick={() => setNavOpen(!navOpen)}>☰</button>

        <div className="topbar-logo">⬡ RAG Tracker</div>
        <div className="user-badge">
          <span>{user.name}</span>
          <RoleChip role={user.role} />
        </div>
        
        {/* 3. Add the toggle button here */}
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} style={{ marginLeft: 'auto', marginRight: '8px' }}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>

        <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
          Sign out
        </button>
      </div>
      
      <div className="app-layout">
        {/* Dynamic class added here */}
      <nav className={`sidebar ${navOpen ? 'open' : ''}`}>
     
          {isPM && (
            <>
              <div className="nav-section">My Work</div>
              <NavLink to="/dashboard" className={({isActive}) => `nav-item${isActive?' active':''}`}>📊 <span>Dashboard</span></NavLink>
              <NavLink to="/update"    className={({isActive}) => `nav-item${isActive?' active':''}`}>✏️ <span>Update Status</span></NavLink>
              <NavLink to="/history"   className={({isActive}) => `nav-item${isActive?' active':''}`}>📅 <span>History</span></NavLink>
            </>
          )}
          {isExec && (
            <>
              <div className="nav-section">Executive View</div>
              <NavLink to="/dashboard" className={({isActive}) => `nav-item${isActive?' active':''}`}>📊 <span>Portfolio Summary</span></NavLink>
              <NavLink to="/detail"    className={({isActive}) => `nav-item${isActive?' active':''}`}>🔍 <span>Project Details</span></NavLink>
              <NavLink to="/history"   className={({isActive}) => `nav-item${isActive?' active':''}`}>📅 <span>History (6 months)</span></NavLink>
            </>
          )}
          {isAdmin && (
            <>
              <div className="nav-section">Admin</div>
              <NavLink to="/admin/projects" className={({isActive}) => `nav-item${isActive?' active':''}`}>⚙️ <span>Projects</span></NavLink>
              <NavLink to="/admin/users"    className={({isActive}) => `nav-item${isActive?' active':''}`}>👥 <span>Users & Access</span></NavLink>
              <NavLink to="/admin/comms"    className={({isActive}) => `nav-item${isActive?' active':''}`}>📧 <span>Communications</span></NavLink>
            </>
          )}
        </nav>

        <main className="main-content">
          <Routes>
            {/* PM */}
            <Route path="/dashboard" element={<RequireAuth roles={['pm','exec']}><DashboardPage /></RequireAuth>} />
            <Route path="/update"    element={<RequireAuth roles={['pm']}><PMUpdatePage /></RequireAuth>} />
            <Route path="/history"   element={<RequireAuth roles={['pm','exec']}><HistoryPage /></RequireAuth>} />
            <Route path="/detail"    element={<RequireAuth roles={['exec']}><ExecDetailPage /></RequireAuth>} />

            {/* Admin */}
            <Route path="/admin/projects" element={<RequireAuth roles={['admin']}><AdminProjectsPage /></RequireAuth>} />
            <Route path="/admin/users"    element={<RequireAuth roles={['admin']}><AdminUsersPage /></RequireAuth>} />
            <Route path="/admin/comms"    element={<RequireAuth roles={['admin']}><AdminCommsPage /></RequireAuth>} />

            {/* Default redirects by role */}
            <Route path="/" element={
              isAdmin ? <Navigate to="/admin/projects" replace /> :
              isPM    ? <Navigate to="/dashboard"      replace /> :
                        <Navigate to="/dashboard"      replace />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

// ── Root app ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <RequireAuthWrapper>
                <AppShell />
              </RequireAuthWrapper>
            } />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

function RequireAuthWrapper({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}
