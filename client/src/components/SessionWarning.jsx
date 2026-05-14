const MAROON = '#7B1B2E';

export default function SessionWarning({ secondsLeft, onStay, onLogout }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  const urgency = secondsLeft <= 30;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: urgency ? '#dc2626' : MAROON, padding: '1.25rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>⏳</div>
          <h2 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.05rem' }}>Session Expiring Soon</h2>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#555', margin: '0 0 1rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
            You've been inactive for a while. For your security, you will be signed out automatically.
          </p>

          {/* Countdown */}
          <div style={{
            fontSize: '2.5rem', fontWeight: 800,
            color: urgency ? '#dc2626' : MAROON,
            background: urgency ? '#fff5f5' : '#f5e8ea',
            borderRadius: '12px', padding: '0.75rem 1.5rem',
            display: 'inline-block', marginBottom: '1.25rem',
            minWidth: 100, textAlign: 'center',
          }}>
            {timeStr}
          </div>

          <p style={{ color: '#888', fontSize: '0.82rem', margin: '0 0 1.5rem' }}>
            Click <strong>Stay Signed In</strong> to continue your session.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onLogout}
              style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 600 }}
            >
              Sign Out
            </button>
            <button
              onClick={onStay}
              style={{ flex: 2, background: MAROON, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Stay Signed In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}