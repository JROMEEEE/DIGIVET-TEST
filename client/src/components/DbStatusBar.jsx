import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function DbStatusBar() {
  const [status, setStatus]         = useState(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const res  = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' });
        const data = await res.json();
        if (alive) { setStatus(data); setUnreachable(false); }
      } catch {
        if (alive) setUnreachable(true);
      }
    }

    check();
    const id = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!status && !unreachable) return null;

  const conn = status?.checks?.supabase_connection;
  const ok   = unreachable ? false : conn?.ok;
  const dot  = ok === true ? '#22c55e' : ok === false ? '#ef4444' : '#d1d5db';
  const detail = unreachable
    ? 'Server unreachable'
    : ok === true
    ? `Connected · ${conn.message}`
    : (conn?.message ?? '—');

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.22rem 0.65rem', borderRadius: 6,
      background: ok === true ? '#f0fdf4' : '#f9fafb',
      border: `1px solid ${ok === true ? '#86efac' : '#e5e7eb'}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ fontWeight: 600, color: '#333', fontSize: '0.77rem' }}>Supabase</span>
      <span style={{ color: ok === false ? '#dc2626' : '#6b7280', fontSize: '0.73rem' }}>{detail}</span>
    </span>
  );
}
