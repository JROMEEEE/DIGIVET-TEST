const router = require('express').Router();
const requireAuth = require('../middleware/auth');

const TABLES = [
  { table: 'barangay_table',      pk: 'barangay_id' },
  { table: 'vet_table',           pk: 'vet_id' },
  { table: 'owner_table',         pk: 'owner_id' },
  { table: 'pet_table',           pk: 'pet_id' },
  { table: 'drive_session_table', pk: 'session_id' },
  { table: 'approval_id_table',   pk: 'approval_id' },
  { table: 'vaccine_table',       pk: 'vaccine_id' },
  { table: 'pet_edit_requests',   pk: 'request_id' },
];

// POST /api/sync/to-local — pulls all data from Supabase and upserts into local PostgreSQL
router.post('/to-local', requireAuth, async (req, res) => {
  if (!process.env.LOCAL_DATABASE_URL) {
    return res.status(400).json({ error: 'Local database is not configured or unavailable.' });
  }

  try {
    const getSupabase = require('../supabase');
    const { Pool }    = require('pg');
    const supabase    = getSupabase();

    const pool    = new Pool({ connectionString: process.env.LOCAL_DATABASE_URL, connectionTimeoutMillis: 5000 });
    const results = {};

    for (const { table, pk } of TABLES) {
      // Fetch all rows from Supabase
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        results[table] = { synced: 0, error: error.message };
        continue;
      }
      if (!data?.length) {
        results[table] = { synced: 0 };
        continue;
      }

      // Build dynamic upsert from column names
      const columns      = Object.keys(data[0]);
      const colList      = columns.map(c => `"${c}"`).join(', ');
      const updates      = columns.filter(c => c !== pk).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

      let synced = 0;
      for (const row of data) {
        const values       = columns.map(c => row[c] ?? null);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `
          INSERT INTO ${table} (${colList})
          VALUES (${placeholders})
          ON CONFLICT ("${pk}") DO UPDATE SET ${updates}
        `;
        try {
          await pool.query(sql, values);
          synced++;
        } catch { /* skip individual row failures */ }
      }

      results[table] = { synced, total: data.length };
    }

    await pool.end();

    const totalSynced = Object.values(results).reduce((s, r) => s + (r.synced ?? 0), 0);
    res.json({ success: true, totalSynced, tables: results, syncedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

module.exports = router;