const BASE = '/api';

function getToken() {
  return localStorage.getItem('rag_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.errors?.[0]?.msg || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password)   => request('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) }),
  me:    ()                  => request('/auth/me'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   (role)             => request(`/users${role ? `?role=${role}` : ''}`),
  pms:    ()                 => request('/users/pms'),
  create: (data)             => request('/users',      { method:'POST',   body: JSON.stringify(data) }),
  update: (id, data)         => request(`/users/${id}`,{ method:'PATCH',  body: JSON.stringify(data) }),
  remove: (id)               => request(`/users/${id}`,{ method:'DELETE' }),
};

// ── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list:   ()                 => request('/projects'),
  create: (data)             => request('/projects',      { method:'POST',   body: JSON.stringify(data) }),
  update: (id, data)         => request(`/projects/${id}`,{ method:'PATCH',  body: JSON.stringify(data) }),
  remove: (id)               => request(`/projects/${id}`,{ method:'DELETE' }),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  currentWeek: ()            => request('/reports/current-week'),
  history:     (projectId)   => request(`/reports/history/${projectId}`),
  list:        (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports${q ? `?${q}` : ''}`);
  },
  submit: (data)             => request('/reports', { method:'POST', body: JSON.stringify(data) }),
};

// ── Email ─────────────────────────────────────────────────────────────────────
export const emailApi = {
  sendDashboard: ()          => request('/email/send-dashboard',  { method:'POST' }),
  sendReminders: ()          => request('/email/send-reminders',  { method:'POST' }),
  recipients:    ()          => request('/email/recipients'),
};
