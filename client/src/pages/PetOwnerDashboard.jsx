import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return options.method ? null : [];
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!res.ok) return options.method ? null : [];
  return res.json();
}

const TOTAL_DOSES_REQUIRED = 3; // full vaccination series = 3 annual doses

function getVaccineStatus(lastDateStr, totalDoses = 0) {
  if (!lastDateStr || totalDoses === 0)
    return { label: 'No vaccination record', color: '#888', bg: '#f5f5f5', urgent: false, days: null };

  const last     = new Date(lastDateStr);
  const nextDue  = new Date(last);
  nextDue.setFullYear(nextDue.getFullYear() + 1);
  const today    = new Date();
  const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
  const doseLabel = totalDoses >= TOTAL_DOSES_REQUIRED
    ? 'Series complete'
    : `Dose ${totalDoses} of ${TOTAL_DOSES_REQUIRED}`;

  // Series fully complete — protection lasts until next annual due date
  if (totalDoses >= TOTAL_DOSES_REQUIRED) {
    if (daysUntil < 0)
      return { label: `Series expired — renewal overdue by ${Math.abs(daysUntil)} days`, color: '#fff', bg: '#dc2626', urgent: true, days: daysUntil };
    if (daysUntil <= 30)
      return { label: `Series renewal due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`, color: '#7a5800', bg: '#fef9c3', urgent: true, days: daysUntil };
    return { label: `Series complete — next renewal ${nextDue.toLocaleDateString()}`, color: '#166534', bg: '#dcfce7', urgent: false, days: daysUntil };
  }

  // Series still in progress (dose 1 or 2 of 3)
  if (daysUntil < 0)
    return { label: `${doseLabel} — overdue by ${Math.abs(daysUntil)} days`, color: '#fff', bg: '#dc2626', urgent: true, days: daysUntil };
  if (daysUntil <= 30)
    return { label: `${doseLabel} — due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`, color: '#7a5800', bg: '#fef9c3', urgent: true, days: daysUntil };
  if (daysUntil <= 90)
    return { label: `${doseLabel} — due in ${daysUntil} days`, color: '#1e40af', bg: '#dbeafe', urgent: false, days: daysUntil };
  return { label: `${doseLabel} — next dose ${nextDue.toLocaleDateString()}`, color: '#166534', bg: '#dcfce7', urgent: false, days: daysUntil };
}

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

export default function PetOwnerDashboard() {
  const { user, fullName, ownerId, logout } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets]             = useState([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [vaccinations, setVaccinations] = useState([]);
  const [editRequests, setEditRequests] = useState([]); // pending approval requests
  const [activeTab, setActiveTab]   = useState('overview');

  function loadPets() {
    setPetsLoading(true);
    apiFetch('/api/pets/mine')
      .then(data => setPets(data ?? []))
      .finally(() => setPetsLoading(false));
  }

  function loadVaccinations() {
    apiFetch('/api/pets/vaccinations')
      .then(data => setVaccinations(data ?? []));
  }

  function loadEditRequests() {
    apiFetch('/api/pets/edit-requests')
      .then(data => setEditRequests(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    loadPets();
    loadVaccinations();
    loadEditRequests();
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  const navItems = [
    { id: 'overview', icon: '⊞', label: 'Overview' },
    { id: 'records',  icon: '📋', label: 'Records' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f6fa' }}>

      {/* Sidebar */}
      <aside style={{ width: 230, background: MAROON, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10 }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.75rem' }}>DV</div>
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
            <div style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>Pet Owner</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'rgba(255,255,255,0.85)', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500 }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 230, flex: 1, padding: '2rem 2.5rem', minHeight: '100vh' }}>
        {activeTab === 'overview' && (
          <Overview pets={pets} petsLoading={petsLoading} fullName={fullName} setActiveTab={setActiveTab} vaccinations={vaccinations} />
        )}
        {activeTab === 'records' && (
          <Records pets={pets} petsLoading={petsLoading} onPetUpdated={() => { loadPets(); loadEditRequests(); }} vaccinations={vaccinations} editRequests={editRequests} />
        )}
      </main>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ pets, petsLoading, fullName, setActiveTab, vaccinations }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const urgent = vaccinations.filter(v => getVaccineStatus(v.last_vaccine_date, v.total_doses).urgent);

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>
          {greeting}, {fullName.split(' ')[0]}!
        </h1>
        <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>
          View and manage your pet records from here.
        </p>
      </div>

      {/* Vaccination Reminders — urgent alerts */}
      {urgent.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {urgent.map(v => {
            const status = getVaccineStatus(v.last_vaccine_date, v.total_doses);
            return (
              <div key={v.pet_id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: status.bg, borderRadius: '10px', padding: '0.9rem 1.25rem',
                marginBottom: '0.5rem', border: `1px solid ${status.days < 0 ? '#fca5a5' : '#fde68a'}`,
              }}>
                <span style={{ fontSize: '1.3rem' }}>{status.days < 0 ? '🚨' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: status.color, fontSize: '0.9rem' }}>{v.pet_name}</span>
                  <span style={{ color: status.color, fontSize: '0.88rem' }}>{' '}— {status.label}</span>
                  {v.last_vaccine_details && (
                    <span style={{ color: status.color, fontSize: '0.82rem' }}>{' '}· Last: {v.last_vaccine_details}</span>
                  )}
                </div>
                <button onClick={() => setActiveTab('records')} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', color: status.color, whiteSpace: 'nowrap' }}>
                  View Records
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Vaccination Schedule — all pets */}
      {vaccinations.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', margin: '0 0 1rem' }}>💉 Vaccination Schedule</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {vaccinations.map(v => {
              const status = getVaccineStatus(v.last_vaccine_date, v.total_doses);
              const nextDate = v.last_vaccine_date
                ? (() => { const d = new Date(v.last_vaccine_date); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString(); })()
                : '—';
              return (
                <div key={v.pet_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '1.2rem' }}>{v.pet_type?.toLowerCase().includes('cat') ? '🐱' : '🐶'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#111', fontSize: '0.9rem' }}>{v.pet_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.15rem' }}>
                      {v.last_vaccine_details
                        ? <span>Last vaccine: <strong>{v.last_vaccine_details}</strong> · Next due: <strong>{nextDate}</strong></span>
                        : <span style={{ color: '#aaa' }}>No vaccination record</span>
                      }
                    </div>
                  </div>
                  <span style={{ background: status.bg, color: status.color, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Registered Pets', value: petsLoading ? '…' : pets.length, icon: '🐾', sub: 'Total pets on file' },
          { label: 'Vaccinations',    value: '—', icon: '💉', sub: 'Coming soon' },
          { label: 'Approval IDs',    value: '—', icon: '🆔', sub: 'Coming soon' },
        ].map(({ label, value, icon, sub }) => (
          <div key={label} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: MAROON }}>{value}</div>
                <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.2rem' }}>{sub}</div>
              </div>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pet preview */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', margin: 0 }}>My Pets</h2>
          <button onClick={() => setActiveTab('records')} style={{ background: 'none', border: 'none', color: MAROON, fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            View records
          </button>
        </div>
        <PetList pets={pets} loading={petsLoading} compact />
      </div>
    </>
  );
}

// ── Records ───────────────────────────────────────────────────────────────────

function Records({ pets, petsLoading, onPetUpdated, vaccinations, editRequests }) {
  const [editing, setEditing] = useState(null);
  const vaccMap    = Object.fromEntries(vaccinations.map(v => [v.pet_id, v]));
  // Map pet_id → latest pending request (if any)
  const pendingMap = {};
  editRequests.filter(r => r.status === 'pending').forEach(r => {
    if (!pendingMap[r.pet_id]) pendingMap[r.pet_id] = r;
  });

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>Pet Records</h1>
        <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>
          Your registered pets. Edit requests require veterinarian approval before changes take effect.
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <PetList pets={pets} loading={petsLoading} onEdit={pet => setEditing(pet)} vaccMap={vaccMap} pendingMap={pendingMap} />
      </div>

      {editing && (
        <EditPetModal
          pet={editing}
          pendingRequest={pendingMap[editing.pet_id] ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onPetUpdated(); }}
        />
      )}
    </>
  );
}

// ── PetList ───────────────────────────────────────────────────────────────────

function PetList({ pets, loading, onEdit, compact = false, vaccMap = {}, pendingMap = {} }) {
  if (loading) {
    return <p style={{ color: '#aaa', fontSize: '0.88rem', textAlign: 'center', padding: '2.5rem', margin: 0 }}>Loading pets…</p>;
  }

  if (pets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🐾</div>
        <p style={{ fontWeight: 700, color: '#333', margin: '0 0 0.4rem', fontSize: '0.95rem' }}>No pets on record</p>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>Your registered pets will appear here once added by the Veterinary Office.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {pets.map(pet => (
          <div key={pet.pet_id} style={{ border: '1px solid #f0f0f0', borderRadius: '10px', padding: '1rem', background: MAROON_LIGHT }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{pet.pet_type?.toLowerCase().includes('cat') ? '🐱' : '🐶'}</div>
            <div style={{ fontWeight: 700, color: '#111', fontSize: '0.9rem' }}>{pet.pet_name}</div>
            <div style={{ color: '#777', fontSize: '0.78rem', marginTop: '0.2rem' }}>{[pet.pet_type, pet.pet_color].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
          {['Pet Name', 'Type', 'Color', 'Age', 'Next Vaccination', 'Status', ''].map(h => (
            <th key={h} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pets.map((pet, i) => (
          <tr key={pet.pet_id} style={{ borderBottom: i < pets.length - 1 ? '1px solid #f5f5f5' : 'none', transition: 'background 0.1s' }}
            onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
            onMouseOut={e => e.currentTarget.style.background = ''}
          >
            <td style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>{pet.pet_type?.toLowerCase().includes('cat') ? '🐱' : '🐶'}</span>
                <span style={{ fontWeight: 600, color: '#111', fontSize: '0.9rem' }}>{pet.pet_name}</span>
              </div>
            </td>
            <td style={{ padding: '1rem 1.25rem', color: '#555', fontSize: '0.88rem' }}>{pet.pet_type || '—'}</td>
            <td style={{ padding: '1rem 1.25rem', color: '#555', fontSize: '0.88rem' }}>{pet.pet_color || '—'}</td>
            <td style={{ padding: '1rem 1.25rem', color: '#555', fontSize: '0.88rem' }}>{pet.pet_age || '—'}</td>
            <td style={{ padding: '1rem 1.25rem' }}>
              {(() => {
                const vacc = vaccMap[pet.pet_id];
                const status = getVaccineStatus(vacc?.last_vaccine_date, vacc?.total_doses);
                const nextDate = vacc?.last_vaccine_date
                  ? (() => { const d = new Date(vacc.last_vaccine_date); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString(); })()
                  : null;
                return (
                  <div>
                    {vacc?.last_vaccine_details && (
                      <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600, marginBottom: '0.3rem' }}>
                        💉 {vacc.last_vaccine_details}
                      </div>
                    )}
                    <span style={{ background: status.bg, color: status.color, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {status.days < 0 ? '🚨 ' : status.days !== null && status.days <= 30 ? '⚠️ ' : '✓ '}{status.label}
                    </span>
                    {nextDate && (
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.3rem' }}>
                        Next: {nextDate}
                      </div>
                    )}
                  </div>
                );
              })()}
            </td>
            <td style={{ padding: '1rem 1.25rem' }}>
              {pendingMap[pet.pet_id] && (
                <span style={{ background: '#fef9c3', border: '1px solid #f0d080', color: '#7a5800', borderRadius: '999px', padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ⏳ Pending Approval
                </span>
              )}
            </td>
            <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
              <button
                onClick={() => onEdit(pet)}
                style={{ background: MAROON_LIGHT, border: `1px solid ${MAROON}30`, color: MAROON, borderRadius: '6px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {pendingMap[pet.pet_id] ? 'View Request' : 'Edit'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Edit Pet Modal ────────────────────────────────────────────────────────────

function EditPetModal({ pet, pendingRequest, onClose, onSaved }) {
  const initial = pendingRequest ?? pet;
  const [form, setForm] = useState({
    pet_name:  initial.pet_name  ?? '',
    pet_type:  initial.pet_type  ?? '',
    pet_color: initial.pet_color ?? '',
    pet_age:   initial.pet_age   ?? '',
  });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (!form.pet_name.trim()) return setError('Pet name is required.');
    setError('');
    setSaving(true);

    const res = await apiFetch('/api/pets/edit-request', {
      method: 'POST',
      body: JSON.stringify({ pet_id: pet.pet_id, ...form }),
    });

    setSaving(false);
    if (!res || res.error) {
      setError(res?.error || 'Failed to submit request. Please try again.');
      return;
    }
    setSuccess(true);
    setTimeout(() => { onSaved(); }, 1800);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontWeight: 800, color: '#111', margin: '0 0 0.2rem', fontSize: '1.1rem' }}>
              {pendingRequest ? 'Pending Edit Request' : 'Request Pet Info Edit'}
            </h2>
            <p style={{ color: '#888', fontSize: '0.82rem', margin: 0 }}>
              {pendingRequest ? 'This request is awaiting veterinarian approval.' : 'Changes require vet approval before taking effect.'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>

        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.88rem', marginBottom: '1.25rem', textAlign: 'center' }}>
            ✓ Edit request submitted! A veterinarian will review it shortly.
          </div>
        )}

        {pendingRequest && (
          <div style={{ background: '#fef9c3', border: '1px solid #f0d080', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#7a5800', marginBottom: '1.25rem' }}>
            ⏳ You already have a pending request for this pet. You can submit a new one to replace it.
          </div>
        )}

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Pet Name</label>
            <input value={form.pet_name} onChange={e => setForm(f => ({ ...f, pet_name: e.target.value }))} required style={inputStyle} placeholder="e.g. Mango" />
          </div>
          <div>
            <label style={labelStyle}>Type / Species</label>
            <input value={form.pet_type} onChange={e => setForm(f => ({ ...f, pet_type: e.target.value }))} style={inputStyle} placeholder="e.g. Dog, Cat, Aspin" />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <input value={form.pet_color} onChange={e => setForm(f => ({ ...f, pet_color: e.target.value }))} style={inputStyle} placeholder="e.g. Brown, Black and white" />
          </div>
          <div>
            <label style={labelStyle}>Age</label>
            <input value={form.pet_age} onChange={e => setForm(f => ({ ...f, pet_age: e.target.value }))} style={inputStyle} placeholder="e.g. 2 years" />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 500 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: saving ? '#b0b0b0' : MAROON, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
              onMouseOver={e => { if (!saving) e.currentTarget.style.background = MAROON_DARK; }}
              onMouseOut={e => { if (!saving) e.currentTarget.style.background = MAROON; }}
            >
              {saving ? 'Submitting…' : 'Submit Edit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


const labelStyle = { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem' };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.9rem', outline: 'none', background: '#fafafa' };