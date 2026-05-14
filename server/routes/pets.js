const router = require('express').Router();
const requireAuth = require('../middleware/auth');

// GET /api/pets/mine — pet owner's pets from Supabase (service role bypasses RLS)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();

    let ownerId = req.user.user_metadata?.owner_id;

    // If owner_id missing, resolve it from owner_table by name/email
    if (!ownerId) {
      ownerId = await resolveOwnerId(req.user, supabase);
      if (ownerId) {
        await supabase.auth.admin.updateUserById(req.user.id, {
          user_metadata: { ...req.user.user_metadata, owner_id: ownerId },
        });
      }
    }

    if (!ownerId) return res.json([]);

    const { data, error } = await supabase
      .from('pet_table')
      .select('pet_id, pet_name, pet_type, pet_color, pet_age, owner_id')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('pet_id', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/pets/vaccinations — all vaccine records per pet, grouped
router.get('/vaccinations', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase = getSupabase();

    let ownerId = req.user.user_metadata?.owner_id;
    if (!ownerId) ownerId = await resolveOwnerId(req.user, supabase);
    if (!ownerId) return res.json([]);

    const { data: pets } = await supabase
      .from('pet_table')
      .select('pet_id, pet_name, pet_type')
      .eq('owner_id', ownerId)
      .is('deleted_at', null);

    if (!pets?.length) return res.json([]);

    const petIds = pets.map(p => p.pet_id);

    // Get ALL vaccinations for these pets (newest first)
    const { data: vaccines } = await supabase
      .from('vaccine_table')
      .select('vaccine_id, pet_id, vaccine_date, vaccine_details, manufacturer_no, is_office_visit')
      .in('pet_id', petIds)
      .is('deleted_at', null)
      .order('vaccine_date', { ascending: false });

    // Group all records by pet_id
    const vaccByPet = {};
    (vaccines ?? []).forEach(v => {
      if (!vaccByPet[v.pet_id]) vaccByPet[v.pet_id] = [];
      vaccByPet[v.pet_id].push(v);
    });

    const result = pets.map(pet => {
      const records = vaccByPet[pet.pet_id] ?? [];
      const latest  = records[0] ?? null;
      return {
        pet_id:               pet.pet_id,
        pet_name:             pet.pet_name,
        pet_type:             pet.pet_type,
        total_doses:          records.length,
        last_vaccine_date:    latest?.vaccine_date    ?? null,
        last_vaccine_details: latest?.vaccine_details ?? null,
        records,              // all individual vaccine records
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Resolve owner_id from Supabase owner_table by name (partial) or email
async function resolveOwnerId(user, supabase) {
  const displayName = (user.user_metadata?.full_name || '').trim();
  const email       = (user.email || '').trim();

  // Try exact email match first (most reliable)
  if (email) {
    const { data: byEmail } = await supabase
      .from('owner_table')
      .select('owner_id')
      .ilike('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    if (byEmail) return byEmail.owner_id;
  }

  // Try partial name match with wildcard
  if (displayName) {
    const { data: byName } = await supabase
      .from('owner_table')
      .select('owner_id')
      .ilike('owner_name', `%${displayName}%`)
      .is('deleted_at', null)
      .maybeSingle();
    if (byName) return byName.owner_id;
  }

  return null;
}

// GET /api/pets/all-requests — vet gets ALL pending edit requests
router.get('/all-requests', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase    = getSupabase();

    const { data, error } = await supabase
      .from('pet_edit_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pets/review-request — vet approves or rejects an edit request
router.post('/review-request', requireAuth, async (req, res) => {
  const { request_id, action, reviewer_note } = req.body;
  if (!request_id || !['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'request_id and action (approved/rejected) required' });
  }

  try {
    const getSupabase = require('../supabase');
    const supabase    = getSupabase();

    // Get the request
    const { data: request, error: fetchErr } = await supabase
      .from('pet_edit_requests')
      .select('*')
      .eq('request_id', request_id)
      .maybeSingle();

    if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(409).json({ error: 'This request has already been reviewed' });

    // If approved, update the actual pet record
    if (action === 'approved') {
      const { error: updateErr } = await supabase
        .from('pet_table')
        .update({
          pet_name:  request.pet_name,
          pet_type:  request.pet_type,
          pet_color: request.pet_color,
          pet_age:   request.pet_age,
        })
        .eq('pet_id', request.pet_id);

      if (updateErr) return res.status(500).json({ error: 'Failed to update pet: ' + updateErr.message });
    }

    // Mark request as reviewed
    await supabase
      .from('pet_edit_requests')
      .update({ status: action, reviewed_at: new Date().toISOString(), reviewer_note: reviewer_note ?? null })
      .eq('request_id', request_id);

    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pets/edit-request — pet owner submits an edit request for vet approval
router.post('/edit-request', requireAuth, async (req, res) => {
  const { pet_id, pet_name, pet_type, pet_color, pet_age } = req.body;
  if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

  try {
    const getSupabase = require('../supabase');
    const supabase    = getSupabase();

    const ownerId = req.user.user_metadata?.owner_id ?? null;

    // Only one pending request per pet at a time
    const { data: existing } = await supabase
      .from('pet_edit_requests')
      .select('request_id')
      .eq('pet_id', pet_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'This pet already has a pending edit request awaiting approval.' });
    }

    const { error } = await supabase
      .from('pet_edit_requests')
      .insert({ pet_id, owner_id: ownerId, pet_name, pet_type, pet_color, pet_age, status: 'pending' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/pets/edit-requests — get pending edit requests for the owner's pets
router.get('/edit-requests', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase    = getSupabase();

    const ownerId = req.user.user_metadata?.owner_id;
    if (!ownerId) return res.json([]);

    const { data, error } = await supabase
      .from('pet_edit_requests')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;