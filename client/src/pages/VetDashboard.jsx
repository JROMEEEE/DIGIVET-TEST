import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ChangePasswordModal from '../components/ChangePasswordModal';
import useSessionTimeout from '../hooks/useSessionTimeout';
import SessionWarning from '../components/SessionWarning';
import DbStatusBar from '../components/DbStatusBar';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function authFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...options.headers },
  });
}

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

// ── Data fetching via backend (bypasses RLS) ──────────────────────────────────

async function fetchTable(table) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error(`No session — not logged in (table: ${table})`);
  const res = await fetch(`${API_BASE}/api/vetdata/${table}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${res.status} on ${table}: ${body.error ?? res.statusText}`);
  }
  return res.json();
}

function useVetTable(table, reloadKey = 0) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTable(table)
      .then(data => { setRows(data ?? []); setLoading(false); })
      .catch(err => { console.error('[useVetTable]', err.message); setLoading(false); });
  }, [table, reloadKey]);

  return { rows, loading };
}

function buildMap(rows, keyCol, valCol) {
  return Object.fromEntries((rows ?? []).map(r => [r[keyCol], r[valCol]]));
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function VetDashboard() {
  const { fullName, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Reference lookup tables shared across all tabs
  const { rows: barangays } = useVetTable('barangay_table');
  const { rows: vets }      = useVetTable('vet_table');
  const { rows: owners }    = useVetTable('owner_table');
  const { rows: allPets }   = useVetTable('pet_table');

  const refs = {
    barangayMap: buildMap(barangays, 'barangay_id', 'barangay_name'),
    vetMap:      buildMap(vets,      'vet_id',      'vet_name'),
    ownerMap:    buildMap(owners,    'owner_id',    'owner_name'),
    petMap:      buildMap(allPets,   'pet_id',      'pet_name'),
  };

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }
 
  const { showWarning, secondsLeft, stayLoggedIn } = useSessionTimeout(handleLogout);

  const [pendingCount, setPendingCount]   = useState(0);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showAcctModal, setShowAcctModal] = useState(false);

  useEffect(() => {
    // Poll pending request count every 30 seconds for the badge
    const load = () =>
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        authFetch('/api/pets/all-requests')
          .then(r => r.json())
          .then(data => setPendingCount((data ?? []).filter(r => r.status === 'pending').length))
          .catch(() => {});
      });
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const navItems = [
    { id: 'overview',      code: 'OV', label: 'Overview' },
    { id: 'owners',        code: 'OW', label: 'Pet Owners' },
    { id: 'records',       code: 'RC', label: 'Records' },
    { id: 'approvals',     code: 'AP', label: 'Edit Approvals', badge: pendingCount },
    { id: 'approval_ids',  code: 'ID', label: 'Approval IDs' },
    { id: 'veterinarians', code: 'VT', label: 'Veterinarians' },
  ];

  const PAGE_META = {
    overview:      { title: 'Overview',       crumb: 'Vet Portal · Dashboard' },
    owners:        { title: 'Pet Owners',      crumb: 'Vet Portal · Pet Owners' },
    records:       { title: 'Records',         crumb: 'Vet Portal · Records' },
    approvals:     { title: 'Edit Approvals',  crumb: 'Vet Portal · Approvals' },
    approval_ids:  { title: 'Approval IDs',    crumb: 'Vet Portal · Approval IDs' },
    veterinarians: { title: 'Veterinarians',   crumb: 'Vet Portal · Veterinarians' },
  };
  const meta = PAGE_META[activeTab] ?? { title: 'Dashboard', crumb: 'Vet Portal' };

  function initials(name) {
    if (!name) return 'V';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{ background: MAROON, display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 6px 18px', borderBottom: '1px solid rgba(255,255,255,0.12)', marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, background: '#fff', borderRadius: '6px', display: 'grid', placeItems: 'center', color: MAROON, fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>DV</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem', letterSpacing: '0.02em' }}>DIGIVET</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Online System</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', padding: '8px 10px' }}>Workspace</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(tab => {
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button onClick={() => setActiveTab(tab.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    background: active ? '#fff' : 'transparent',
                    border: 0, borderRadius: 8,
                    color: active ? MAROON : 'rgba(255,255,255,0.85)',
                    fontSize: '0.9rem', fontWeight: active ? 600 : 400,
                    padding: '9px 10px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
                  }}
                    onMouseOver={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseOut={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center',
                      background: active ? MAROON_LIGHT : 'rgba(255,255,255,0.1)',
                      color: active ? MAROON : 'rgba(255,255,255,0.85)',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0,
                    }}>{tab.code}</span>
                    <span style={{ flex: 1 }}>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999, padding: '2px 8px' }}>Online</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>v1.0.0</span>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f5f6fa' }}>

        {/* Topbar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 28px', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#111' }}>{meta.title}</h1>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', letterSpacing: '0.02em' }}>{meta.crumb}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DbStatusBar />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</span>
            <button onClick={() => setShowAcctModal(true)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: MAROON, color: '#fff', border: 0, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              onMouseOver={e => e.currentTarget.style.background = MAROON_DARK}
              onMouseOut={e => e.currentTarget.style.background = MAROON}
            >{initials(fullName)}</button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem 2.5rem' }}>
          {activeTab === 'overview'      && <OverviewTab setActiveTab={setActiveTab} refs={refs} />}
          {activeTab === 'owners'        && <OwnersTab refs={refs} />}
          {activeTab === 'records'       && <RecordsTab refs={refs} />}
          {activeTab === 'approvals'     && <PendingApprovalsTab refs={refs} onReviewed={() => setPendingCount(c => Math.max(0, c - 1))} />}
          {activeTab === 'approval_ids'  && <ApprovalIdsTab refs={refs} />}
          {activeTab === 'veterinarians' && <VeterinariansTab />}
        </main>
      </div>

      {showChangePwd   && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
      {showAcctModal   && <VetAccountModal fullName={fullName} onClose={() => setShowAcctModal(false)} onChangePwd={() => { setShowAcctModal(false); setShowChangePwd(true); }} onLogout={handleLogout} />}
      {showWarning     && <SessionWarning secondsLeft={secondsLeft} onStay={stayLoggedIn} onLogout={handleLogout} />}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

const STAT_DEFS = [
  { key: 'vaccines', label: 'Vaccinations',  desc: 'vaccination records', color: MAROON,    bg: MAROON_LIGHT, icon: '💉' },
  { key: 'owners',   label: 'Pet Owners',    desc: 'registered owners',   color: '#2563eb', bg: '#eff6ff',    icon: '👤' },
  { key: 'pets',     label: 'Pets on File',  desc: 'in the registry',     color: '#16a34a', bg: '#f0fdf4',    icon: '🐾' },
  { key: 'vets',     label: 'Veterinarians', desc: 'active vets',         color: '#d97706', bg: '#fffbeb',    icon: '⚕️' },
];

const MODULES = [
  { id: 'owners',        emoji: '👤', name: 'Pet Owners',    desc: 'Manage owner records'  },
  { id: 'records',       emoji: '📋', name: 'Records',       desc: 'Browse by barangay'    },
  { id: 'approvals',     emoji: '✅', name: 'Approvals',     desc: 'Review edit requests'  },
  { id: 'approval_ids',  emoji: '🆔', name: 'Approval IDs',  desc: 'Issued ID codes'       },
  { id: 'veterinarians', emoji: '⚕️', name: 'Veterinarians', desc: 'Vet accounts & access' },
];

function formatDate() {
  return new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function OverviewTab({ setActiveTab, refs }) {
  const { rows: owners,   loading: lo } = useVetTable('owner_table');
  const { rows: pets,     loading: lp } = useVetTable('pet_table');
  const { rows: vaccines, loading: lv } = useVetTable('vaccine_table');
  const { rows: vets                  } = useVetTable('vet_table');
  const [connOk, setConnOk]             = useState(null);

  const loading = lo || lp || lv;

  useEffect(() => {
    fetch(`${API_BASE}/api/status`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setConnOk(d?.checks?.supabase_connection?.ok === true))
      .catch(() => setConnOk(false));
  }, []);

  const stats = {
    vaccines: vaccines.filter(r => !r.deleted_at).length,
    owners:   owners.filter(r => !r.deleted_at).length,
    pets:     pets.filter(r => !r.deleted_at).length,
    vets:     vets.length,
  };

  // Recent vaccinations — last 8 by vaccine_id
  const recentVacc = vaccines
    .filter(r => !r.deleted_at)
    .sort((a, b) => b.vaccine_id - a.vaccine_id)
    .slice(0, 8);

  // Top barangays by vaccination count (via pet → owner → barangay)
  const petOwnerMap = Object.fromEntries(pets.map(p => [p.pet_id, p.owner_id]));
  const ownerBrgyMap = Object.fromEntries(owners.map(o => [o.owner_id, o.barangay_id]));
  const brgyCount = {};
  vaccines.filter(v => !v.deleted_at).forEach(v => {
    const brgyId = ownerBrgyMap[petOwnerMap[v.pet_id]];
    if (brgyId) brgyCount[brgyId] = (brgyCount[brgyId] ?? 0) + 1;
  });
  const topBarangays = Object.entries(brgyCount)
    .map(([id, count]) => ({ name: refs.barangayMap[id] ?? `Barangay #${id}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const MUTED  = '#6b7280';
  const BORDER = '#e5e7eb';

  // Shared panel style
  const panel = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
  const panelHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px 12px', borderBottom: `1px solid ${BORDER}` };
  const panelTitle = { fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, color: '#111' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {owners.length === 0 && !loading && <DataError />}

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#111', margin: '0 0 2px', letterSpacing: '-0.02em' }}>Overview</h1>
          <p style={{ fontSize: '0.82rem', color: MUTED, margin: 0 }}>{formatDate()}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600,
            padding: '5px 12px', borderRadius: 999, border: `1px solid ${connOk ? '#86efac' : BORDER}`,
            background: connOk ? '#f0fdf4' : '#f9fafb', color: connOk ? '#16a34a' : MUTED,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
            {connOk === null ? 'Checking…' : connOk ? 'Supabase connected' : 'Supabase offline'}
          </span>
        </div>
      </header>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {STAT_DEFS.map(({ key, label, desc, color, bg, icon }) => (
          <div key={key} style={{ position: 'relative', overflow: 'hidden', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 20px 18px', display: 'flex', flexDirection: 'column', gap: 2, transition: 'box-shadow 0.15s, transform 0.1s' }}
            onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: color, borderRadius: '14px 0 0 14px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED }}>{label}</span>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'grid', placeItems: 'center', fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
            </div>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {loading ? '—' : stats[key].toLocaleString()}
            </span>
            <span style={{ fontSize: '0.78rem', color: MUTED, marginTop: 4 }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <section>
        <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED, margin: '0 0 8px' }}>Quick actions</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {MODULES.map(({ id, emoji, name, desc }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 16, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = MAROON; e.currentTarget.style.boxShadow = '0 4px 16px rgba(122,31,43,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <span style={{ width: 42, height: 42, borderRadius: 11, background: MAROON_LIGHT, display: 'grid', placeItems: 'center', fontSize: '1.2rem', flexShrink: 0 }}>{emoji}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111' }}>{name}</span>
                <span style={{ fontSize: '0.74rem', color: MUTED, lineHeight: 1.4 }}>{desc}</span>
              </span>
              <span style={{ alignSelf: 'flex-end', fontSize: '0.85rem', color: '#9ca3af', marginTop: 'auto' }}>→</span>
            </button>
          ))}
        </div>
      </section>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, alignItems: 'start' }}>

        {/* Recent Vaccinations panel */}
        <section style={panel}>
          <div style={panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>💉</span>
              <h3 style={panelTitle}>Recent Vaccinations</h3>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
              <span style={{ width: 24, height: 24, border: `3px solid ${MAROON_LIGHT}`, borderTopColor: MAROON, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : recentVacc.length === 0 ? (
            <div style={{ padding: '2rem 1.25rem', textAlign: 'center', color: MUTED }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>💉</div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 4px', color: '#111' }}>No vaccination records yet</p>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>Records will appear here once vaccinations are added.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['#', 'Pet', 'Owner', 'Date', 'Vaccine', 'Type'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: MUTED, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentVacc.map((v, i) => {
                      const petName   = refs.petMap[v.pet_id]   ?? `Pet #${v.pet_id}`;
                      const ownerName = (() => {
                        const pet = pets.find(p => p.pet_id === v.pet_id);
                        return pet ? (refs.ownerMap[pet.owner_id] ?? `Owner #${pet.owner_id}`) : '—';
                      })();
                      return (
                        <tr key={v.vaccine_id} style={{ borderBottom: i < recentVacc.length - 1 ? `1px solid #f5f6fa` : 'none' }}
                          onMouseOver={e => e.currentTarget.style.background = '#f5f6fa'}
                          onMouseOut={e => e.currentTarget.style.background = ''}
                        >
                          <td style={{ padding: '10px 14px', color: MUTED, fontSize: '0.78rem', width: 32 }}>{i + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{petName}</td>
                          <td style={{ padding: '10px 14px', color: MUTED }}>{ownerName}</td>
                          <td style={{ padding: '10px 14px', color: MUTED, whiteSpace: 'nowrap' }}>{v.vaccine_date ? new Date(v.vaccine_date).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: MAROON, background: MAROON_LIGHT, padding: '3px 8px', borderRadius: 5 }}>{v.vaccine_details || '—'}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: MUTED, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{v.is_office_visit ? 'Office' : 'Drive'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '11px 18px', borderTop: `1px solid ${BORDER}` }}>
                <button onClick={() => setActiveTab('records')} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.82rem', fontWeight: 600, color: MAROON, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseOver={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >View all records →</button>
              </div>
            </>
          )}
        </section>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Top Barangays */}
          <section style={panel}>
            <div style={panelHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>🏘️</span>
                <h3 style={panelTitle}>Top Barangays</h3>
              </div>
            </div>
            {loading ? (
              <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <span style={{ width: 20, height: 20, border: `3px solid ${MAROON_LIGHT}`, borderTopColor: MAROON, borderRadius: '50%', display: 'inline-block' }} />
              </div>
            ) : topBarangays.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.82rem', color: MUTED, margin: 0 }}>No barangay data yet.</p>
              </div>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topBarangays.map((b, i) => {
                  const pct = Math.round((b.count / topBarangays[0].count) * 100);
                  return (
                    <li key={b.name} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: MAROON_LIGHT, borderRadius: 9, pointerEvents: 'none', transition: 'width 0.6s ease' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED, position: 'relative' }}>{i + 1}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}>{b.name}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: MAROON, whiteSpace: 'nowrap', position: 'relative' }}>{b.count.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Sync status */}
          <section style={panel}>
            <div style={panelHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>🔄</span>
                <h3 style={panelTitle}>Sync Status</h3>
              </div>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '3px 10px', borderRadius: 999, border: `1px solid ${connOk ? '#86efac' : BORDER}`,
                background: connOk ? '#f0fdf4' : '#f9fafb', color: connOk ? '#16a34a' : MUTED,
              }}>
                {connOk === null ? '…' : connOk ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: MUTED, fontWeight: 500 }}>Database</span>
                <span style={{ fontWeight: 600, color: '#111' }}>{connOk ? 'Supabase Online' : 'Supabase Offline'}</span>
              </div>
            </div>
          </section>

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Tab components ────────────────────────────────────────────────────────────

// ── Records Tab — grouped by Barangay, filterable by Drive Session ───────────

function RecordsTab({ refs }) {
  const { rows: owners,    loading: lo } = useVetTable('owner_table');
  const { rows: pets,      loading: lp } = useVetTable('pet_table');
  const { rows: vaccines,  loading: lv } = useVetTable('vaccine_table');
  const { rows: approvals, loading: la } = useVetTable('approval_id_table');
  const { rows: sessions               } = useVetTable('drive_session_table');
  const { rows: barangays              } = useVetTable('barangay_table');

  const [search,        setSearch]       = useState('');
  const [filterBrgy,    setFilterBrgy]   = useState('');   // barangay_id
  const [filterSession, setFilterSession]= useState('');   // session_id
  const [expanded,      setExpanded]     = useState({});
  const [modal,         setModal]        = useState(null);
  const [delModal,      setDelModal]     = useState(null);

  const loading = lo || lp || lv || la;

  // Build lookup maps
  const approvalMap = Object.fromEntries(approvals.map(a => [a.approval_id, a.approval_code]));
  const vaccByPet   = {};
  vaccines.filter(v => !v.deleted_at).forEach(v => {
    (vaccByPet[v.pet_id] = vaccByPet[v.pet_id] || []).push(v);
  });
  const petsByOwner = {};
  pets.filter(p => !p.deleted_at).forEach(p => {
    (petsByOwner[p.owner_id] = petsByOwner[p.owner_id] || []).push(p);
  });

  // Sessions visible in the session row — cascade off the selected barangay
  const visibleSessions = (filterBrgy
    ? sessions.filter(s => String(s.barangay_id) === filterBrgy)
    : sessions
  ).slice().sort((a, b) => new Date(b.session_date) - new Date(a.session_date));

  // Filter by session: only keep pets whose vaccinations include the selected session
  const petIdsInSession = filterSession
    ? new Set(vaccines.filter(v => String(v.session_id) === filterSession).map(v => v.pet_id))
    : null;

  // Filter owners
  const filteredOwners = owners.filter(o => !o.deleted_at).filter(o => {
    if (filterBrgy && String(o.barangay_id) !== filterBrgy) return false;
    if (petIdsInSession) {
      const ownerPets = petsByOwner[o.owner_id] ?? [];
      if (!ownerPets.some(p => petIdsInSession.has(p.pet_id))) return false;
    }
    const q = search.toLowerCase();
    if (!q) return true;
    if (o.owner_name?.toLowerCase().includes(q)) return true;
    if (o.contact_number?.includes(q)) return true;
    return (petsByOwner[o.owner_id] ?? []).some(p =>
      p.pet_name?.toLowerCase().includes(q) ||
      (vaccByPet[p.pet_id] ?? []).some(v => v.vaccine_details?.toLowerCase().includes(q))
    );
  });

  // Group filtered owners by barangay
  const byBarangay = {};
  filteredOwners.forEach(o => {
    const key = o.barangay_id ?? 0;
    (byBarangay[key] = byBarangay[key] || []).push(o);
  });
  const barangayIds = Object.keys(byBarangay).sort((a, b) => {
    const na = refs.barangayMap[a] ?? '';
    const nb = refs.barangayMap[b] ?? '';
    return na.localeCompare(nb);
  });

  function toggle(key) { setExpanded(e => ({ ...e, [key]: !e[key] })); }

  async function handleSave(form) {
    const { table, pk } = modal;
    const res = await authFetch(`/api/vetdata/${table}/${form[pk]}`, { method: 'PATCH', body: JSON.stringify(form) });
    if (!res.ok) throw new Error('Failed to save');
    setModal(null);
    window.location.reload();
  }

  async function handleDelete() {
    const { table, pk, row } = delModal;
    const res = await authFetch(`/api/vetdata/${table}/${row[pk]}`, { method: 'DELETE' });
    if (!res.ok) { alert('Delete failed'); return; }
    setDelModal(null);
    window.location.reload();
  }

  const BORDER = '#e5e7eb';
  const MUTED  = '#6b7280';

  const btnEdit = (table, pk, row, fields, title) => (
    <button onClick={e => { e.stopPropagation(); setModal({ table, pk, row, fields, title }); }}
      style={{ background: '#f9fafb', border: `1px solid ${BORDER}`, color: '#374151', borderRadius: 6, padding: '3px 9px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      Edit
    </button>
  );
  const btnDel = (table, pk, name, row) => (
    <button onClick={e => { e.stopPropagation(); setDelModal({ table, pk, name, row }); }}
      style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '3px 9px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      Delete
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <header>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#111', margin: '0 0 2px', letterSpacing: '-0.02em' }}>Records</h1>
        <p style={{ color: MUTED, margin: 0, fontSize: '0.82rem' }}>
          {filteredOwners.length} owner{filteredOwners.length !== 1 ? 's' : ''} · grouped by barangay
        </p>
      </header>

      {/* Filter bar */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owners, pets, vaccines…"
            style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '0.5rem 0.9rem 0.5rem 2rem', fontSize: '0.85rem', outline: 'none', background: '#f9fafb', color: '#111', fontFamily: 'inherit' }} />
        </div>
        <select value={filterBrgy} onChange={e => { setFilterBrgy(e.target.value); setFilterSession(''); }}
          style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer', color: '#111', fontFamily: 'inherit' }}>
          <option value="">All Barangays</option>
          {barangays.slice().sort((a, b) => a.barangay_name.localeCompare(b.barangay_name)).map(b => {
            const count = owners.filter(o => !o.deleted_at && String(o.barangay_id) === String(b.barangay_id)).length;
            return <option key={b.barangay_id} value={b.barangay_id}>{b.barangay_name} ({count})</option>;
          })}
        </select>
        <select value={filterSession} onChange={e => setFilterSession(e.target.value)} disabled={!filterBrgy}
          style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.85rem', outline: 'none', background: filterBrgy ? '#fff' : '#f5f6fa', cursor: filterBrgy ? 'pointer' : 'not-allowed', color: filterBrgy ? '#111' : '#bbb', fontFamily: 'inherit' }}>
          <option value="">{filterBrgy ? 'All Sessions' : 'Select a barangay first'}</option>
          {visibleSessions.map(s => {
            const label = s.session_date ? new Date(s.session_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : `Session #${s.session_id}`;
            const doses = vaccines.filter(v => String(v.session_id) === String(s.session_id)).length;
            return <option key={s.session_id} value={s.session_id}>{label} ({doses} dose{doses !== 1 ? 's' : ''})</option>;
          })}
        </select>
        {(filterBrgy || filterSession || search) && (
          <>
            <span style={{ fontSize: '0.78rem', color: MUTED }}>{filteredOwners.length} of {owners.filter(o => !o.deleted_at).length} owners</span>
            <button onClick={() => { setFilterBrgy(''); setFilterSession(''); setSearch(''); }}
              style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer', color: MUTED, fontFamily: 'inherit', fontWeight: 600 }}>
              ✕ Clear
            </button>
          </>
        )}
      </div>

      {/* Records list */}
      {loading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <span style={{ width: 24, height: 24, border: `3px solid ${MAROON_LIGHT}`, borderTopColor: MAROON, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : barangayIds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: MUTED }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 4px', color: '#111' }}>No records found</p>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {barangayIds.map(brgyId => {
            const brgyName   = refs.barangayMap[brgyId] ?? `Barangay #${brgyId}`;
            const brgyOwners = byBarangay[brgyId];
            const brgyKey    = `b${brgyId}`;
            const brgyOpen   = expanded[brgyKey] !== false;

            return (
              <div key={brgyId} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>

                {/* Barangay panel head */}
                <div onClick={() => toggle(brgyKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: brgyOpen ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', background: brgyOpen ? MAROON_LIGHT : '#fff', transition: 'background 0.15s' }}
                  onMouseOver={e => { if (!brgyOpen) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseOut={e => { if (!brgyOpen) e.currentTarget.style.background = brgyOpen ? MAROON_LIGHT : '#fff'; }}
                >
                  <span style={{ fontSize: '0.95rem' }}>🏘️</span>
                  <span style={{ fontWeight: 700, color: '#111', fontSize: '0.9rem', flex: 1, letterSpacing: '-0.01em' }}>{brgyName}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: brgyOpen ? MAROON : MUTED, background: brgyOpen ? '#fff' : '#f5f6fa', border: `1px solid ${brgyOpen ? MAROON + '30' : BORDER}`, borderRadius: 999, padding: '2px 10px' }}>
                    {brgyOwners.length} owner{brgyOwners.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ color: '#bbb', fontSize: '0.8rem', marginLeft: 4 }}>{brgyOpen ? '▾' : '▸'}</span>
                </div>

                {/* Owners */}
                {brgyOpen && brgyOwners.map((owner, oi) => {
                  const ownerKey  = `o${owner.owner_id}`;
                  const ownerOpen = expanded[ownerKey];
                  const ownerPets = (petsByOwner[owner.owner_id] ?? []).filter(p => !petIdsInSession || petIdsInSession.has(p.pet_id));

                  return (
                    <div key={owner.owner_id} style={{ borderTop: `1px solid ${oi === 0 ? BORDER : '#f5f6fa'}` }}>

                      {/* Owner row */}
                      <div onClick={() => toggle(ownerKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', background: ownerOpen ? '#fdf7f8' : '#fff', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseOver={e => { if (!ownerOpen) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseOut={e => { if (!ownerOpen) e.currentTarget.style.background = ownerOpen ? '#fdf7f8' : '#fff'; }}
                      >
                        <span style={{ width: 32, height: 32, borderRadius: '50%', background: MAROON_LIGHT, color: MAROON, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>
                          {owner.owner_name?.charAt(0).toUpperCase()}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#111', fontSize: '0.88rem' }}>{owner.owner_name}</div>
                          <div style={{ fontSize: '0.76rem', color: MUTED, marginTop: 1 }}>{owner.contact_number || '—'}</div>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ownerPets.length ? '#16a34a' : '#bbb', background: ownerPets.length ? '#f0fdf4' : '#f5f6fa', border: `1px solid ${ownerPets.length ? '#86efac' : BORDER}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          🐾 {ownerPets.length}
                        </span>
                        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                          {btnEdit('owner_table', 'owner_id', owner, [{ key:'owner_name', label:'Owner Name', required:true }, { key:'contact_number', label:'Contact Number' }], 'Owner')}
                          {btnDel('owner_table', 'owner_id', owner.owner_name, owner)}
                        </div>
                        <span style={{ color: '#d1d5db', fontSize: '0.78rem', marginLeft: 4 }}>{ownerOpen ? '▾' : '▸'}</span>
                      </div>

                      {/* Pets */}
                      {ownerOpen && (
                        <div style={{ background: '#f9fafb', borderTop: `1px solid ${BORDER}` }}>
                          {ownerPets.length === 0 ? (
                            <p style={{ color: '#d1d5db', fontSize: '0.82rem', padding: '10px 18px 10px 60px', margin: 0 }}>No pets registered.</p>
                          ) : ownerPets.map((pet, pi) => {
                            const petKey  = `p${pet.pet_id}`;
                            const petOpen = expanded[petKey];
                            const petVacc = (vaccByPet[pet.pet_id] ?? [])
                              .filter(v => !filterSession || String(v.session_id) === filterSession)
                              .sort((a, b) => new Date(b.vaccine_date) - new Date(a.vaccine_date));

                            return (
                              <div key={pet.pet_id} style={{ borderTop: pi > 0 ? `1px solid ${BORDER}` : 'none' }}>

                                {/* Pet row */}
                                <div onClick={() => toggle(petKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px 10px 44px', cursor: 'pointer', background: petOpen ? '#f3f4f6' : 'transparent', transition: 'background 0.1s' }}
                                  onMouseOver={e => { if (!petOpen) e.currentTarget.style.background = '#f0f0f0'; }}
                                  onMouseOut={e => { if (!petOpen) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{pet.pet_type?.toLowerCase().includes('cat') ? '🐱' : '🐶'}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontWeight: 600, color: '#111', fontSize: '0.85rem' }}>{pet.pet_name}</span>
                                    <span style={{ color: MUTED, fontSize: '0.75rem', marginLeft: 6 }}>{[pet.pet_type, pet.pet_color, pet.pet_age].filter(Boolean).join(' · ')}</span>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: petVacc.length ? '#16a34a' : '#bbb', background: petVacc.length ? '#f0fdf4' : '#f5f6fa', border: `1px solid ${petVacc.length ? '#86efac' : BORDER}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                    💉 {petVacc.length}
                                  </span>
                                  <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                                    {btnEdit('pet_table', 'pet_id', pet, [{ key:'pet_name', label:'Pet Name', required:true }, { key:'pet_type', label:'Type / Species' }, { key:'pet_color', label:'Color' }, { key:'pet_age', label:'Age' }], 'Pet')}
                                    {btnDel('pet_table', 'pet_id', pet.pet_name, pet)}
                                  </div>
                                  <span style={{ color: '#d1d5db', fontSize: '0.76rem', marginLeft: 4 }}>{petOpen ? '▾' : '▸'}</span>
                                </div>

                                {/* Vaccination records */}
                                {petOpen && (
                                  <div style={{ borderTop: `1px solid ${BORDER}`, background: '#fff' }}>
                                    {petVacc.length === 0 ? (
                                      <p style={{ color: '#d1d5db', fontSize: '0.82rem', padding: '10px 18px 10px 64px', margin: 0 }}>No vaccination records.</p>
                                    ) : (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                        <thead>
                                          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                                            {['Date', 'Vaccine', 'Manufacturer', 'Approval', 'Type', ''].map((h, hi) => (
                                              <th key={h} style={{ padding: hi === 0 ? '7px 14px 7px 64px' : '7px 14px', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: MUTED, whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {petVacc.map((v, vi) => (
                                            <tr key={v.vaccine_id} style={{ borderBottom: vi < petVacc.length - 1 ? `1px solid #f5f6fa` : 'none' }}
                                              onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                                              onMouseOut={e => e.currentTarget.style.background = ''}
                                            >
                                              <td style={{ padding: '9px 14px 9px 64px', fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>
                                                {v.vaccine_date ? new Date(v.vaccine_date).toLocaleDateString() : '—'}
                                              </td>
                                              <td style={{ padding: '9px 14px' }}>
                                                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: MAROON, background: MAROON_LIGHT, padding: '3px 8px', borderRadius: 5 }}>
                                                  {v.vaccine_details || '—'}
                                                </span>
                                              </td>
                                              <td style={{ padding: '9px 14px', color: MUTED }}>{v.manufacturer_no || '—'}</td>
                                              <td style={{ padding: '9px 14px' }}>
                                                {v.approval_id
                                                  ? <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: 5 }}>{approvalMap[v.approval_id] ?? `#${v.approval_id}`}</span>
                                                  : <span style={{ color: '#d1d5db' }}>—</span>}
                                              </td>
                                              <td style={{ padding: '9px 14px', color: MUTED, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                {v.is_office_visit ? 'Office' : 'Drive'}
                                              </td>
                                              <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', gap: 5 }}>
                                                  {btnEdit('vaccine_table', 'vaccine_id', v, [{ key:'vaccine_date', label:'Date', type:'date', required:true }, { key:'vaccine_details', label:'Vaccine Details' }, { key:'manufacturer_no', label:'Manufacturer No.' }], 'Vaccination')}
                                                  {btnDel('vaccine_table', 'vaccine_id', `Vaccination #${v.vaccine_id}`, v)}
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {modal && <GenericEditModal title={modal.title} fields={modal.fields} initialValues={modal.row} onSave={handleSave} onClose={() => setModal(null)} />}
      {delModal && <DeleteConfirm name={delModal.name} onConfirm={handleDelete} onCancel={() => setDelModal(null)} />}
    </div>
  );
}

function OwnersTab({ refs }) {
  const { rows, loading } = useVetTable('owner_table');
  const [search, setSearch]         = useState('');
  const [sending, setSending]       = useState({});
  const [sendErrors, setSendErrors] = useState({});
  const [provisioning, setProvision]    = useState(false);
  const [provisionMsg, setProvisionMsg] = useState('');
  const [showConfirm, setShowConfirm]   = useState(false);
  const [resendTarget, setResendTarget] = useState(null); // owner to resend to
  const [failedTarget, setFailedTarget] = useState(null);
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('owner_table', 'owner_id');
  const [credStatus, setCredStatus] = useState(null);

useEffect(() => {
  authFetch('/api/credentials/status')
    .then(data => setCredStatus(data))
    .catch(() => {});
}, []);


  // Opens the styled confirmation modal
  function runProvision() { setShowConfirm(true); }

  // Called when vet clicks Confirm in the modal
  async function doProvision() {
    setShowConfirm(false);
    setProvision(true);
    setProvisionMsg('');
    try {
      await authFetch('/api/credentials/send-now', { method: 'POST' });
      setProvisionMsg('✓ Provisioning running in background — credentials will be sent shortly');
    } catch {
      setProvisionMsg('✗ Failed to start provisioning');
    } finally {
      setProvision(false);
    }
  }


  const filtered = rows.filter(r => !r.deleted_at).filter(r =>
    r.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_number?.includes(search) ||
    (refs.barangayMap[r.barangay_id] ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function sendCredentials(owner, force = false) {
    setSending(s => ({ ...s, [owner.owner_id]: 'sending' }));
    setSendErrors(s => {
      const next = { ...s };
      delete next[owner.owner_id];
      return next;
    });
    try {
      const res  = await authFetch('/api/auth/send-owner-credentials', {
        method: 'POST',
        body: JSON.stringify({ owner_id: owner.owner_id, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadySent) {
          // Show styled modal instead of window.confirm
          setSending(s => ({ ...s, [owner.owner_id]: null }));
          setResendTarget(owner);
          return;
        }
        const message = data.error || `Request failed with status ${res.status}`;
        setSendErrors(s => ({ ...s, [owner.owner_id]: message }));
        setSending(s => ({ ...s, [owner.owner_id]: 'error' }));
      } else {
        setSendErrors(s => {
          const next = { ...s };
          delete next[owner.owner_id];
          return next;
        });
        setSending(s => ({ ...s, [owner.owner_id]: 'sent' }));
      }
    } catch (err) {
      setSendErrors(s => ({ ...s, [owner.owner_id]: err.message || 'Network error while sending credentials' }));
      setSending(s => ({ ...s, [owner.owner_id]: 'error' }));
    }
  }

  const BORDER = '#e5e7eb';
  const MUTED  = '#6b7280';
  const unsentCount = filtered.filter(r => r.email && !r.credentials_sent).length;

  // Shared stat card with left accent
  function StatCard({ label, value, desc, color, bg, icon }) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: color, borderRadius: '12px 0 0 12px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED }}>{label}</span>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'grid', placeItems: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
        </div>
        <span style={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value ?? '—'}
        </span>
        <span style={{ fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{desc}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#111', margin: '0 0 2px', letterSpacing: '-0.02em' }}>Pet Owners</h1>
          <p style={{ fontSize: '0.82rem', color: MUTED, margin: 0 }}>{filtered.length} registered owner{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </header>

      {/* Provision flash message */}
      {provisionMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: provisionMsg.startsWith('✓') ? '#f0fdf4' : '#fff5f5', border: `1px solid ${provisionMsg.startsWith('✓') ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem', color: provisionMsg.startsWith('✓') ? '#166534' : '#dc2626', fontWeight: 500 }}>
          {provisionMsg}
        </div>
      )}

      {/* Credential stat cards */}
      {credStatus && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Credentials Sent"  value={credStatus.sent}    desc="owners have login access"       color="#16a34a" bg="#f0fdf4" icon="✉️" />
          <StatCard label="Staged — Not Sent"  value={credStatus.staged}  desc="password ready, not emailed"    color="#d97706" bg="#fffbeb" icon="⏳" />
          <StatCard label="Not Yet Staged"     value={credStatus.pending} desc="credentials not yet prepared"   color={MUTED}   bg="#f5f6fa" icon="👤" />
        </div>
      )}

      {/* Main panel */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Panel head */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px 12px', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.05rem' }}>👤</span>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, color: '#111' }}>
              Pet Owners · {filtered.length}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owners…"
                style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '0.5rem 0.9rem 0.5rem 2rem', fontSize: '0.85rem', outline: 'none', background: '#f9fafb', color: '#111', width: 200, fontFamily: 'inherit' }} />
            </div>
            <button onClick={runProvision} disabled={provisioning}
              style={{ background: unsentCount > 0 ? MAROON : '#f0fdf4', color: unsentCount > 0 ? '#fff' : '#16a34a', border: `1px solid ${unsentCount > 0 ? MAROON : '#86efac'}`, borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.82rem', cursor: provisioning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', opacity: provisioning ? 0.7 : 1 }}
              onMouseOver={e => { if (unsentCount > 0 && !provisioning) e.currentTarget.style.background = MAROON_DARK; }}
              onMouseOut={e => { if (unsentCount > 0) e.currentTarget.style.background = MAROON; }}
            >
              {provisioning ? 'Sending…' : unsentCount > 0 ? `Send to ${unsentCount} Unsent` : '✓ All Sent'}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 24, height: 24, border: `3px solid ${MAROON_LIGHT}`, borderTopColor: MAROON, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 4px', color: '#111' }}>No owners found</p>
            <p style={{ fontSize: '0.82rem', color: MUTED, margin: 0 }}>Try adjusting your search.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['#', 'Name', 'Contact', 'Email', 'Barangay', 'Credentials', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: MUTED, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const state = sending[r.owner_id];
                  const errorMessage = sendErrors[r.owner_id];
                  const credSent = r.credentials_sent || state === 'sent';
                  return (
                    <tr key={r.owner_id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid #f5f6fa` : 'none' }}
                      onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseOut={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '10px 14px', color: MUTED, fontSize: '0.78rem', width: 36 }}>#{r.owner_id}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: MAROON_LIGHT, color: MAROON, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>
                            {r.owner_name?.charAt(0).toUpperCase() ?? '?'}
                          </span>
                          <span style={{ fontWeight: 600, color: '#111' }}>{r.owner_name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: MUTED }}>{r.contact_number || '—'}</td>
                      <td style={{ padding: '10px 14px', color: r.email ? MUTED : '#d1d5db' }}>{r.email || 'No email'}</td>
                      <td style={{ padding: '10px 14px', color: MUTED }}>{refs.barangayMap[r.barangay_id] ?? `Brgy #${r.barangay_id}`}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {state === 'error'
                          ? <button onClick={() => setFailedTarget({ owner: r, error: errorMessage || 'Unknown send error' })} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Failed</button>
                          : credSent
                          ? <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 5, padding: '2px 8px' }}>Sent</span>
                          : <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {r.email ? (
                            <button onClick={() => sendCredentials(r)} disabled={state === 'sending'}
                              style={{ background: credSent ? '#f0fdf4' : MAROON_LIGHT, border: `1px solid ${credSent ? '#86efac' : MAROON + '40'}`, color: credSent ? '#16a34a' : MAROON, borderRadius: 6, padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, cursor: state === 'sending' ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                              {state === 'sending' ? 'Sending…' : credSent ? 'Resend ↻' : 'Send'}
                            </button>
                          ) : null}
                          <button onClick={() => setEditing(r)} style={{ background: '#f9fafb', border: `1px solid ${BORDER}`, color: '#374151', borderRadius: 6, padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                          <button onClick={() => setDeleting(r)} style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {editing  && <GenericEditModal title="Owner" fields={[{ key:'owner_name', label:'Owner Name', required:true }, { key:'contact_number', label:'Contact Number' }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={deleting.owner_name} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}

      {showConfirm && (() => {
        return unsentCount > 0 ? (
          <ConfirmModal
            icon="📧"
            title={`Send to ${unsentCount} Unsent Owner${unsentCount !== 1 ? 's' : ''}`}
            confirmColor={MAROON}
            confirmLabel={`Send Credentials to ${unsentCount} Owner${unsentCount !== 1 ? 's' : ''}`}
            message={`New passwords will be generated and emailed to ${unsentCount} owner${unsentCount !== 1 ? 's' : ''} who have not yet received login credentials.`}
            onConfirm={doProvision}
            onCancel={() => setShowConfirm(false)}
          />
        ) : (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
            onClick={() => setShowConfirm(false)}>
            <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ background: '#16a34a', padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>✅</div>
                <h2 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.05rem' }}>All Credentials Sent</h2>
              </div>
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1.5rem' }}>All owners with registered email addresses have already received their login credentials.</p>
                <button onClick={() => setShowConfirm(false)} style={{ background: MAROON, color: '#fff', border: 'none', borderRadius: 10, padding: '0.8rem 2rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {resendTarget && (
        <ConfirmModal
          icon="🔄"
          title="Resend Credentials"
          confirmColor="#d97706"
          confirmLabel="Yes, Resend New Credentials"
          message={`Credentials were already sent to ${resendTarget.owner_name}.\n\nSending again will generate a NEW password and email it. Their old password will no longer work.`}
          onConfirm={async () => { setResendTarget(null); await sendCredentials(resendTarget, true); }}
          onCancel={() => setResendTarget(null)}
        />
      )}
      {failedTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
          onClick={() => setFailedTarget(null)}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#dc2626', padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>!</div>
              <h2 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.05rem' }}>Credential Send Failed</h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#111', fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.4rem' }}>{failedTarget.owner.owner_name}</p>
              <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem' }}>{failedTarget.owner.email || 'No email on record'}</p>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ color: '#991b1b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>Error</p>
                <p style={{ color: '#7f1d1d', fontSize: '0.88rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{failedTarget.error}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setFailedTarget(null)}
                  style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 600 }}>
                  Close
                </button>
                <button onClick={async () => {
                  const owner = failedTarget.owner;
                  setFailedTarget(null);
                  await sendCredentials(owner, true);
                }}
                  style={{ flex: 2, background: MAROON, color: '#fff', border: 'none', borderRadius: 10, padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Retry Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PetsTab({ refs }) {
  const { rows: owners, loading: ownersLoading } = useVetTable('owner_table');
  const { rows: pets,   loading: petsLoading   } = useVetTable('pet_table');
  const [search, setSearch]   = useState('');
  const [expanded, setExpanded] = useState({});
  const [editingPet, setEditingPet] = useState(null);
  const [deletingPet, setDeletingPet] = useState(null);
  const [, forceRefresh] = useState(0);

  const loading = ownersLoading || petsLoading;

  // Group pets by owner_id
  const petsByOwner = {};
  pets.filter(p => !p.deleted_at).forEach(p => {
    if (!petsByOwner[p.owner_id]) petsByOwner[p.owner_id] = [];
    petsByOwner[p.owner_id].push(p);
  });

  const filteredOwners = owners.filter(o => !o.deleted_at).filter(o =>
    o.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.contact_number?.includes(search) ||
    (refs.barangayMap[o.barangay_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (petsByOwner[o.owner_id] ?? []).some(p =>
      p.pet_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.pet_type?.toLowerCase().includes(search.toLowerCase())
    )
  );

  function toggle(ownerId) {
    setExpanded(e => ({ ...e, [ownerId]: !e[ownerId] }));
  }

  async function handleDelete(pet) {
    const res = await authFetch(`/api/vetdata/pet/${pet.pet_id}`, { method: 'DELETE' });
    if (res.ok) {
      setDeletingPet(null);
      forceRefresh(n => n + 1);
      window.location.reload();
    } else {
      alert('Failed to delete pet.');
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>🐾 Pet Owners & Their Pets</h1>
          <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>{filteredOwners.length} owner{filteredOwners.length !== 1 ? 's' : ''}</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owners or pets…"
          style={{ border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.88rem', outline: 'none', background: '#fff', width: 260 }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading…</p>
      ) : filteredOwners.length === 0 ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>No records found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredOwners.map(owner => {
            const ownerPets = petsByOwner[owner.owner_id] ?? [];
            const isOpen = expanded[owner.owner_id] ?? false;
            return (
              <div key={owner.owner_id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {/* Owner row */}
                <div
                  onClick={() => toggle(owner.owner_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', cursor: 'pointer', background: isOpen ? MAROON_LIGHT : '#fff', transition: 'background 0.15s' }}
                  onMouseOver={e => { if (!isOpen) e.currentTarget.style.background = '#fafafa'; }}
                  onMouseOut={e => { if (!isOpen) e.currentTarget.style.background = '#fff'; }}
                >
                  <span style={{ fontSize: '1.1rem', minWidth: 24 }}>{isOpen ? '▾' : '▸'}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: '#111', fontSize: '0.95rem' }}>{owner.owner_name}</span>
                    <span style={{ color: '#888', fontSize: '0.82rem', marginLeft: '0.75rem' }}>{owner.contact_number}</span>
                    <span style={{ color: '#aaa', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
                      {refs.barangayMap[owner.barangay_id] ?? `Brgy #${owner.barangay_id}`}
                    </span>
                  </div>
                  <span style={{
                    background: ownerPets.length > 0 ? MAROON_LIGHT : '#f5f5f5',
                    color: ownerPets.length > 0 ? MAROON : '#aaa',
                    borderRadius: '999px', padding: '0.2rem 0.75rem',
                    fontSize: '0.78rem', fontWeight: 700,
                  }}>
                    {ownerPets.length} pet{ownerPets.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Pets list */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f0f0f0' }}>
                    {ownerPets.length === 0 ? (
                      <p style={{ color: '#aaa', fontSize: '0.85rem', padding: '1rem 1.5rem', margin: 0 }}>No pets registered for this owner.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            {['ID', 'Pet Name', 'Type', 'Color', 'Age', '', ''].map(h => (
                              <th key={h} style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ownerPets.map((pet, i) => (
                            <tr key={pet.pet_id} style={{ borderTop: '1px solid #f5f5f5' }}
                              onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
                              onMouseOut={e => e.currentTarget.style.background = ''}
                            >
                              <td style={{ padding: '0.8rem 1.25rem', color: '#bbb' }}>#{pet.pet_id}</td>
                              <td style={{ padding: '0.8rem 1.25rem', fontWeight: 600, color: '#333' }}>
                                {pet.pet_type?.toLowerCase().includes('cat') ? '🐱' : '🐶'} {pet.pet_name}
                              </td>
                              <td style={{ padding: '0.8rem 1.25rem', color: '#555' }}>{pet.pet_type || '—'}</td>
                              <td style={{ padding: '0.8rem 1.25rem', color: '#555' }}>{pet.pet_color || '—'}</td>
                              <td style={{ padding: '0.8rem 1.25rem', color: '#555' }}>{pet.pet_age || '—'}</td>
                              <td style={{ padding: '0.8rem 1.25rem' }}>
                                <button onClick={() => setEditingPet(pet)} style={{ background: MAROON_LIGHT, border: `1px solid ${MAROON}30`, color: MAROON, borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                  Edit
                                </button>
                              </td>
                              <td style={{ padding: '0.8rem 1.25rem' }}>
                                <button onClick={() => setDeletingPet(pet)} style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPet && (
        <VetEditPetModal
          pet={editingPet}
          onClose={() => setEditingPet(null)}
          onSaved={() => { setEditingPet(null); window.location.reload(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingPet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '2rem', maxWidth: 380, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗑️</div>
            <h3 style={{ fontWeight: 800, color: '#111', margin: '0 0 0.5rem' }}>Delete Pet?</h3>
            <p style={{ color: '#555', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{deletingPet.pet_name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeletingPet(null)} style={{ flex: 1, background: '#f5f5f5', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#555' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deletingPet)} style={{ flex: 1, background: '#dc2626', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VetEditPetModal({ pet, onClose, onSaved }) {
  const [form, setForm] = useState({
    pet_name:  pet.pet_name  || '',
    pet_type:  pet.pet_type  || '',
    pet_color: pet.pet_color || '',
    pet_age:   pet.pet_age   || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (!form.pet_name.trim()) return setError('Pet name is required.');
    setSaving(true);
    setError('');
    const res = await authFetch(`/api/vetdata/pet/${pet.pet_id}`, {
      method: 'PATCH',
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError('Failed to save changes. Please try again.');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontWeight: 800, color: '#111', margin: '0 0 0.2rem', fontSize: '1.1rem' }}>Edit Pet</h2>
            <p style={{ color: '#888', fontSize: '0.82rem', margin: 0 }}>Update information for {pet.pet_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#aaa' }}>✕</button>
        </div>
        {error && <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { key: 'pet_name',  label: 'Pet Name',       placeholder: 'e.g. Mango' },
            { key: 'pet_type',  label: 'Type / Species', placeholder: 'e.g. Dog, Cat, Aspin' },
            { key: 'pet_color', label: 'Color',          placeholder: 'e.g. Brown' },
            { key: 'pet_age',   label: 'Age',            placeholder: 'e.g. 2 years' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem' }}>{label}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} required={key === 'pet_name'}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.9rem', outline: 'none', background: '#fafafa' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: saving ? '#b0b0b0' : MAROON, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VaccinationsTab({ refs }) {
  const { rows, loading } = useVetTable('vaccine_table');
  const [search, setSearch] = useState('');
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('vaccine_table', 'vaccine_id');
  const filtered = rows.filter(r => !r.deleted_at).filter(r =>
    (refs.petMap[r.pet_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.vaccine_details?.toLowerCase().includes(search.toLowerCase()) ||
    r.manufacturer_no?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <>
      <TablePage title="Vaccinations" icon="💉" subtitle={`${filtered.length} records`}
        search={search} onSearch={setSearch} loading={loading} empty="No records found."
        columns={['ID', 'Pet', 'Veterinarian', 'Date', 'Vaccine Details', 'Manufacturer No.', 'Type']}
        rows={filtered.map(r => [
          `#${r.vaccine_id}`,
          refs.petMap[r.pet_id] ?? `Pet #${r.pet_id}`,
          refs.vetMap[r.vet_id] ?? `Vet #${r.vet_id}`,
          r.vaccine_date ? new Date(r.vaccine_date).toLocaleDateString() : '—',
          r.vaccine_details || '—', r.manufacturer_no || '—',
          r.is_office_visit ? 'Office Visit' : 'Barangay Drive',
        ])}
        rawRows={filtered} onEdit={setEditing} onDelete={setDeleting}
      />
      {editing  && <GenericEditModal title="Vaccination" fields={[{ key:'vaccine_date', label:'Vaccine Date', type:'date', required:true }, { key:'vaccine_details', label:'Vaccine Details' }, { key:'manufacturer_no', label:'Manufacturer No.' }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={`Vaccination #${deleting.vaccine_id}`} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}

function ApprovalIdsTab({ refs }) {
  const { rows, loading } = useVetTable('approval_id_table');
  const [search, setSearch] = useState('');
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('approval_id_table', 'approval_id');
  const filtered = rows.filter(r =>
    r.approval_code?.toLowerCase().includes(search.toLowerCase()) ||
    (refs.vetMap[r.vet_id] ?? '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <>
      <TablePage title="Approval IDs" icon="🆔" subtitle={`${filtered.length} issued`}
        search={search} onSearch={setSearch} loading={loading} empty="No records found."
        columns={['ID', 'Approval Code', 'Issued By', 'Date']}
        rows={filtered.map(r => [
          `#${r.approval_id}`, r.approval_code || '—',
          refs.vetMap[r.vet_id] ?? `Vet #${r.vet_id}`,
          r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
        ])}
        rawRows={filtered} onEdit={setEditing} onDelete={setDeleting}
      />
      {editing  && <GenericEditModal title="Approval ID" fields={[{ key:'approval_code', label:'Approval Code', required:true }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={`Approval #${deleting.approval_id}`} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}

function DriveSessionsTab({ refs }) {
  const { rows, loading } = useVetTable('drive_session_table');
  const [search, setSearch] = useState('');
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('drive_session_table', 'session_id');
  const filtered = rows.filter(r =>
    (refs.barangayMap[r.barangay_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.session_date ?? '').includes(search)
  );
  return (
    <>
      <TablePage title="Drive Sessions" icon="📍" subtitle={`${filtered.length} sessions`}
        search={search} onSearch={setSearch} loading={loading} empty="No records found."
        columns={['Session ID', 'Barangay', 'Session Date', 'Last Updated']}
        rows={filtered.map(r => [
          `#${r.session_id}`,
          refs.barangayMap[r.barangay_id] ?? `Brgy #${r.barangay_id}`,
          r.session_date ? new Date(r.session_date).toLocaleDateString() : '—',
          r.updated_at   ? new Date(r.updated_at).toLocaleDateString()   : '—',
        ])}
        rawRows={filtered} onEdit={setEditing} onDelete={setDeleting}
      />
      {editing  && <GenericEditModal title="Drive Session" fields={[{ key:'session_date', label:'Session Date', type:'date', required:true }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={`Session #${deleting.session_id}`} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}

function BarangaysTab() {
  const { rows, loading } = useVetTable('barangay_table');
  const [search, setSearch] = useState('');
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('barangay_table', 'barangay_id');
  const filtered = rows.filter(r => r.barangay_name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <TablePage title="Barangays" icon="🏘️" subtitle={`${filtered.length} barangays covered`}
        search={search} onSearch={setSearch} loading={loading} empty="No records found."
        columns={['ID', 'Barangay Name', 'Last Updated']}
        rows={filtered.map(r => [
          `#${r.barangay_id}`, r.barangay_name || '—',
          r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
        ])}
        rawRows={filtered} onEdit={setEditing} onDelete={setDeleting}
      />
      {editing  && <GenericEditModal title="Barangay" fields={[{ key:'barangay_name', label:'Barangay Name', required:true }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={deleting.barangay_name} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}

function VeterinariansTab() {
  const [reloadKey, setReloadKey]   = useState(0);
  const { rows, loading }           = useVetTable('vet_table', reloadKey);
  const [search, setSearch]         = useState('');
  const [addingVet, setAddingVet]   = useState(false);
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('vet_table', 'vet_id');
  const filtered = rows.filter(r => r.vet_name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <TablePage title="Veterinarians" icon="⚕️" subtitle={`${filtered.length} on record`}
        search={search} onSearch={setSearch} loading={loading} empty="No records found."
        columns={['ID', 'Name', 'Email', 'Last Updated']}
        rows={filtered.map(r => [
          `#${r.vet_id}`, r.vet_name || '—', r.email || '—',
          r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
        ])}
        rawRows={filtered} onEdit={setEditing} onDelete={setDeleting}
        onAdd={() => setAddingVet(true)} addLabel="Add Vet"
      />
      {addingVet && <AddVetModal onClose={() => setAddingVet(false)} onCreated={() => { setAddingVet(false); setReloadKey(k => k + 1); }} />}
      {editing   && <GenericEditModal title="Veterinarian" fields={[{ key:'vet_name', label:'Veterinarian Name', required:true }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting  && <DeleteConfirm name={deleting.vet_name} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}

// ── Pending Approvals Tab ─────────────────────────────────────────────────────

// Defined OUTSIDE PendingApprovalsTab — prevents remount on every keystroke
function RequestCard({ req, refs, note, setNote, acting, review }) {
  const petName = refs.petMap?.[req.pet_id] ?? `Pet #${req.pet_id}`;
  const state   = acting[req.request_id];
  const isDone  = state === 'done' || req.status !== 'pending';

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', padding: '1.25rem 1.5rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontWeight: 700, color: '#111', fontSize: '0.95rem' }}>{petName}</span>
          <span style={{ color: '#aaa', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
            Requested {new Date(req.created_at).toLocaleDateString()}
          </span>
        </div>
        {req.status === 'pending' && !isDone && <span style={{ background: '#fef9c3', color: '#7a5800', border: '1px solid #f0d080', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem' }}>⏳ Pending</span>}
        {req.status === 'approved' && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem' }}>✓ Approved</span>}
        {req.status === 'rejected' && <span style={{ background: '#fff5f5', color: '#dc2626', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem' }}>✗ Rejected</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: '#fafafa', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.73rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current Data</p>
          {[['Name', refs.petMap?.[req.pet_id] ?? '—'], ['Type', '—'], ['Color', '—'], ['Age', '—']].map(([label, val]) => (
            <p key={label} style={{ margin: '3px 0', fontSize: '0.84rem', color: '#555' }}><strong style={{ color: '#888' }}>{label}:</strong> {val}</p>
          ))}
        </div>
        <div style={{ background: MAROON_LIGHT, borderRadius: '8px', padding: '0.85rem 1rem', border: `1px solid ${MAROON}20` }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.73rem', fontWeight: 700, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Requested Changes</p>
          {[['Name', req.pet_name], ['Type', req.pet_type], ['Color', req.pet_color], ['Age', req.pet_age]].map(([label, val]) => (
            <p key={label} style={{ margin: '3px 0', fontSize: '0.84rem', color: '#333', fontWeight: val ? 600 : 400 }}><strong style={{ color: '#888' }}>{label}:</strong> {val || '—'}</p>
          ))}
        </div>
      </div>

      {req.status === 'pending' && !isDone && (
        <>
          <textarea
            rows={2}
            value={note[req.request_id] ?? ''}
            onChange={e => setNote(n => ({ ...n, [req.request_id]: e.target.value }))}
            placeholder="Optional note to the pet owner…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.85rem', outline: 'none', marginBottom: '0.75rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button disabled={!!state} onClick={() => review(req.request_id, 'rejected')}
              style={{ flex: 1, background: state ? '#f5f5f5' : '#fff5f5', border: '1.5px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.88rem', cursor: state ? 'not-allowed' : 'pointer' }}>
              {state === 'rejecting' ? 'Rejecting…' : '✗ Reject'}
            </button>
            <button disabled={!!state} onClick={() => review(req.request_id, 'approved')}
              style={{ flex: 2, background: state ? '#b0b0b0' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.88rem', cursor: state ? 'not-allowed' : 'pointer' }}>
              {state === 'approving' ? 'Approving…' : state === 'done' ? '✓ Approved!' : '✓ Approve'}
            </button>
          </div>
        </>
      )}

      {req.reviewer_note && (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#777', fontStyle: 'italic' }}>Note: {req.reviewer_note}</p>
      )}
    </div>
  );
}

function PendingApprovalsTab({ refs, onReviewed }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [note, setNote]         = useState({});
  const [acting, setActing]     = useState({});

  useEffect(() => {
    authFetch('/api/pets/all-requests')
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pending  = requests.filter(r => r.status === 'pending');
  const reviewed = requests.filter(r => r.status !== 'pending');

  async function review(requestId, action) {
    setActing(a => ({ ...a, [requestId]: action === 'approved' ? 'approving' : 'rejecting' }));
    try {
      const res = await authFetch('/api/pets/review-request', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId, action, reviewer_note: note[requestId] ?? '' }),
      });
      if (res.ok) {
        setActing(a => ({ ...a, [requestId]: 'done' }));
        setRequests(r => r.map(req => req.request_id === requestId ? { ...req, status: action } : req));
        onReviewed();
      } else {
        setActing(a => ({ ...a, [requestId]: 'error' }));
      }
    } catch {
      setActing(a => ({ ...a, [requestId]: 'error' }));
    }
  }

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>✅ Edit Approvals</h1>
        <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>
          Review and approve pet information changes requested by owners.
        </p>
      </div>

      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading…</p>
      ) : pending.length === 0 && reviewed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#aaa' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
          <p style={{ fontWeight: 700, color: '#555', margin: '0 0 0.4rem' }}>No pending requests</p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>All pet edit requests have been reviewed.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111', margin: '0 0 1rem' }}>
                Pending — {pending.length} request{pending.length !== 1 ? 's' : ''}
              </h2>
              {pending.map(req => <RequestCard key={req.request_id} req={req} refs={refs} note={note} setNote={setNote} acting={acting} review={review} />)}
            </div>
          )}

          {reviewed.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#aaa', margin: '0 0 1rem' }}>
                Reviewed — {reviewed.length} request{reviewed.length !== 1 ? 's' : ''}
              </h2>
              {reviewed.map(req => <RequestCard key={req.request_id} req={req} refs={refs} note={note} setNote={setNote} acting={acting} review={review} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Vet Account Modal ─────────────────────────────────────────────────────────

function VetAccountModal({ fullName, onClose, onChangePwd, onLogout }) {
  function initials(name) {
    if (!name) return 'V';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: MAROON, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
            {initials(fullName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.93rem', color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
            <div style={{ display: 'inline-block', marginTop: 3, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: MAROON_LIGHT, color: MAROON, border: `1px solid ${MAROON}`, padding: '1px 8px', borderRadius: 999 }}>Vet / Admin</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: '4px', flexShrink: 0 }}>×</button>
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onChangePwd}
            style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.72rem 1rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', color: '#333', textAlign: 'left', fontFamily: 'inherit' }}
            onMouseOver={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseOut={e => e.currentTarget.style.background = '#f9fafb'}
          >🔑 Change Password</button>
          <div style={{ borderTop: '1px solid #f0f0f0', margin: '2px 0' }} />
          <button onClick={onLogout}
            style={{ width: '100%', background: 'none', border: 'none', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', color: '#6b7280', textAlign: 'left', fontFamily: 'inherit' }}
            onMouseOver={e => e.currentTarget.style.color = '#111'}
            onMouseOut={e => e.currentTarget.style.color = '#6b7280'}
          >Sign out</button>
        </div>
      </div>
    </div>
  );
}

// Shows the real API error when the dashboard loads with no data
function DataError() {
  const [msg, setMsg] = useState('Checking connection…');

  useEffect(() => {
    async function probe() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setMsg('No active session — please log out and log back in.'); return; }
        const res  = await fetch(`${API_BASE}/api/vetdata/owner_table`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setMsg(`Server error ${res.status}: ${body.error ?? res.statusText}`);
        else if (Array.isArray(body) && body.length === 0) setMsg('Connected — owner_table is empty in Supabase.');
        else setMsg(null); // data loaded fine, hide banner
      } catch (e) {
        setMsg(`Cannot reach server: ${e.message}. Make sure the Express server is running on port 5001.`);
      }
    }
    probe();
  }, []);

  if (!msg) return null;
  return (
    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '0.9rem 1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
      <div>
        <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: '#92400e', fontSize: '0.88rem' }}>No data loaded</p>
        <p style={{ margin: 0, color: '#b45309', fontSize: '0.82rem' }}>{msg}</p>
      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

// Generic table page with optional edit/delete/add support
function TablePage({ title, icon, subtitle, search, onSearch, loading, empty, columns, rows, rawRows, onEdit, onDelete, onAdd, addLabel }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>{icon} {title}</h1>
          <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onAdd && (
            <button onClick={onAdd}
              style={{ background: MAROON, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              onMouseOver={e => e.currentTarget.style.background = MAROON_DARK}
              onMouseOut={e => e.currentTarget.style.background = MAROON}
            >
              + {addLabel ?? `Add ${title.replace(/s$/, '')}`}
            </button>
          )}
          <input value={search} onChange={e => onSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            style={{ border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.88rem', outline: 'none', background: '#fff', width: 240 }}
          />
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        {loading
          ? <p style={{ color: '#aaa', fontSize: '0.88rem', textAlign: 'center', padding: '3rem', margin: 0 }}>Loading…</p>
          : rows.length === 0
          ? <p style={{ color: '#aaa', fontSize: '0.88rem', textAlign: 'center', padding: '3rem', margin: 0 }}>{empty}</p>
          : <DataTable columns={columns} rows={rows} rawRows={rawRows} onEdit={onEdit} onDelete={onDelete} />
        }
      </div>
    </>
  );
}

function DataTable({ columns, rows, rawRows, onEdit, onDelete }) {
  const hasActions = onEdit || onDelete;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
      <thead>
        <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
          {columns.map(col => (
            <th key={col} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.73rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
              {col}
            </th>
          ))}
          {hasActions && <th style={{ padding: '0.85rem 1.25rem', width: 130 }} />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f5f5f5' : 'none' }}
            onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
            onMouseOut={e => e.currentTarget.style.background = ''}
          >
            {row.map((cell, j) => (
              <td key={j} style={{ padding: '0.9rem 1.25rem', color: j === 0 ? '#aaa' : '#333', fontWeight: j === 1 ? 600 : 400, whiteSpace: 'nowrap' }}>
                {cell}
              </td>
            ))}
            {hasActions && (
              <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {onEdit && (
                  <button onClick={() => onEdit(rawRows?.[i])} style={{ background: MAROON_LIGHT, border: `1px solid ${MAROON}30`, color: MAROON, borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', marginRight: '0.4rem' }}>
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => onDelete(rawRows?.[i])} style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    Delete
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Generic edit modal — accepts field definitions
function GenericEditModal({ title, fields, initialValues, onSave, onClose }) {
  const [form, setForm]     = useState({ ...initialValues });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [focused, setFocused] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: MAROON, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontWeight: 800, color: '#fff', margin: '0 0 0.15rem', fontSize: '1.05rem' }}>Edit {title}</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0, fontSize: '0.78rem' }}>Update the fields below and save</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1rem', flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {fields.map(({ key, label, type = 'text', required }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {label}{required && <span style={{ color: MAROON, marginLeft: '0.2rem' }}>*</span>}
                </label>
                <input
                  type={type}
                  required={required}
                  value={form[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  onFocus={() => setFocused(key)}
                  onBlur={() => setFocused('')}
                  style={{
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
                  }}
                />
              </div>
            ))}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ flex: 2, background: saving ? '#d1d5db' : MAROON, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                onMouseOver={e => { if (!saving) e.currentTarget.style.background = MAROON_DARK; }}
                onMouseOut={e => { if (!saving) e.currentTarget.style.background = MAROON; }}
              >
                {saving ? 'Saving…' : '✓ Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Add Vet modal — creates vet_table row + user_profile + Supabase auth in one call
function AddVetModal({ onClose, onCreated }) {
  const [form, setForm]         = useState({ vet_name: '', email: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [created, setCreated]   = useState(null); // { vet_name, email, password }
  const [focused, setFocused]   = useState('');
  const [copied, setCopied]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res  = await authFetch('/api/vetdata/vet_table', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create vet account');
      setCreated(data);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(created.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const inputStyle = (key) => ({
    width: '100%', boxSizing: 'border-box',
    border: `2px solid ${focused === key ? MAROON : '#e5e7eb'}`,
    borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.92rem',
    outline: 'none', background: focused === key ? '#fff' : '#f9fafb',
    color: '#111', transition: 'border-color 0.15s, background 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: MAROON, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontWeight: 800, color: '#fff', margin: '0 0 0.15rem', fontSize: '1.05rem' }}>
              {created ? 'Vet Account Created' : 'Add Veterinarian'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0, fontSize: '0.78rem' }}>
              {created ? 'Share these credentials with the vet' : 'Creates login access for both systems'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1rem', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* ── Success state ── */}
          {created ? (
            <>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.6rem', fontWeight: 700, color: '#166534', fontSize: '0.88rem' }}>Account ready — record these credentials now</p>
                <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#111' }}><strong>Name:</strong> {created.vet_name}</p>
                <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#111' }}><strong>Email:</strong> {created.email}</p>
                <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#111' }}>
                  <strong>Password:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: '1rem', background: '#fff', padding: '2px 10px', borderRadius: '6px', border: '1px solid #d1fae5', letterSpacing: 1 }}>
                    {created.password}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={copyPassword}
                  style={{ flex: 1, background: copied ? '#166534' : '#f3f4f6', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: copied ? '#fff' : '#555', fontWeight: 600 }}>
                  {copied ? 'Copied!' : 'Copy Password'}
                </button>
                <button onClick={onCreated}
                  style={{ flex: 2, background: MAROON, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
                  onMouseOver={e => e.currentTarget.style.background = MAROON_DARK}
                  onMouseOut={e => e.currentTarget.style.background = MAROON}
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            /* ── Create form ── */
            <>
              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Veterinarian Name <span style={{ color: MAROON }}>*</span>
                  </label>
                  <input type="text" required value={form.vet_name}
                    onChange={e => setForm(f => ({ ...f, vet_name: e.target.value }))}
                    onFocus={() => setFocused('vet_name')} onBlur={() => setFocused('')}
                    style={inputStyle('vet_name')} placeholder="e.g. Dr. Juan Santos"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Email Address <span style={{ color: MAROON }}>*</span>
                  </label>
                  <input type="email" required value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onFocus={() => setFocused('email')} onBlur={() => setFocused('')}
                    style={inputStyle('email')} placeholder="vet@example.com"
                  />
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.77rem', color: '#888' }}>
                    Used for login on both the online and local systems. A password will be generated automatically.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button type="button" onClick={onClose}
                    style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ flex: 2, background: saving ? '#d1d5db' : MAROON, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
                    onMouseOver={e => { if (!saving) e.currentTarget.style.background = MAROON_DARK; }}
                    onMouseOut={e => { if (!saving) e.currentTarget.style.background = MAROON; }}
                  >
                    {saving ? 'Creating…' : 'Create Vet Account'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Generic delete confirmation
function DeleteConfirm({ name, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '2rem', maxWidth: 380, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗑️</div>
        <h3 style={{ fontWeight: 800, color: '#111', margin: '0 0 0.5rem' }}>Delete Record?</h3>
        <p style={{ color: '#555', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{ flex: 1, background: '#f5f5f5', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#555' }}>Cancel</button>
          <button disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); }} style={{ flex: 1, background: deleting ? '#b0b0b0' : '#dc2626', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', color: '#fff' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable confirmation modal
function ConfirmModal({ icon, title, message, confirmLabel, confirmColor = MAROON, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: confirmColor, padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>{icon}</div>
          <h2 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1.05rem' }}>{title}</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1.5rem', textAlign: 'center', whiteSpace: 'pre-line' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onCancel}
              style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555', fontWeight: 600 }}>
              Cancel
            </button>
            <button disabled={loading} onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }}
              style={{ flex: 2, background: loading ? '#b0b0b0' : confirmColor, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Processing…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for edit/delete state management
function useEditDelete(table, pk) {
  const [editing,  setEditing]  = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function saveEdit(form) {
    const res = await authFetch(`/api/vetdata/${table}/${form[pk]}`, { method: 'PATCH', body: JSON.stringify(form) });
    if (!res.ok) throw new Error('Failed to save');
    setEditing(null);
    window.location.reload();
  }

  async function confirmDelete() {
    const res = await authFetch(`/api/vetdata/${table}/${deleting[pk]}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    setDeleting(null);
    window.location.reload();
  }

  return { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete };
}
