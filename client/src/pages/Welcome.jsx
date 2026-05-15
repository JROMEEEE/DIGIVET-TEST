import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MAROON       = '#7B1B2E';
const MAROON_DARK  = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

export default function Welcome() {
  const navigate = useNavigate();
  const [creds, setCreds]   = useState(null);
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) { setError('No credentials found in this link. It may have already been used.'); return; }
    try {
      // base64url → base64 → JSON
      const json = atob(hash.replace(/-/g, '+').replace(/_/g, '/'));
      setCreds(JSON.parse(json));
    } catch {
      setError('This link is invalid or has expired. Please contact the Lipa City Veterinary Office.');
    }
  }, []);

  function copy() {
    if (!creds) return;
    navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '1.5rem' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: MAROON, padding: '2rem 1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#fff', color: MAROON, fontWeight: 800, fontSize: '1rem', padding: '8px 18px', borderRadius: 8, marginBottom: '1rem' }}>DIGIVET Online</div>
          <h1 style={{ color: '#fff', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            {creds ? `Welcome, ${creds.name}!` : 'Your Account'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: 0 }}>
            {creds ? 'Your login credentials are ready' : 'Lipa City Veterinary Office'}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem 1.5rem' }}>
          {error ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 8px' }}>Link unavailable</p>
              <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>{error}</p>
              <button onClick={() => navigate('/login')} style={{ background: MAROON, color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Go to Login
              </button>
            </div>
          ) : !creds ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.88rem' }}>Loading…</p>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
                Your DIGIVET pet owner account is ready. Save these credentials — you'll need them to log in.
              </p>

              {/* Credentials box */}
              <div style={{ background: MAROON_LIGHT, borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 2px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>Your Login Credentials</p>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Email</span>
                    <span style={{ fontWeight: 600, color: '#111' }}>{creds.email}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(123,27,46,0.12)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Password</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1rem', background: '#fff', padding: '3px 12px', borderRadius: 6, letterSpacing: 1, color: MAROON, fontWeight: 700 }}>{creds.password}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={copy}
                  style={{ flex: 1, background: copied ? '#16a34a' : '#f3f4f6', color: copied ? '#fff' : '#374151', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  {copied ? '✓ Copied' : 'Copy Credentials'}
                </button>
                <button onClick={() => navigate('/login')}
                  style={{ flex: 2, background: MAROON, color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseOver={e => e.currentTarget.style.background = MAROON_DARK}
                  onMouseOut={e => e.currentTarget.style.background = MAROON}
                >
                  Sign in to DIGIVET →
                </button>
              </div>

              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
                Keep your password private. Contact the Lipa City Veterinary Office if you need assistance.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
