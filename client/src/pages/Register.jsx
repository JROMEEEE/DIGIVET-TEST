import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('pet_owner');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    setError('');
    setSubmitting(true);
    try {
      const data = await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role,
      });
      if (data.session) {
        navigate(role === 'veterinarian' ? '/vet' : '/dashboard', { replace: true });
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', background: '#fafafa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ fontWeight: 800, color: '#111', margin: '0 0 0.75rem' }}>Check your email</h2>
          <p style={{ color: '#666', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
            We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" style={{
            background: MAROON, color: '#fff', padding: '0.7rem 1.5rem',
            borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
          }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
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
          width: '100%', maxWidth: 460, background: '#fff', borderRadius: '16px',
          padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 48, height: 48, background: MAROON, borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '1rem', margin: '0 auto 1rem',
            }}>DV</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: '0 0 0.4rem' }}>Create account</h1>
            <p style={{ color: '#777', fontSize: '0.88rem', margin: 0 }}>Join the DIGIVET portal</p>
          </div>

          {/* Role selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {[
              { value: 'pet_owner', label: 'Pet Owner', icon: '🐾' },
              { value: 'veterinarian', label: 'Veterinarian', icon: '⚕️' },
            ].map(({ value, label, icon }) => (
              <button
                key={value} type="button"
                onClick={() => setRole(value)}
                style={{
                  border: role === value ? `2px solid ${MAROON}` : '2px solid #e0e0e0',
                  borderRadius: '10px', padding: '0.75rem', cursor: 'pointer',
                  background: role === value ? MAROON_LIGHT : '#fafafa',
                  color: role === value ? MAROON : '#555',
                  fontWeight: role === value ? 700 : 500,
                  fontSize: '0.88rem', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {role === 'veterinarian' && (
            <div style={{
              background: '#fffbea', border: '1px solid #f0d080', borderRadius: '8px',
              padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#7a5800',
              marginBottom: '1.25rem', lineHeight: 1.5,
            }}>
              Veterinarian accounts require admin verification before full access is granted.
            </div>
          )}

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
              <label style={labelStyle}>Full name</label>
              <input
                type="text" required
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Juan dela Cruz"
                style={inputStyle}
              />
            </div>
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
                type="password" required autoComplete="new-password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 6 characters"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password" required autoComplete="new-password"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repeat password"
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
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#777', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            Have an account?{' '}
            <Link to="/login" style={{ color: MAROON, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
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
