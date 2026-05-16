const router = require('express').Router();
const requireAuth = require('../middleware/auth');

async function runAutoProvision() {
  const getSupabase = require('../supabase');
  const supabase    = getSupabase();
  const { generatePassword, sendCredentialsEmail, syncOwnerLocalCredentials, upsertSupabaseUser } = require('./authHelpers');

  // Owners with emails in Supabase
  const { data: owners, error } = await supabase
    .from('owner_table')
    .select('owner_id, owner_name, email')
    .not('email', 'is', null)
    .neq('email', '')
    .is('deleted_at', null);

  if (error || !owners?.length) return { provisioned: 0, skipped: 0, errors: [] };

  // Check which emails already have a Supabase auth account
  // Use listUsers only once here (unavoidable for bulk status check)
  const { data: listData } = await supabase.auth.admin.listUsers();
  const existingEmails = new Set(
    (listData?.users ?? []).map(u => u.email?.toLowerCase())
  );

  const toProvision = owners.filter(o => {
    const e = o.email?.toLowerCase().trim();
    return e && !existingEmails.has(e);
  });

  if (!toProvision.length) return { provisioned: 0, skipped: owners.length, errors: [] };

  // Send all in parallel — much faster than sequential
  const settled = await Promise.allSettled(
    toProvision.map(async owner => {
      const email    = owner.email.toLowerCase().trim();
      const password = generatePassword();
      const metadata = { full_name: owner.owner_name, role: 'pet_owner', owner_id: owner.owner_id };

      await upsertSupabaseUser(supabase, email, password, metadata);
      await syncOwnerLocalCredentials(supabase, owner.owner_id, email, password, owner.owner_name);
      await sendCredentialsEmail(email, owner.owner_name, password);
      console.log(`[provision] ✓ ${email}`);
    })
  );

  const errors     = settled.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  const provisioned = settled.filter(r => r.status === 'fulfilled').length;

  return { provisioned, skipped: owners.length - toProvision.length, errors };
}

// POST /api/provision/run
router.post('/run', requireAuth, async (req, res) => {
  try {
    const results = await runAutoProvision();
    res.json({ message: 'Auto-provision complete', ...results });
  } catch (err) {
    res.status(500).json({ error: 'Provisioning failed: ' + err.message });
  }
});

// GET /api/provision/status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase    = getSupabase();

    const { data: owners } = await supabase
      .from('owner_table')
      .select('owner_id, owner_name, email')
      .not('email', 'is', null)
      .neq('email', '')
      .is('deleted_at', null);

    const { data: listData } = await supabase.auth.admin.listUsers();
    const existingEmails = new Set((listData?.users ?? []).map(u => u.email?.toLowerCase()));

    const pending     = (owners ?? []).filter(o => !existingEmails.has(o.email?.toLowerCase()));
    const provisioned = (owners ?? []).filter(o =>  existingEmails.has(o.email?.toLowerCase()));

    res.json({ pending, provisioned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, runAutoProvision };
