import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const MAROON = '#7B1B2E';
const MAROON_DARK = '#5a1221';
const MAROON_LIGHT = '#f5e8ea';

// ── Data fetching via backend (bypasses RLS) ──────────────────────────────────

async function fetchTable(table) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/vetdata/${table}`, {
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

  const navItems = [
    { id: 'overview',       icon: '⊞',  label: 'Overview' },
    { id: 'owners',         icon: '👤', label: 'Pet Owners' },
    { id: 'pets',           icon: '🐾', label: 'Pets' },
    { id: 'vaccinations',   icon: '💉', label: 'Vaccinations' },
    { id: 'approval_ids',   icon: '🆔', label: 'Approval IDs' },
    { id: 'drive_sessions', icon: '📍', label: 'Drive Sessions' },
    { id: 'barangays',      icon: '🏘️', label: 'Barangays' },
    { id: 'veterinarians',  icon: '⚕️', label: 'Veterinarians' },
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
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>Veterinarian</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'rgba(255,255,255,0.85)', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 230, flex: 1, padding: '2rem 2.5rem', minHeight: '100vh' }}>
        {activeTab === 'overview'       && <OverviewTab setActiveTab={setActiveTab} refs={refs} />}
        {activeTab === 'owners'         && <OwnersTab refs={refs} />}
        {activeTab === 'pets'           && <PetsTab refs={refs} />}
        {activeTab === 'vaccinations'   && <VaccinationsTab refs={refs} />}
        {activeTab === 'approval_ids'   && <ApprovalIdsTab refs={refs} />}
        {activeTab === 'drive_sessions' && <DriveSessionsTab refs={refs} />}
        {activeTab === 'barangays'      && <BarangaysTab />}
        {activeTab === 'veterinarians'  && <VeterinariansTab />}
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
    { label: 'Pet Owners',    key: 'owners',    icon: '👤', tab: 'owners',         color: '#3b82f6' },
    { label: 'Pets on File',  key: 'pets',      icon: '🐾', tab: 'pets',           color: MAROON },
    { label: 'Vaccinations',  key: 'vaccines',  icon: '💉', tab: 'vaccinations',   color: '#10b981' },
    { label: 'Approval IDs',  key: 'approvals', icon: '🆔', tab: 'approval_ids',   color: '#f59e0b' },
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

function OwnersTab({ refs }) {
  const { rows, loading } = useVetTable('owner_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r => !r.deleted_at).filter(r =>
    r.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_number?.includes(search) ||
    (refs.barangayMap[r.barangay_id] ?? '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <TablePage title="Pet Owners" icon="👤" subtitle={`${filtered.length} registered`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['ID', 'Name', 'Contact Number', 'Barangay', 'Last Updated']}
      rows={filtered.map(r => [
        `#${r.owner_id}`, r.owner_name || '—', r.contact_number || '—',
        refs.barangayMap[r.barangay_id] ?? `Brgy #${r.barangay_id}`,
        r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
      ])}
    />
  );
}

function PetsTab({ refs }) {
  const { rows, loading } = useVetTable('pet_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r => !r.deleted_at).filter(r =>
    r.pet_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.pet_type?.toLowerCase().includes(search.toLowerCase()) ||
    (refs.ownerMap[r.owner_id] ?? '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <TablePage title="Pets" icon="🐾" subtitle={`${filtered.length} on file`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['ID', 'Pet Name', 'Type', 'Color', 'Age', 'Owner']}
      rows={filtered.map(r => [
        `#${r.pet_id}`, r.pet_name || '—', r.pet_type || '—',
        r.pet_color || '—', r.pet_age || '—',
        refs.ownerMap[r.owner_id] ?? `Owner #${r.owner_id}`,
      ])}
    />
  );
}

function VaccinationsTab({ refs }) {
  const { rows, loading } = useVetTable('vaccine_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r => !r.deleted_at).filter(r =>
    (refs.petMap[r.pet_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (refs.vetMap[r.vet_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.vaccine_details?.toLowerCase().includes(search.toLowerCase()) ||
    r.manufacturer_no?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <TablePage title="Vaccinations" icon="💉" subtitle={`${filtered.length} records`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['ID', 'Pet', 'Veterinarian', 'Date', 'Vaccine Details', 'Manufacturer No.', 'Type', 'Session']}
      rows={filtered.map(r => [
        `#${r.vaccine_id}`,
        refs.petMap[r.pet_id] ?? `Pet #${r.pet_id}`,
        refs.vetMap[r.vet_id] ?? `Vet #${r.vet_id}`,
        r.vaccine_date ? new Date(r.vaccine_date).toLocaleDateString() : '—',
        r.vaccine_details || '—', r.manufacturer_no || '—',
        r.is_office_visit ? 'Office Visit' : 'Barangay Drive',
        r.session_id ? `Session #${r.session_id}` : '—',
      ])}
    />
  );
}

function ApprovalIdsTab({ refs }) {
  const { rows, loading } = useVetTable('approval_id_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r =>
    r.approval_code?.toLowerCase().includes(search.toLowerCase()) ||
    (refs.vetMap[r.vet_id] ?? '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <TablePage title="Approval IDs" icon="🆔" subtitle={`${filtered.length} issued`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['ID', 'Approval Code', 'Issued By', 'Date']}
      rows={filtered.map(r => [
        `#${r.approval_id}`, r.approval_code || '—',
        refs.vetMap[r.vet_id] ?? `Vet #${r.vet_id}`,
        r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
      ])}
    />
  );
}

function DriveSessionsTab({ refs }) {
  const { rows, loading } = useVetTable('drive_session_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r =>
    (refs.barangayMap[r.barangay_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.session_date ?? '').includes(search)
  );
  return (
    <TablePage title="Drive Sessions" icon="📍" subtitle={`${filtered.length} sessions`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['Session ID', 'Barangay', 'Session Date', 'Last Updated']}
      rows={filtered.map(r => [
        `#${r.session_id}`,
        refs.barangayMap[r.barangay_id] ?? `Brgy #${r.barangay_id}`,
        r.session_date ? new Date(r.session_date).toLocaleDateString() : '—',
        r.updated_at   ? new Date(r.updated_at).toLocaleDateString()   : '—',
      ])}
    />
  );
}

function BarangaysTab() {
  const { rows, loading } = useVetTable('barangay_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r => r.barangay_name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <TablePage title="Barangays" icon="🏘️" subtitle={`${filtered.length} barangays covered`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['ID', 'Barangay Name', 'Last Updated']}
      rows={filtered.map(r => [
        `#${r.barangay_id}`, r.barangay_name || '—',
        r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
      ])}
    />
  );
}

function VeterinariansTab() {
  const { rows, loading } = useVetTable('vet_table');
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r => r.vet_name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <TablePage title="Veterinarians" icon="⚕️" subtitle={`${filtered.length} on record`}
      search={search} onSearch={setSearch} loading={loading} empty="No records found."
      columns={['ID', 'Name', 'Last Updated']}
      rows={filtered.map(r => [
        `#${r.vet_id}`, r.vet_name || '—',
        r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—',
      ])}
    />
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function TablePage({ title, icon, subtitle, search, onSearch, loading, empty, columns, rows }) {
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
          : <DataTable columns={columns} rows={rows} />
        }
      </div>
    </>
  );
}

function DataTable({ columns, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
      <thead>
        <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
          {columns.map(col => (
            <th key={col} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.73rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
              {col}
            </th>
          ))}
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}