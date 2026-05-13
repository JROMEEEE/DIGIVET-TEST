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

// GET /api/vetdata/:table — all data from Supabase using service role (bypasses RLS)
router.get('/:table', requireAuth, async (req, res) => {
  const { table } = req.params;

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Table "${table}" is not accessible` });
  }

  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();

    let query;
    switch (table) {
      case 'owner_table':
        query = supabase.from(table).select('*').is('deleted_at', null).order('owner_id');
        break;
      case 'pet_table':
        query = supabase.from(table).select('*').is('deleted_at', null).order('pet_id');
        break;
      case 'vaccine_table':
        query = supabase.from(table).select('*').is('deleted_at', null).order('vaccine_id');
        break;
      default:
        query = supabase.from(table).select('*');
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Primary key per table
const TABLE_PKS = {
  owner_table:        'owner_id',
  pet_table:          'pet_id',
  vaccine_table:      'vaccine_id',
  approval_id_table:  'approval_id',
  drive_session_table:'session_id',
  barangay_table:     'barangay_id',
  vet_table:          'vet_id',
};

// Tables that use soft delete (have deleted_at column)
const SOFT_DELETE = new Set(['owner_table', 'pet_table', 'vaccine_table']);

// PATCH /api/vetdata/:table/:id — update any allowed table row
router.patch('/:table/:id', requireAuth, async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Table not allowed' });

  const pk = TABLE_PKS[table];
  const fields = req.body;
  delete fields[pk]; // never update the primary key

  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();
    const { error } = await supabase.from(table).update(fields).eq(pk, id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/vetdata/:table/:id — soft or hard delete
router.delete('/:table/:id', requireAuth, async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Table not allowed' });

  const pk = TABLE_PKS[table];
  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();
    let error;
    if (SOFT_DELETE.has(table)) {
      ({ error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq(pk, id));
    } else {
      ({ error } = await supabase.from(table).delete().eq(pk, id));
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;