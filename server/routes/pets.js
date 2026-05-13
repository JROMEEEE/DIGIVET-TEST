const router = require('express').Router();
const requireAuth = require('../middleware/auth');

// GET /api/pets/mine — returns the authenticated pet owner's pets from both local DB and Supabase
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();

    let ownerId = req.user.user_metadata?.owner_id;

    // If owner_id is missing, try to find it by matching the user's name or email
    if (!ownerId) {
      ownerId = await resolveOwnerId(req.user, supabase);

      // Persist it back to the Supabase auth account so future logins have it
      if (ownerId) {
        await supabase.auth.admin.updateUserById(req.user.id, {
          user_metadata: { ...req.user.user_metadata, owner_id: ownerId },
        });
      }
    }

    if (!ownerId) return res.json([]);

    const pets = await fetchPetsFromBoth(ownerId, supabase);
    res.json(pets);
  } catch (err) {
    console.error('pets/mine error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Local DB is the source of truth — only fall back to Supabase if unavailable
async function fetchPetsFromBoth(ownerId, supabase) {
  if (process.env.LOCAL_DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.LOCAL_DATABASE_URL, connectionTimeoutMillis: 3000 });
      const { rows } = await pool.query(
        'SELECT pet_id, pet_name, pet_type, pet_color, pet_age, owner_id FROM pet_table WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY pet_id DESC',
        [ownerId]
      );
      await pool.end();
      if (rows.length > 0) return rows;
    } catch { /* local DB unavailable, fall through */ }
  }

  // Fallback: Supabase only
  const { data } = await supabase
    .from('pet_table')
    .select('pet_id, pet_name, pet_type, pet_color, pet_age, owner_id')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('pet_id', { ascending: false });
  return data ?? [];
}

// Try to find owner_id from owner_table when it is not in user metadata
async function resolveOwnerId(user, supabase) {
  const displayName = user.user_metadata?.full_name || '';
  const email = user.email || '';

  // Try local DB owner_table by name or email
  if (process.env.LOCAL_DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.LOCAL_DATABASE_URL, connectionTimeoutMillis: 3000 });
      const { rows } = await pool.query(
        `SELECT owner_id FROM owner_table
         WHERE deleted_at IS NULL
           AND (LOWER(owner_name) = LOWER($1) OR LOWER(email) = LOWER($2))
         LIMIT 1`,
        [displayName.trim(), email.trim()]
      );
      await pool.end();
      if (rows.length > 0) return rows[0].owner_id;
    } catch { /* fall through */ }
  }

  // Fallback: Supabase owner_table by name
  const { data } = await supabase
    .from('owner_table')
    .select('owner_id')
    .ilike('owner_name', displayName.trim())
    .is('deleted_at', null)
    .maybeSingle();
  return data?.owner_id ?? null;
}

// GET /api/pets/vaccinations — latest vaccination per pet for the owner
router.get('/vaccinations', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();

    let ownerId = req.user.user_metadata?.owner_id;
    if (!ownerId) {
      ownerId = await resolveOwnerId(req.user, supabase);
    }
    if (!ownerId) return res.json([]);

    // Get all owner pets first
    const pets = await fetchPetsFromBoth(ownerId, supabase);
    if (!pets.length) return res.json([]);

    const petIds = pets.map(p => p.pet_id);
    const vaccMap = new Map(); // pet_id → latest vaccine record

    // ── Local DB vaccines ─────────────────────────────────────────────────
    if (process.env.LOCAL_DATABASE_URL) {
      try {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.LOCAL_DATABASE_URL, connectionTimeoutMillis: 3000 });
        const placeholders = petIds.map((_, i) => `$${i + 1}`).join(',');
        const { rows } = await pool.query(
          `SELECT DISTINCT ON (pet_id) pet_id, vaccine_date, vaccine_details
           FROM vaccine_table
           WHERE pet_id IN (${placeholders}) AND deleted_at IS NULL
           ORDER BY pet_id, vaccine_date DESC`,
          petIds
        );
        await pool.end();
        rows.forEach(r => vaccMap.set(r.pet_id, r));
      } catch { /* fall through */ }
    }

    // ── Supabase vaccines ─────────────────────────────────────────────────
    for (const petId of petIds) {
      if (vaccMap.has(petId)) continue; // already found in local DB
      const { data } = await supabase
        .from('vaccine_table')
        .select('pet_id, vaccine_date, vaccine_details')
        .eq('pet_id', petId)
        .is('deleted_at', null)
        .order('vaccine_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) vaccMap.set(petId, data);
    }

    // Merge pet info with latest vaccination
    const result = pets.map(pet => ({
      pet_id:          pet.pet_id,
      pet_name:        pet.pet_name,
      pet_type:        pet.pet_type,
      last_vaccine_date:    vaccMap.get(pet.pet_id)?.vaccine_date ?? null,
      last_vaccine_details: vaccMap.get(pet.pet_id)?.vaccine_details ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error('pets/vaccinations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;