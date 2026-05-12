import { Link } from 'react-router-dom';

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Navbar */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 2.5rem', background: '#fff',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Logo mark */}
          <div style={{
            width: 38, height: 38, background: MAROON, borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.5px',
          }}>DV</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111', lineHeight: 1.1 }}>DIGIVET</div>
            <div style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Online System</div>
          </div>
          <span style={{
            marginLeft: '0.5rem', border: `1px solid ${MAROON}`, color: MAROON,
            fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
            letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>Beta</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#555', fontSize: '0.9rem' }}>Lipa City Veterinary Office</span>
          <Link to="/status" style={{
            background: MAROON, color: '#fff', padding: '0.5rem 1.25rem',
            borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem',
          }}>System Status</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{
        maxWidth: 1100, margin: '0 auto', padding: '5rem 2rem 3rem',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center',
      }}>
        {/* Left */}
        <div>
          <div style={{
            display: 'inline-block', background: MAROON_LIGHT, color: MAROON,
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.8px',
            textTransform: 'uppercase', padding: '5px 14px', borderRadius: '999px',
            marginBottom: '1.5rem',
          }}>
            Lipa City Veterinary Office · Online Portal
          </div>

          <h1 style={{ fontSize: '2.75rem', fontWeight: 800, lineHeight: 1.15, color: '#111', margin: '0 0 0.5rem' }}>
            Pet records,
          </h1>
          <h1 style={{ fontSize: '2.75rem', fontWeight: 800, lineHeight: 1.15, color: MAROON, margin: '0 0 1.5rem' }}>
            accessible anywhere.
          </h1>

          <p style={{ color: '#555', lineHeight: 1.75, fontSize: '1rem', maxWidth: 460, marginBottom: '2rem' }}>
            DIGIVET Online is the cloud portal for the Lipa City Veterinary Office — view synced
            vaccination records from field drives, manage pet registrations, and generate
            official approval IDs from any device with internet access.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/login" style={{
              background: MAROON, color: '#fff', padding: '0.7rem 1.5rem',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.92rem',
              transition: 'background 0.2s',
            }}
              onMouseOver={e => e.currentTarget.style.background = MAROON_DARK}
              onMouseOut={e => e.currentTarget.style.background = MAROON}
            >
              Sign in to portal
            </Link>
            <Link to="/register" style={{
              border: `2px solid ${MAROON}`, color: MAROON, padding: '0.7rem 1.5rem',
              borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.92rem',
              background: 'transparent',
            }}>
              Create account
            </Link>
          </div>

          <p style={{ marginTop: '1.75rem', color: '#aaa', fontSize: '0.8rem' }}>
            • Capstone project — Batangas State University, Lipa Campus
          </p>
        </div>

        {/* Right — sample sync card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SyncCard />
          <StatsRow />
        </div>
      </main>

      {/* Features strip */}
      <section style={{
        maxWidth: 1100, margin: '1rem auto 4rem', padding: '0 2rem',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem',
      }}>
        <FeatureCard
          icon="☁️"
          title="Cloud Sync"
          desc="Records encoded offline during barangay drives sync automatically when connected."
        />
        <FeatureCard
          icon="🆔"
          title="Approval IDs"
          desc="Generate and verify official vaccination approval IDs linked to pet records."
        />
        <FeatureCard
          icon="📋"
          title="Centralized Records"
          desc="All pet registrations and vaccination history in one searchable online dashboard."
        />
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #eee', padding: '1.25rem 2.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: '#aaa', fontSize: '0.8rem', background: '#fff',
      }}>
        <span>DIGIVET Online · Lipa City Veterinary Office</span>
        <Link to="/status" style={{ color: '#aaa', textDecoration: 'none' }}>System Status</Link>
      </footer>
    </div>
  );
}

function SyncCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: '14px', padding: '1.5rem',
      boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontWeight: 700, color: '#111' }}>Vaccination Record</span>
        <span style={{
          background: MAROON_LIGHT, color: MAROON, fontSize: '0.65rem',
          fontWeight: 700, padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.5px',
        }}>SYNCED</span>
      </div>
      {[
        ['Pet', 'Mango · Aspin · 3 yrs'],
        ['Owner', 'J. Reyes · Brgy. Anilao'],
        ['Vaccine', '✅ Anti-rabies'],
        ['Approval ID', 'AP-2026-4F3A2C1B'],
        ['Session', 'Brgy. Drive · May 8, 2026'],
      ].map(([label, value]) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.6rem 0', borderBottom: '1px solid #f5f5f5',
          fontSize: '0.88rem',
        }}>
          <span style={{ color: '#999' }}>{label}</span>
          <span style={{ color: '#111', fontWeight: 500 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function StatsRow() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
      {[
        { n: '1,240', label: 'Pets registered' },
        { n: '3,580', label: 'Vaccinations' },
        { n: '18', label: 'Barangays covered' },
      ].map(({ n, label }) => (
        <div key={label} style={{
          background: '#fff', borderRadius: '10px', padding: '0.9rem 1rem',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0',
          textAlign: 'center',
        }}>
          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: MAROON }}>{n}</div>
          <div style={{ fontSize: '0.72rem', color: '#999', marginTop: '2px' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem',
      border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontWeight: 700, color: '#111', marginBottom: '0.4rem' }}>{title}</div>
      <div style={{ color: '#777', fontSize: '0.85rem', lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

