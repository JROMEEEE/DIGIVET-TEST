import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';

const MAROON      = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const API_BASE    = import.meta.env.VITE_API_URL || '';

export default function Welcome() {
  const navigate        = useNavigate();
  const [creds, setCreds]     = useState(null);
  const [qrDataUrl, setQr]    = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const fetchedRef            = useRef(false);

  useEffect(() => {
    // Supabase appends #access_token=...&refresh_token=...&type=invite to the URL.
    // The client library picks these up automatically via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (fetchedRef.current) return;
      if (!session) return;

      fetchedRef.current = true;

      try {
        const res  = await fetch(`${API_BASE}/api/auth/my-credentials`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Credentials not found. They may have already been viewed or the link expired.');
          setLoading(false);
          return;
        }

        setCreds(data);

        // Generate QR code for quick login
        const qr = await QRCode.toDataURL(
          JSON.stringify({ email: data.email, password: data.password }),
          { width: 200, margin: 2 }
        );
        setQr(qr);
      } catch (err) {
        setError('Could not load credentials. Please contact the Lipa City Veterinary Office.');
      } finally {
        setLoading(false);
      }
    });

    // Also check existing session (in case event already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !fetchedRef.current) {
        fetchedRef.current = true;
        fetch(`${API_BASE}/api/auth/my-credentials`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then(r => r.json())
          .then(async data => {
            if (data.error) { setError(data.error); setLoading(false); return; }
            setCreds(data);
            const qr = await QRCode.toDataURL(
              JSON.stringify({ email: data.email, password: data.password }),
              { width: 200, margin: 2 }
            );
            setQr(qr);
            setLoading(false);
          })
          .catch(() => { setError('Could not load credentials.'); setLoading(false); });
      } else if (!session) {
        // No session yet — wait for onAuthStateChange (Supabase is processing the invite token)
        setTimeout(() => {
          if (!fetchedRef.current) {
            setError('Session could not be established. The link may have expired — please request new credentials.');
            setLoading(false);
          }
        }, 8000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function copy() {
    if (!creds) return;
    navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '1.5rem' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 500, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: MAROON, padding: '2rem 1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#fff', color: MAROON, fontWeight: 800, fontSize: '1rem', padding: '8px 18px', borderRadius: 8, marginBottom: '1rem' }}>
            DIGIVET Online
          </div>
          <h1 style={{ color: '#fff', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            {creds ? `Hello, ${creds.name}!` : 'Your Account'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: 0 }}>
            Your pet owner account has been created on the{' '}
            <strong style={{ color: '#fff' }}>DIGIVET Online Portal</strong>{' '}
            of the Lipa City Veterinary Office.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem 1.5rem' }}>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: 32, height: 32, border: `3px solid #f5e8ea`, borderTopColor: MAROON, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', marginBottom: 12 }} />
              <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0 }}>Setting up your account…</p>
            </div>

          ) : error ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 8px' }}>Link unavailable</p>
              <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>{error}</p>
              <button onClick={() => navigate('/login')}
                style={{ background: MAROON, color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Go to Login
              </button>
            </div>

          ) : creds ? (
            <>
              {/* Credentials box */}
              <div style={{ background: '#f5e8ea', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 10px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>Your Login Credentials</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Email</span>
                    <span style={{ fontWeight: 600, color: '#111' }}>{creds.email}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(123,27,46,0.15)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Password</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1rem', background: '#fff', padding: '3px 12px', borderRadius: 6, letterSpacing: 1, color: MAROON, fontWeight: 700 }}>
                      {creds.password}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR code */}
              {qrDataUrl && (
                <div style={{ textAlign: 'center', background: '#fafafa', border: '1px solid #eee', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <p style={{ color: '#555', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 4px' }}>Quick Login — Scan this QR Code</p>
                  <p style={{ color: '#888', fontSize: '0.76rem', margin: '0 0 14px' }}>
                    Open the DIGIVET login page, tap <strong>QR Code</strong> tab, then scan below
                  </p>
                  <img src={qrDataUrl} alt="Login QR Code" width={180} height={180}
                    style={{ border: `4px solid ${MAROON}`, borderRadius: 10, display: 'block', margin: '0 auto' }} />
                  <p style={{ color: '#aaa', fontSize: '0.72rem', margin: '10px 0 0' }}>
                    Screenshot or print this QR code and keep it safe
                  </p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
                <button onClick={copy}
                  style={{ flex: 1, background: copied ? '#16a34a' : '#f3f4f6', color: copied ? '#fff' : '#374151', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  {copied ? '✓ Copied' : 'Copy Credentials'}
                </button>
                <button onClick={() => navigate('/login')}
                  style={{ flex: 2, background: MAROON, color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseOver={e => e.currentTarget.style.background = MAROON_DARK}
                  onMouseOut={e => e.currentTarget.style.background = MAROON}
                >
                  Sign In to DIGIVET →
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
                Keep your password and QR code private. Contact the Lipa City Veterinary Office if you need help.
              </p>
            </>
          ) : null}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
