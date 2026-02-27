import React, { useEffect } from 'react';

// ── RAG Badge ────────────────────────────────────────────────────────────────
export function RagBadge({ rag }) {
  const val = rag || 'NA';
  return (
    <span className={`rag-badge rag-${val}`}>
      <span className="rag-dot" />
      {val}
    </span>
  );
}

// ── Trend arrow ──────────────────────────────────────────────────────────────
export function TrendArrow({ cur, prev }) {
  const ord = { Green: 3, Amber: 2, Red: 1, NA: 0 };
  if (!prev || prev === 'NA' || cur === prev) return <span style={{ color: 'var(--text-muted)' }}>→</span>;
  if (ord[cur] > ord[prev]) return <span style={{ color: 'var(--green)' }}>↑</span>;
  return <span style={{ color: 'var(--red)' }}>↓</span>;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ text = 'Loading…' }) {
  return (
    <div className="loading-center">
      <div className="spinner" />
      {text}
    </div>
  );
}

// ── Role Chip ─────────────────────────────────────────────────────────────────
export function RoleChip({ role }) {
  const labels = { admin: 'Admin', pm: 'PM', exec: 'Exec' };
  return <span className={`role-chip role-${role}`}>{labels[role] || role}</span>;
}
