import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

export default function PetOwnerDashboard() {
  const { user, fullName, logout } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    supabase
      .from('pets')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPets(data ?? []);
        setPetsLoading(false);
      });
  }, [user.id]);

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  const navItems = [
    { id: 'overview', icon: '⊞', label: 'Overview' },
    { id: 'pets', icon: '🐾', label: 'My Pets' },
    { id: 'appointments', icon: '📅', label: 'Appointments' },
    { id: 'records', icon: '📋', label: 'Records' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f6fa' }}>

      {/* Sidebar */}
      <aside style={{
        width: 230, background: MAROON, display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10,
      }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 32, height: 32, background: 'rgba(255,255,255,0.15)',
              borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '0.75rem',
            }}>DV</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', lineHeight: 1.1 }}>DIGIVET</div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Online System</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {navItems.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1.25rem',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none',
                borderLeft: activeTab === tab.id ? '3px solid #fff' : '3px solid transparent',
                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.7)',
                fontSize: '0.88rem', fontWeight: activeTab === tab.id ? 700 : 400,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 30, height: 30, background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
            }}>
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fullName}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>Pet Owner</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
              color: 'rgba(255,255,255,0.85)', padding: '0.5rem',
              fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 230, flex: 1, padding: '2rem 2.5rem', minHeight: '100vh' }}>
        {activeTab === 'overview' && (
          <Overview pets={pets} petsLoading={petsLoading} fullName={fullName} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'pets' && (
          <MyPets pets={pets} petsLoading={petsLoading} />
        )}
        {activeTab === 'appointments' && (
          <ComingSoon icon="📅" title="Appointments" desc="Book and manage veterinary appointments. Your upcoming and past schedules will appear here." />
        )}
        {activeTab === 'records' && (
          <ComingSoon icon="📋" title="Vaccination Records" desc="View official vaccination history and approval IDs issued to your pets." />
        )}
      </main>
    </div>
  );
}

function Overview({ pets, petsLoading, fullName, setActiveTab }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = fullName.split(' ')[0];

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>
          {greeting}, {firstName}!
        </h1>
        <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>
          Manage your pets and vaccination records from here.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Registered Pets', value: petsLoading ? '…' : pets.length, icon: '🐾', sub: 'Total pets in system' },
          { label: 'Vaccinations', value: '—', icon: '💉', sub: 'Coming soon' },
          { label: 'Approval IDs', value: '—', icon: '🆔', sub: 'Coming soon' },
        ].map(({ label, value, icon, sub }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem',
            border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: MAROON }}>{value}</div>
                <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.2rem' }}>{sub}</div>
              </div>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.5rem',
        border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', margin: '0 0 1rem' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { icon: '➕', label: 'Register a Pet', tab: 'pets' },
            { icon: '📅', label: 'Book Appointment', tab: 'appointments' },
            { icon: '📋', label: 'View Records', tab: 'records' },
          ].map(({ icon, label, tab }) => (
            <button
              key={label}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                padding: '1rem', background: MAROON_LIGHT,
                border: `1px solid ${MAROON}20`, borderRadius: '10px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: MAROON,
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pets preview */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.5rem',
        border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', margin: 0 }}>My Pets</h2>
          <button
            onClick={() => setActiveTab('pets')}
            style={{ background: 'none', border: 'none', color: MAROON, fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            View all
          </button>
        </div>
        <PetGrid pets={pets} loading={petsLoading} />
      </div>
    </>
  );
}

function MyPets({ pets, petsLoading }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>My Pets</h1>
          <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>All your registered pets in one place.</p>
        </div>
        <button style={{
          background: MAROON, color: '#fff', border: 'none', borderRadius: '8px',
          padding: '0.65rem 1.25rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
        }}>
          + Register a Pet
        </button>
      </div>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.5rem',
        border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}>
        <PetGrid pets={pets} loading={petsLoading} />
      </div>
    </>
  );
}

function PetGrid({ pets, loading }) {
  if (loading) {
    return (
      <p style={{ color: '#aaa', fontSize: '0.88rem', textAlign: 'center', padding: '2rem', margin: 0 }}>
        Loading pets…
      </p>
    );
  }

  if (pets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🐾</div>
        <p style={{ fontWeight: 700, color: '#333', margin: '0 0 0.4rem', fontSize: '0.95rem' }}>
          No pets registered yet
        </p>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
          Register your first pet to view their records and vaccination history.
        </p>
        <button style={{
          background: MAROON, color: '#fff', border: 'none', borderRadius: '8px',
          padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
        }}>
          Register a Pet
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
      {pets.map(pet => (
        <div key={pet.id} style={{
          border: '1px solid #f0f0f0', borderRadius: '10px', padding: '1.25rem',
          background: MAROON_LIGHT, cursor: 'pointer',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {pet.species === 'cat' ? '🐱' : '🐶'}
          </div>
          <div style={{ fontWeight: 700, color: '#111', fontSize: '0.95rem' }}>{pet.name}</div>
          <div style={{ color: '#777', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {[pet.species, pet.breed].filter(Boolean).join(' · ')}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComingSoon({ icon, title, desc }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      <h2 style={{ fontWeight: 800, color: '#111', margin: '0 0 0.5rem', fontSize: '1.4rem' }}>{title}</h2>
      <p style={{ color: '#777', maxWidth: 380, lineHeight: 1.7, fontSize: '0.9rem', margin: '0 0 1.25rem' }}>{desc}</p>
      <div style={{
        padding: '0.4rem 1rem', background: '#f0f0f0', borderRadius: '999px',
        fontSize: '0.75rem', color: '#888', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase',
      }}>
        Coming Soon
      </div>
    </div>
  );
}
