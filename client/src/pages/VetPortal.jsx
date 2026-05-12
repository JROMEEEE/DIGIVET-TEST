import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MAROON = '#7B1B2E';

export default function VetPortal() {
  const { fullName, logout } = useAuth();
  const navigate = useNavigate();
  const firstName = fullName.split(' ')[0];

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#555', fontSize: '0.88rem' }}>Dr. {fullName}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent', border: '1px solid #e0e0e0', borderRadius: '8px',
              padding: '0.45rem 1rem', fontSize: '0.85rem', cursor: 'pointer', color: '#555',
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>⚕️</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111', margin: '0 0 0.75rem' }}>
          Veterinarian Portal
        </h1>
        <p style={{ color: '#666', lineHeight: 1.75, fontSize: '0.95rem', margin: '0 0 2rem' }}>
          Welcome, Dr. {firstName}. The veterinarian management portal is currently in development.
          Full access to patient records, appointments, and vaccination logs is coming soon.
        </p>

        <div style={{
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px',
          padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontWeight: 700, color: '#111', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            Coming soon to Vet Portal
          </div>
          {[
            'Patient record management',
            'Vaccination scheduling & logging',
            'Barangay drive records',
            'Approval ID generation',
            'Pet registration review',
          ].map((item, i) => (
            <div key={item} style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.55rem 0',
              borderBottom: i < 4 ? '1px solid #f5f5f5' : 'none',
              fontSize: '0.88rem', color: '#555',
            }}>
              <span style={{ color: MAROON, fontWeight: 700, fontSize: '0.7rem' }}>○</span>
              {item}
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '1.5rem', padding: '0.9rem 1.25rem',
          background: '#fffbea', border: '1px solid #f0d080', borderRadius: '10px',
          fontSize: '0.83rem', color: '#7a5800', lineHeight: 1.5,
        }}>
          Your account is pending admin verification. You will receive an email once access is granted.
        </div>
      </div>
    </div>
  );
}
