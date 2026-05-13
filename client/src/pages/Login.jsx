import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

export default function Login() {
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]           = useState('password'); // 'password' | 'qr'
  const [form, setForm]         = useState({ email: '', password: '' });
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  function redirectByRole(role) {
    navigate(role === 'veterinarian' ? '/vet' : '/dashboard', { replace: true });
  }

  async function doLogin(email, password) {
    // 1. Supabase auth
    try {
      const user = await login({ email, password });
      return user?.user_metadata?.role ?? 'pet_owner';
    } catch { /* fall through */ }

    // 2. Local system accounts (user_profile)
    try {
      const res = await fetch('/api/auth/local-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          await supabase.auth.signInWithPassword({ email, password });
          await refreshUser();
          return data.role;
        }
      }
    } catch { /* fall through */ }

    // 3. OTP / access code
    try {
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        email, token: password, type: 'email',
      });
      if (!otpError && otpData?.user) {
        if (!otpData.user.user_metadata?.role) {
          await fetch('/api/auth/set-owner-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          }).catch(() => null);
        }
        await refreshUser();
        return (await supabase.auth.getSession()).data?.session?.user?.user_metadata?.role ?? 'pet_owner';
      }
    } catch { /* fall through */ }

    throw new Error('Invalid email or password. Please check your credentials and try again.');
  }

  // Password form submit
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const role = await doLogin(form.email, form.password);
      redirectByRole(role);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // QR scan handler — QR contains JSON { email, password }
  async function handleQrScan(decoded) {
    setError('');
    setSubmitting(true);
    try {
      const { email, password } = JSON.parse(decoded);
      const role = await doLogin(email, password);
      redirectByRole(role);
    } catch (err) {
      setError(err.message || 'QR code not recognised. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2.5rem', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div style={{ width: 38, height: 38, background: MAROON, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>DV</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111', lineHeight: 1.1 }}>DIGIVET</div>
            <div style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Online System</div>
          </div>
        </Link>
        <span style={{ color: '#555', fontSize: '0.9rem' }}>Lipa City Veterinary Office</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 69px)', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>

          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ width: 48, height: 48, background: MAROON, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1rem', margin: '0 auto 1rem' }}>DV</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: '0 0 0.4rem' }}>Welcome back</h1>
            <p style={{ color: '#777', fontSize: '0.88rem', margin: 0 }}>Sign in to your DIGIVET account</p>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f5f5f5', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem' }}>
            {[{ id: 'password', label: '🔑 Password' }, { id: 'qr', label: '📷 QR Code' }].map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setError(''); }} style={{
                border: 'none', borderRadius: '8px', padding: '0.55rem',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                background: tab === t.id ? '#fff' : 'transparent',
                color: tab === t.id ? MAROON : '#888',
                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          {/* Password tab */}
          {tab === 'password' && (
            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" style={{ display: 'none' }} aria-hidden="true" />
              <input type="password" style={{ display: 'none' }} aria-hidden="true" />
              <div>
                <label style={labelStyle}>Email address</label>
                <input type="email" required autoComplete="off" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" required autoComplete="new-password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" style={inputStyle} />
              </div>
              <button type="submit" disabled={submitting} style={{
                width: '100%', background: submitting ? '#b0b0b0' : MAROON,
                color: '#fff', border: 'none', borderRadius: '8px', padding: '0.8rem',
                fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '0.25rem',
              }}
                onMouseOver={e => { if (!submitting) e.currentTarget.style.background = MAROON_DARK; }}
                onMouseOut={e => { if (!submitting) e.currentTarget.style.background = submitting ? '#b0b0b0' : MAROON; }}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {/* QR tab */}
          {tab === 'qr' && (
            <QrLoginPanel onScan={handleQrScan} submitting={submitting} />
          )}

          <p style={{ textAlign: 'center', color: '#777', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            No account?{' '}
            <Link to="/register" style={{ color: MAROON, fontWeight: 600, textDecoration: 'none' }}>Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function QrLoginPanel({ onScan, submitting }) {
  const [scanning, setScanning]   = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const fileRef = useRef(null);

  if (submitting) {
    return <p style={{ textAlign: 'center', color: '#777', padding: '1.5rem 0' }}>Verifying QR code…</p>;
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-file-scanner');
      const decoded = await scanner.scanFile(file, false);
      onScan(decoded);
    } catch {
      setUploadErr('Could not read QR code from this image. Make sure it is a clear DIGIVET QR code.');
    } finally {
      // reset file input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Hidden div required by Html5Qrcode for file scanning */}
      <div id="qr-file-scanner" style={{ display: 'none' }} />

      {scanning ? (
        <QrScanner
          onScan={decoded => { setScanning(false); onScan(decoded); }}
          onClose={() => setScanning(false)}
        />
      ) : (
        <>
          <div style={{ background: MAROON_LIGHT, border: `1px solid ${MAROON}30`, borderRadius: '10px', padding: '1.1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>📷</div>
            <p style={{ color: MAROON, fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.2rem' }}>Login with your QR code</p>
            <p style={{ color: '#777', fontSize: '0.78rem', margin: 0 }}>Use the QR code image from your DIGIVET credentials email</p>
          </div>

          {uploadErr && (
            <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.65rem 1rem', fontSize: '0.83rem' }}>
              {uploadErr}
            </div>
          )}

          {/* Upload image */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="qr-upload-input"
            />
            <label htmlFor="qr-upload-input" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              width: '100%', boxSizing: 'border-box',
              background: MAROON, color: '#fff', borderRadius: '8px',
              padding: '0.8rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
            }}>
              📁 Upload QR Image
            </label>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
            <span style={{ color: '#aaa', fontSize: '0.78rem' }}>or use camera</span>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          </div>

          {/* Camera scan */}
          <button onClick={() => setScanning(true)} style={{
            width: '100%', background: 'transparent', border: `1.5px solid ${MAROON}`,
            color: MAROON, borderRadius: '8px', padding: '0.75rem',
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}>
            📷 Open Camera
          </button>
        </>
      )}
    </div>
  );
}

function QrScanner({ onScan, onClose }) {
  const [cameraError, setCameraError] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      const scanner = new Html5Qrcode('qr-login-box');
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        decoded => { scanner.stop().catch(() => {}); onScan(decoded); },
        () => {}
      ).catch(() => setCameraError('Camera access denied. Please allow camera permissions.'));

      return () => { scanner.isScanning && scanner.stop().catch(() => {}); };
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {cameraError
        ? <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>{cameraError}</div>
        : <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>Point your camera at your DIGIVET QR code</p>
      }
      <div id="qr-login-box" style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#000', minHeight: 240 }} />
      <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.7rem', fontSize: '0.88rem', cursor: 'pointer', color: '#555' }}>
        Cancel
      </button>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem' };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.9rem', outline: 'none', background: '#fafafa' };