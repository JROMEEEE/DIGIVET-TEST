import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
  const res = await fetch(`${API_BASE}/api/vetdata/${table}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load ${table}`);
  return res.json();
}

function useVetTable(table) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTable(table)
      .then(data => { setRows(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [table]);

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

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState('');

  async function syncToLocal() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res  = await authFetch('/api/sync/to-local', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`✓ Synced ${data.totalSynced} records at ${new Date(data.syncedAt).toLocaleTimeString()}`);
      } else {
        setSyncMsg('✗ ' + (data.error || 'Sync failed'));
      }
    } catch {
      setSyncMsg('✗ Cannot reach local database');
    } finally {
      setSyncing(false);
    }
  }

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
    { id: 'overview',      icon: '⊞',  label: 'Overview' },
    { id: 'owners',        icon: '👤', label: 'Pet Owners' },
    { id: 'records',       icon: '📋', label: 'Records' },
    { id: 'approvals',     icon: '✅', label: 'Edit Approvals', badge: pendingCount },
    { id: 'veterinarians', icon: '⚕️', label: 'Veterinarians' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f6fa' }}>

      <aside style={{ width: 230, background: MAROON, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10 }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.75rem' }}>DV</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', lineHeight: 1.1 }}>DIGIVET</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Vet Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
          {navItems.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.65rem 1.25rem',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              border: 'none', borderLeft: activeTab === tab.id ? '3px solid #fff' : '3px solid transparent',
              color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.7)',
              fontSize: '0.86rem', fontWeight: activeTab === tab.id ? 700 : 400,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.badge > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>
                  {tab.badge}
                </span>
              )}
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
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>Veterinarian</div>
            </div>
          </div>
          <button
            onClick={syncToLocal}
            disabled={syncing}
            style={{ width: '100%', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', color: '#fff', padding: '0.5rem', fontSize: '0.82rem', cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 600, marginBottom: '0.5rem', opacity: syncing ? 0.7 : 1 }}
          >
            {syncing ? '⏳ Syncing…' : '🔄 Sync to Local'}
          </button>

          {syncMsg && (
            <p style={{ fontSize: '0.7rem', color: syncMsg.startsWith('✓') ? '#86efac' : '#fca5a5', margin: '0 0 0.5rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {syncMsg}
            </p>
          )}

          <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'rgba(255,255,255,0.85)', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 230, flex: 1, padding: '2rem 2.5rem', minHeight: '100vh' }}>
        {activeTab === 'overview'       && <OverviewTab setActiveTab={setActiveTab} refs={refs} />}
        {activeTab === 'owners'         && <OwnersTab refs={refs} />}
        {activeTab === 'records'       && <RecordsTab refs={refs} />}
        {activeTab === 'approvals'     && <PendingApprovalsTab refs={refs} onReviewed={() => setPendingCount(c => Math.max(0, c - 1))} />}
        {activeTab === 'veterinarians' && <VeterinariansTab />}
      </main>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ setActiveTab, refs }) {
  const { rows: owners }    = useVetTable('owner_table');
  const { rows: pets }      = useVetTable('pet_table');
  const { rows: vaccines }  = useVetTable('vaccine_table');
  const { rows: approvals } = useVetTable('approval_id_table');
  const { rows: sessions }  = useVetTable('drive_session_table');
  const { rows: barangays } = useVetTable('barangay_table');
  const { rows: vets }      = useVetTable('vet_table');

  const stats = {
    owners:    owners.filter(r => !r.deleted_at).length,
    pets:      pets.filter(r => !r.deleted_at).length,
    vaccines:  vaccines.filter(r => !r.deleted_at).length,
    approvals: approvals.length,
    sessions:  sessions.length,
    barangays: barangays.length,
    vets:      vets.length,
  };

  const cards = [
    { label: 'Pet Owners',    key: 'owners',    icon: '👤', tab: 'records',  color: '#3b82f6' },
    { label: 'Pets on File',  key: 'pets',      icon: '🐾', tab: 'records',  color: MAROON },
    { label: 'Vaccinations',  key: 'vaccines',  icon: '💉', tab: 'records',  color: '#10b981' },
    { label: 'Approval IDs',  key: 'approvals', icon: '🆔', tab: 'records',  color: '#f59e0b' },
    { label: 'Drive Sessions',key: 'sessions',  icon: '📍', tab: 'drive_sessions', color: '#8b5cf6' },
    { label: 'Barangays',     key: 'barangays', icon: '🏘️', tab: 'barangays',      color: '#06b6d4' },
    { label: 'Veterinarians', key: 'vets',      icon: '⚕️', tab: 'veterinarians',  color: '#ec4899' },
  ];

  const recentVaccines = vaccines
    .filter(r => !r.deleted_at)
    .sort((a, b) => b.vaccine_id - a.vaccine_id)
    .slice(0, 6);

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>Dashboard Overview</h1>
        <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>All records across the DIGIVET system.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {cards.map(({ label, key, icon, tab, color }) => (
          <div key={key} onClick={() => setActiveTab(tab)}
            style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', cursor: 'pointer' }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.05)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{stats[key] ?? '…'}</div>
              </div>
              <span style={{ fontSize: '1.4rem' }}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', margin: '0 0 1rem' }}>Recent Vaccinations</h2>
        {recentVaccines.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>No vaccination records yet.</p>
        ) : (
          <DataTable
            columns={['Pet', 'Veterinarian', 'Date', 'Details', 'Type']}
            rows={recentVaccines.map(r => [
              refs.petMap[r.pet_id]  ?? `Pet #${r.pet_id}`,
              refs.vetMap[r.vet_id]  ?? `Vet #${r.vet_id}`,
              r.vaccine_date ? new Date(r.vaccine_date).toLocaleDateString() : '—',
              r.vaccine_details || '—',
              r.is_office_visit ? 'Office Visit' : 'Barangay Drive',
            ])}
          />
        )}
      </div>
    </>
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

  const btnEdit = (table, pk, row, fields, title) => (
    <button onClick={e => { e.stopPropagation(); setModal({ table, pk, row, fields, title }); }}
      style={{ background: MAROON_LIGHT, border: `1px solid ${MAROON}30`, color: MAROON, borderRadius: '5px', padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginRight: 4 }}>
      Edit
    </button>
  );
  const btnDel = (table, pk, name, row) => (
    <button onClick={e => { e.stopPropagation(); setDelModal({ table, pk, name, row }); }}
      style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '5px', padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
      Delete
    </button>
  );

  const selectStyle = { border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer', color: '#333' };

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>📋 Records</h1>
        <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>Grouped by barangay. Filter by drive session or search by name.</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owners, pets, vaccines…"
          style={{ ...selectStyle, flex: 1, minWidth: 200 }} />
        <select value={filterBrgy} onChange={e => setFilterBrgy(e.target.value)} style={selectStyle}>
          <option value="">All Barangays</option>
          {barangays.map(b => (
            <option key={b.barangay_id} value={b.barangay_id}>{b.barangay_name}</option>
          ))}
        </select>
        <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={selectStyle}>
          <option value="">All Drive Sessions</option>
          {sessions.sort((a,b) => new Date(b.session_date) - new Date(a.session_date)).map(s => (
            <option key={s.session_id} value={s.session_id}>
              {refs.barangayMap[s.barangay_id] ?? `Brgy #${s.barangay_id}`} — {s.session_date ? new Date(s.session_date).toLocaleDateString() : '—'}
            </option>
          ))}
        </select>
        {(filterBrgy || filterSession || search) && (
          <button onClick={() => { setFilterBrgy(''); setFilterSession(''); setSearch(''); }}
            style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '0.55rem 1rem', fontSize: '0.84rem', cursor: 'pointer', color: '#666', fontWeight: 600 }}>
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading…</p>
      ) : barangayIds.length === 0 ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>No records found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {barangayIds.map(brgyId => {
            const brgyName    = refs.barangayMap[brgyId] ?? `Barangay #${brgyId}`;
            const brgyOwners  = byBarangay[brgyId];
            const brgyKey     = `b${brgyId}`;
            const brgyOpen    = expanded[brgyKey] !== false; // open by default

            return (
              <div key={brgyId}>
                {/* Barangay header */}
                <div
                  onClick={() => toggle(brgyKey)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 1rem', background: MAROON, borderRadius: '10px', cursor: 'pointer', marginBottom: '0.5rem' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{brgyOpen ? '▾' : '▸'}</span>
                  <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>🏘️ {brgyName}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    {brgyOwners.length} owner{brgyOwners.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Owners in this barangay */}
                {brgyOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                    {brgyOwners.map(owner => {
                      const ownerKey  = `o${owner.owner_id}`;
                      const ownerOpen = expanded[ownerKey];
                      const ownerPets = (petsByOwner[owner.owner_id] ?? []).filter(p =>
                        !petIdsInSession || petIdsInSession.has(p.pet_id)
                      );

                      return (
                        <div key={owner.owner_id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                          {/* Owner row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: ownerOpen ? '#fdf2f4' : '#fff', borderBottom: ownerOpen ? '1px solid #f0f0f0' : 'none' }}>
                            <span onClick={() => toggle(ownerKey)} style={{ cursor: 'pointer', color: '#aaa', fontSize: '0.85rem', userSelect: 'none' }}>{ownerOpen ? '▾' : '▸'}</span>
                            <div onClick={() => toggle(ownerKey)} style={{ flex: 1, cursor: 'pointer' }}>
                              <span style={{ fontWeight: 700, color: '#111', fontSize: '0.9rem' }}>{owner.owner_name}</span>
                              <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{owner.contact_number}</span>
                            </div>
                            <span style={{ background: ownerPets.length ? MAROON_LIGHT : '#f5f5f5', color: ownerPets.length ? MAROON : '#aaa', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.73rem', fontWeight: 700, marginRight: 6 }}>
                              {ownerPets.length} pet{ownerPets.length !== 1 ? 's' : ''}
                            </span>
                            {btnEdit('owner_table', 'owner_id', owner, [{ key:'owner_name', label:'Owner Name', required:true }, { key:'contact_number', label:'Contact Number' }], 'Owner')}
                            {btnDel('owner_table', 'owner_id', owner.owner_name, owner)}
                          </div>

                          {/* Pets */}
                          {ownerOpen && ownerPets.map(pet => {
                            const petKey  = `p${pet.pet_id}`;
                            const petOpen = expanded[petKey];
                            const petVacc = (vaccByPet[pet.pet_id] ?? [])
                              .filter(v => !filterSession || String(v.session_id) === filterSession)
                              .sort((a, b) => new Date(b.vaccine_date) - new Date(a.vaccine_date));

                            return (
                              <div key={pet.pet_id} style={{ borderTop: '1px solid #f5f5f5' }}>
                                {/* Pet row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.25rem 0.7rem 2.5rem', background: petOpen ? '#f8f8fb' : 'transparent' }}>
                                  <span onClick={() => toggle(petKey)} style={{ cursor: 'pointer', color: '#bbb', fontSize: '0.8rem', userSelect: 'none' }}>{petOpen ? '▾' : '▸'}</span>
                                  <span style={{ fontSize: '1.1rem' }}>{pet.pet_type?.toLowerCase().includes('cat') ? '🐱' : '🐶'}</span>
                                  <div onClick={() => toggle(petKey)} style={{ flex: 1, cursor: 'pointer' }}>
                                    <span style={{ fontWeight: 600, color: '#222', fontSize: '0.87rem' }}>{pet.pet_name}</span>
                                    <span style={{ color: '#888', fontSize: '0.77rem', marginLeft: '0.6rem' }}>{[pet.pet_type, pet.pet_color, pet.pet_age].filter(Boolean).join(' · ')}</span>
                                  </div>
                                  <span style={{ background: petVacc.length ? '#f0fdf4' : '#f5f5f5', color: petVacc.length ? '#16a34a' : '#aaa', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, marginRight: 6 }}>
                                    {petVacc.length} vaccine{petVacc.length !== 1 ? 's' : ''}
                                  </span>
                                  {btnEdit('pet_table', 'pet_id', pet, [{ key:'pet_name', label:'Pet Name', required:true }, { key:'pet_type', label:'Type / Species' }, { key:'pet_color', label:'Color' }, { key:'pet_age', label:'Age' }], 'Pet')}
                                  {btnDel('pet_table', 'pet_id', pet.pet_name, pet)}
                                </div>

                                {/* Vaccination records */}
                                {petOpen && (
                                  <div style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                                    {petVacc.length === 0 ? (
                                      <p style={{ color: '#ccc', fontSize: '0.82rem', padding: '0.75rem 1.25rem 0.75rem 4rem', margin: 0 }}>No vaccination records.</p>
                                    ) : petVacc.map((v, vi) => (
                                      <div key={v.vaccine_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem 0.6rem 4rem', borderTop: vi > 0 ? '1px solid #f0f0f0' : 'none' }}>
                                        <span style={{ fontSize: '1rem' }}>💉</span>
                                        <div style={{ flex: 1, fontSize: '0.82rem' }}>
                                          <span style={{ fontWeight: 600, color: '#333' }}>{v.vaccine_date ? new Date(v.vaccine_date).toLocaleDateString() : '—'}</span>
                                          <span style={{ color: '#555', marginLeft: '0.6rem' }}>{v.vaccine_details || '—'}</span>
                                          {v.manufacturer_no && <span style={{ color: '#aaa', marginLeft: '0.5rem', fontSize: '0.77rem' }}>· {v.manufacturer_no}</span>}
                                          {v.approval_id && <span style={{ background: '#fef9c3', color: '#7a5800', borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.71rem', fontWeight: 700, marginLeft: '0.5rem' }}>🆔 {approvalMap[v.approval_id] ?? `#${v.approval_id}`}</span>}
                                          {v.session_id && <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.71rem', fontWeight: 600, marginLeft: '0.5rem' }}>📍 Session #{v.session_id}</span>}
                                          <span style={{ color: '#bbb', marginLeft: '0.5rem', fontSize: '0.75rem' }}>{v.is_office_visit ? 'Office Visit' : 'Barangay Drive'}</span>
                                        </div>
                                        {btnEdit('vaccine_table', 'vaccine_id', v, [{ key:'vaccine_date', label:'Date', type:'date', required:true }, { key:'vaccine_details', label:'Vaccine Details' }, { key:'manufacturer_no', label:'Manufacturer No.' }], 'Vaccination')}
                                        {btnDel('vaccine_table', 'vaccine_id', `Vaccination #${v.vaccine_id}`, v)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {ownerOpen && ownerPets.length === 0 && (
                            <p style={{ color: '#ccc', fontSize: '0.82rem', padding: '0.75rem 1.25rem 0.75rem 2.5rem', margin: 0 }}>No pets registered.</p>
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
      )}

      {modal && <GenericEditModal title={modal.title} fields={modal.fields} initialValues={modal.row} onSave={handleSave} onClose={() => setModal(null)} />}
      {delModal && <DeleteConfirm name={delModal.name} onConfirm={handleDelete} onCancel={() => setDelModal(null)} />}
    </>
  );
}

function OwnersTab({ refs }) {
  const { rows, loading } = useVetTable('owner_table');
  const [search, setSearch]         = useState('');
  const [sending, setSending]       = useState({});
  const [provisioning, setProvision] = useState(false);
  const [provisionMsg, setProvisionMsg] = useState('');
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('owner_table', 'owner_id');
  const [credStatus, setCredStatus] = useState(null);

useEffect(() => {
  authFetch('/api/credentials/status')
    .then(data => setCredStatus(data))
    .catch(() => {});
}, []);


  async function runProvision() {
  setProvision(true);
  setProvisionMsg('');
  try {
    const res  = await authFetch('/api/credentials/send-now', { method: 'POST' });
    const data = await res.json();
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

  async function sendCredentials(owner) {
    setSending(s => ({ ...s, [owner.owner_id]: 'sending' }));
    try {
      const res = await authFetch('/api/auth/send-owner-credentials', {
        method: 'POST',
        body: JSON.stringify({ owner_id: owner.owner_id }),
      });
      const data = await res.json();
      setSending(s => ({ ...s, [owner.owner_id]: res.ok ? 'sent' : 'error' }));
      if (!res.ok) alert(data.error || 'Failed to send credentials');
    } catch {
      setSending(s => ({ ...s, [owner.owner_id]: 'error' }));
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>👤 Pet Owners</h1>
          <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>{filtered.length} registered</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owners…"
            style={{ border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.88rem', outline: 'none', background: '#fff', width: 220 }}
          />
          <button onClick={runProvision} disabled={provisioning} style={{
            background: MAROON, color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '0.85rem',
            cursor: provisioning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            opacity: provisioning ? 0.7 : 1,
          }}>
            {provisioning ? 'Sending…' : '📧 Send All Credentials'}
          </button>
        </div>
      </div>

      {provisionMsg && (
        <div style={{ background: provisionMsg.startsWith('✓') ? '#f0fdf4' : '#fff5f5', border: `1px solid ${provisionMsg.startsWith('✓') ? '#86efac' : '#ffcccc'}`, borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.85rem', color: provisionMsg.startsWith('✓') ? '#166534' : '#cc0000', marginBottom: '1rem' }}>
          {provisionMsg}
        </div>
      )}

      {credStatus && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Credentials Sent', value: credStatus.sent,    color: '#166534', bg: '#dcfce7' },
            { label: 'Staged (unsent)',   value: credStatus.staged,  color: '#7a5800', bg: '#fef9c3' },
            { label: 'Not yet staged',    value: credStatus.pending, color: '#888',    bg: '#f5f5f5' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.82rem', color, fontWeight: 600 }}>
              {value} — {label}
            </div>
          ))}
        </div>
      )}


      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        {loading ? (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem', margin: 0 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem', margin: 0 }}>No records found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                {['ID', 'Name', 'Contact Number', 'Email', 'Barangay', 'Credentials', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.73rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const state = sending[r.owner_id];
                return (
                  <tr key={r.owner_id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f5f5f5' : 'none' }}
                    onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseOut={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '0.9rem 1.25rem', color: '#aaa' }}>{`#${r.owner_id}`}</td>
                    <td style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: '#333' }}>{r.owner_name || '—'}</td>
                    <td style={{ padding: '0.9rem 1.25rem', color: '#555' }}>{r.contact_number || '—'}</td>
                    <td style={{ padding: '0.9rem 1.25rem', color: '#555' }}>{r.email || <span style={{ color: '#ccc' }}>No email</span>}</td>
                    <td style={{ padding: '0.9rem 1.25rem', color: '#555' }}>{refs.barangayMap[r.barangay_id] ?? `Brgy #${r.barangay_id}`}</td>
                    <td style={{ padding: '0.9rem 1.25rem' }}>
                      {state === 'sent'
                        ? <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>✓ Sent</span>
                        : state === 'error'
                        ? <span style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>✗ Failed</span>
                        : null}
                    </td>
                    <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                      {r.email ? (
                        <button
                          onClick={() => sendCredentials(r)}
                          disabled={state === 'sending' || state === 'sent'}
                          style={{
                            background: state === 'sent' ? '#dcfce7' : MAROON_LIGHT,
                            border: `1px solid ${state === 'sent' ? '#86efac' : MAROON}30`,
                            color: state === 'sent' ? '#166534' : MAROON,
                            borderRadius: '6px', padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem', fontWeight: 700, cursor: state === 'sending' || state === 'sent' ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent ✓' : 'Send Credentials'}
                        </button>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '0.8rem' }}>No email</span>
                      )}
                    </td>
                    <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setEditing(r)} style={{ background: MAROON_LIGHT, border: `1px solid ${MAROON}30`, color: MAROON, borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', marginRight: '0.4rem' }}>Edit</button>
                      <button onClick={() => setDeleting(r)} style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing  && <GenericEditModal title="Owner" fields={[{ key:'owner_name', label:'Owner Name', required:true }, { key:'contact_number', label:'Contact Number' }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={deleting.owner_name} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
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
  const { rows, loading } = useVetTable('vet_table');
  const [search, setSearch] = useState('');
  const { editing, setEditing, deleting, setDeleting, saveEdit, confirmDelete } = useEditDelete('vet_table', 'vet_id');
  const filtered = rows.filter(r => r.vet_name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <TablePage title="Veterinarians" icon="⚕️" subtitle={`${filtered.length} on record`}
        search={search} onSearch={setSearch} loading={loading} empty="No records found."
        columns={['ID', 'Name', 'Last Updated']}
        rows={filtered.map(r => [
          `#${r.vet_id}`, r.vet_name || '—',
          r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
        ])}
        rawRows={filtered} onEdit={setEditing} onDelete={setDeleting}
      />
      {editing  && <GenericEditModal title="Veterinarian" fields={[{ key:'vet_name', label:'Veterinarian Name', required:true }]} initialValues={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm name={deleting.vet_name} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </>
  );
}

// ── Pending Approvals Tab ─────────────────────────────────────────────────────

function PendingApprovalsTab({ refs, onReviewed }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [note, setNote]         = useState({});     // request_id → reviewer note
  const [acting, setActing]     = useState({});     // request_id → 'approving'|'rejecting'|'done'|'error'

  useEffect(() => {
    authFetch('/api/pets/all-requests')
      .then(r => r.json())
      .then(data => { setRequests(data ?? []); setLoading(false); })
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

  function RequestCard({ req }) {
    const petName  = refs.petMap?.[req.pet_id]  ?? `Pet #${req.pet_id}`;
    const state    = acting[req.request_id];
    const isDone   = state === 'done' || req.status !== 'pending';

    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', padding: '1.25rem 1.5rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontWeight: 700, color: '#111', fontSize: '0.95rem' }}>{petName}</span>
            <span style={{ color: '#aaa', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
              Requested {new Date(req.created_at).toLocaleDateString()}
            </span>
          </div>
          {req.status === 'pending' && !isDone && (
            <span style={{ background: '#fef9c3', color: '#7a5800', border: '1px solid #f0d080', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem' }}>
              ⏳ Pending
            </span>
          )}
          {(req.status === 'approved' || state === 'done' && acting[req.request_id] === 'approving') && (
            <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem' }}>✓ Approved</span>
          )}
          {req.status === 'rejected' && (
            <span style={{ background: '#fff5f5', color: '#dc2626', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem' }}>✗ Rejected</span>
          )}
        </div>

        {/* Current vs Proposed comparison */}
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

        {/* Reviewer note input + action buttons (only for pending) */}
        {req.status === 'pending' && !isDone && (
          <>
            <input
              value={note[req.request_id] ?? ''}
              onChange={e => setNote(n => ({ ...n, [req.request_id]: e.target.value }))}
              placeholder="Optional note to the pet owner…"
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.85rem', outline: 'none', marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                disabled={!!state}
                onClick={() => review(req.request_id, 'rejected')}
                style={{ flex: 1, background: state ? '#f5f5f5' : '#fff5f5', border: '1.5px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.88rem', cursor: state ? 'not-allowed' : 'pointer' }}
              >
                {state === 'rejecting' ? 'Rejecting…' : '✗ Reject'}
              </button>
              <button
                disabled={!!state}
                onClick={() => review(req.request_id, 'approved')}
                style={{ flex: 2, background: state ? '#b0b0b0' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem', fontWeight: 700, fontSize: '0.88rem', cursor: state ? 'not-allowed' : 'pointer' }}
              >
                {state === 'approving' ? 'Approving…' : state === 'done' ? '✓ Approved!' : '✓ Approve'}
              </button>
            </div>
          </>
        )}

        {req.reviewer_note && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#777', fontStyle: 'italic' }}>
            Note: {req.reviewer_note}
          </p>
        )}
      </div>
    );
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
              {pending.map(req => <RequestCard key={req.request_id} req={req} />)}
            </div>
          )}

          {reviewed.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#aaa', margin: '0 0 1rem' }}>
                Reviewed — {reviewed.length} request{reviewed.length !== 1 ? 's' : ''}
              </h2>
              {reviewed.map(req => <RequestCard key={req.request_id} req={req} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

// Generic table page with optional edit/delete support
function TablePage({ title, icon, subtitle, search, onSearch, loading, empty, columns, rows, rawRows, onEdit, onDelete }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: '0 0 0.3rem' }}>{icon} {title}</h1>
          <p style={{ color: '#777', margin: 0, fontSize: '0.9rem' }}>{subtitle}</p>
        </div>
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          style={{ border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.88rem', outline: 'none', background: '#fff', width: 240 }}
        />
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
  const [form, setForm] = useState({ ...initialValues });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 800, color: '#111', margin: 0, fontSize: '1.1rem' }}>Edit {title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#aaa' }}>✕</button>
        </div>
        {error && <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {fields.map(({ key, label, type = 'text', required }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem' }}>{label}</label>
              <input
                type={type} required={required}
                value={form[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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