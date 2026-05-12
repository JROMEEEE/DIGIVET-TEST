import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const CHECK_LABELS = {
  server: 'Express Server',
  environment: 'Environment',
  supabase_url: 'Supabase URL',
  supabase_key: 'Supabase Service Key',
  supabase_connection: 'Supabase Connection',
};

function Badge({ ok }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 700,
      background: ok ? '#dcfce7' : '#fee2e2',
      color: ok ? '#166534' : '#991b1b',
    }}>
      {ok ? 'PASS' : 'FAIL'}
    </span>
  );
}

export default function StatusCheck() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = () => {
    setLoading(true);
    setError(null);
    apiFetch('/api/status')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { run(); }, []);

  const overall = data?.status === 'ok';

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '3rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>DIGIVET Deployment Check</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Verifies that the server, environment variables, and Supabase connection are all working.
      </p>

      {loading && <p style={{ color: '#6b7280' }}>Running checks...</p>}

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong>Could not reach the API server.</strong>
          <pre style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>{error}</pre>
        </div>
      )}

      {data && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem',
            background: overall ? '#f0fdf4' : '#fff7ed',
            border: `1px solid ${overall ? '#bbf7d0' : '#fed7aa'}`,
          }}>
            <span style={{ fontSize: '1.5rem' }}>{overall ? '✅' : '⚠️'}</span>
            <div>
              <strong style={{ color: overall ? '#166534' : '#92400e' }}>
                {overall ? 'All checks passed' : 'Some checks failed'}
              </strong>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{data.timestamp}</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#374151' }}>Check</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#374151' }}>Result</th>
                <th style={{ padding: '0.5rem 0.75rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.checks).map(([key, val]) => (
                <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#374151' }}>
                    {CHECK_LABELS[key] ?? key}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {val.message}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                    <Badge ok={val.ok} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <button
        onClick={run}
        disabled={loading}
        style={{
          marginTop: '1.5rem', padding: '0.5rem 1.25rem',
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1, fontSize: '0.9rem',
        }}
      >
        {loading ? 'Checking...' : 'Re-run checks'}
      </button>
    </div>
  );
}
