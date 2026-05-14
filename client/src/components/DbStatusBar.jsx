import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function Dot({ ok }) {
  const color = ok === true ? '#22c55e' : ok === false ? '#ef4444' : '#d1d5db';
  return (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
  );
}

function DbChip({ label, detail, ok, isActive }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.22rem 0.65rem', borderRadius: '6px',
      background: isActive ? '#f0fdf4' : '#f9fafb',
      border: `1px solid ${isActive ? '#86efac' : '#e5e7eb'}`,
      whiteSpace: 'nowrap',
    }}>
      <Dot ok={ok} />
      <span style={{ fontWeight: isActive ? 700 : 500, color: '#333', fontSize: '0.77rem' }}>{label}</span>
      {detail && (
        <span style={{ color: ok === false ? '#dc2626' : '#888', fontSize: '0.73rem' }}>
          {ok === true ? `${detail}` : detail}
        </span>
      )}
      {isActive && (
        <span style={{ background: '#dcfce7', color: '#166534', fontSize: '0.67rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', marginLeft: '0.1rem' }}>
          ACTIVE
        </span>
      )}
    </span>
  );
}

export default function DbStatusBar() {
  const [status, setStatus]   = useState(null);
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

  const supabase   = status?.checks?.supabase_connection;
  const localDb    = status?.checks?.local_db;
  const src        = status?.data_source;
  const hasLocalDb = localDb && localDb.ok !== null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#bbb', letterSpacing: '0.5px', textTransform: 'uppercase', marginRight: '0.15rem' }}>
        DB
      </span>

      {unreachable ? (
        <DbChip label="API server" detail="unreachable — check server/.env and that the server is running" ok={false} />
      ) : (
        <>
          <DbChip
            label="Supabase (Online)"
            detail={supabase?.ok ? `connected · ${supabase.message}` : supabase?.message}
            ok={supabase?.ok}
            isActive={src === 'supabase'}
          />
          {hasLocalDb && (
            <DbChip
              label="Local PostgreSQL"
              detail={localDb.ok === true ? `connected · ${localDb.message}` : localDb.ok === false ? localDb.message : 'not configured'}
              ok={localDb.ok}
              isActive={src === 'local'}
            />
          )}
        </>
      )}
    </div>
  );
}
