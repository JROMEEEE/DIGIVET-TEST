import { useState } from 'react';
import { supabase } from '../lib/supabase';

const MAROON      = '#7B1B2E';
const MAROON_DARK = '#5a1221';

export default function ChangePasswordModal({ onClose, forced = false, onSuccess }) {
  const [form, setForm]         = useState({ newPassword: '', confirmPassword: '' });
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError('Passwords do not match.');
    }
    setError('');
    setSaving(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: form.newPassword,
        data: { must_change_password: false },
      });
      if (updateErr) throw updateErr;
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = (key) => ({
    width: '100%',
    boxSizing: 'border-box',
    border: `2px solid ${focused === key ? MAROON : '#e5e7eb'}`,
    borderRadius: '10px',
    padding: '0.7rem 1rem',
    fontSize: '0.92rem',
    outline: 'none',
    background: focused === key ? '#fff' : '#f9fafb',
    color: '#111',
    transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'inherit',
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => { if (!forced && e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: MAROON, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontWeight: 800, color: '#fff', margin: '0 0 0.15rem', fontSize: '1.05rem' }}>
              {forced ? 'Set Your Password' : 'Change Password'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0, fontSize: '0.78rem' }}>
              {forced ? 'Required before accessing your account' : 'Set a new password for your account'}
            </p>
          </div>
          {!forced && (
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1rem' }}>✕</button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
              <p style={{ fontWeight: 700, color: '#166534', margin: '0 0 0.3rem' }}>Password updated!</p>
              <p style={{ color: '#777', fontSize: '0.85rem', margin: 0 }}>Taking you to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {forced && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.84rem', color: '#92400e', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔐</span>
                  <span>Your account was set up with a temporary password. Please create a personal password to continue.</span>
                </div>
              )}

              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  ⚠️ {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  New Password <span style={{ color: MAROON }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  onFocus={() => setFocused('new')}
                  onBlur={() => setFocused('')}
                  placeholder="Minimum 6 characters"
                  style={inputStyle('new')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Confirm Password <span style={{ color: MAROON }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused('')}
                  placeholder="Repeat new password"
                  style={inputStyle('confirm')}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                {!forced && (
                  <button type="button" onClick={onClose}
                    style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 600 }}>
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={saving}
                  style={{ flex: 2, background: saving ? '#d1d5db' : MAROON, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                  onMouseOver={e => { if (!saving) e.currentTarget.style.background = MAROON_DARK; }}
                  onMouseOut={e => { if (!saving) e.currentTarget.style.background = saving ? '#d1d5db' : MAROON; }}
                >
                  {saving ? 'Saving…' : forced ? 'Set Password & Continue' : '✓ Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}