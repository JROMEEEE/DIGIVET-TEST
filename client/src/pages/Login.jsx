import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(form);
      const role = user?.user_metadata?.role;
      navigate(role === 'veterinarian' ? '/vet' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 2.5rem', background: '#fff', borderBottom: '1px solid #f0f0f0',
      }}>
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
        <div style={{
          width: '100%', maxWidth: 420, background: '#fff', borderRadius: '16px',
          padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 48, height: 48, background: MAROON, borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '1rem', margin: '0 auto 1rem',
            }}>DV</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: '0 0 0.4rem' }}>Welcome back</h1>
            <p style={{ color: '#777', fontSize: '0.88rem', margin: 0 }}>Sign in to your DIGIVET account</p>
          </div>

          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000',
              borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginBottom: '1.25rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Email address</label>
              <input
                type="email" required autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password" required autoComplete="current-password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
            <button
              type="submit" disabled={submitting}
              style={{
                width: '100%', background: submitting ? '#b0b0b0' : MAROON,
                color: '#fff', border: 'none', borderRadius: '8px',
                padding: '0.8rem', fontWeight: 700, fontSize: '0.95rem',
                cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '0.25rem',
              }}
              onMouseOver={e => { if (!submitting) e.currentTarget.style.background = MAROON_DARK; }}
              onMouseOut={e => { if (!submitting) e.currentTarget.style.background = MAROON; }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#777', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            No account?{' '}
            <Link to="/register" style={{ color: MAROON, fontWeight: 600, textDecoration: 'none' }}>Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem',
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0e0e0',
  borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.9rem',
  outline: 'none', background: '#fafafa',
};
