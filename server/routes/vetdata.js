const router = require('express').Router();
const requireAuth = require('../middleware/auth');

const ALLOWED_TABLES = [
  'owner_table',
  'pet_table',
  'vaccine_table',
  'approval_id_table',
  'drive_session_table',
  'barangay_table',
  'vet_table',
];

// GET /api/vetdata/:table
// Queries local PostgreSQL first (full data), falls back to Supabase (synced subset)
// Never combines both — local DB is the single source of truth
router.get('/:table', requireAuth, async (req, res) => {
  const { table } = req.params;

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Table "${table}" is not accessible` });
  }

  // ── Try local PostgreSQL first ─────────────────────────────────────────────
  if (process.env.LOCAL_DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.LOCAL_DATABASE_URL, connectionTimeoutMillis: 3000 });
      const sql = buildQuery(table);
      const { rows } = await pool.query(sql);
      await pool.end();
      if (rows.length > 0) return res.json(rows);
    } catch { /* local DB unavailable, fall through */ }
  }

  // ── Fallback: Supabase ─────────────────────────────────────────────────────
  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();
    const { data, error } = await supabase.from(table).select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Build table-specific SQL: deduplicates rows and hides soft-deleted entries
function buildQuery(table) {
  switch (table) {
    case 'owner_table':
      // Deduplicate by (owner_name, contact_number), keep lowest owner_id, hide deleted
      return `
        SELECT DISTINCT ON (LOWER(owner_name), contact_number) *
        FROM owner_table
        WHERE deleted_at IS NULL
        ORDER BY LOWER(owner_name), contact_number, owner_id
      `;
    case 'pet_table':
      return `
        SELECT DISTINCT ON (pet_name, owner_id) *
        FROM pet_table
        WHERE deleted_at IS NULL
        ORDER BY pet_name, owner_id, pet_id
      `;
    case 'vaccine_table':
      return `SELECT * FROM vaccine_table WHERE deleted_at IS NULL ORDER BY vaccine_id`;
    default:
      return `SELECT * FROM ${table} ORDER BY 1`;
  }
}

module.exports = router;