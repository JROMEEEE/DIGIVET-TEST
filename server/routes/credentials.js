const router = require('express').Router();
const requireAuth = require('../middleware/auth');

// ── STEP 2: Stage credentials (fast — no email) ──────────────────────────────
async function stageCredentials() {
  const getSupabase = require('../supabase');
  const { generatePassword } = require('./authHelpers');
  const supabase = getSupabase();

  // Find owners with email, not yet staged and not yet sent
  const { data: owners } = await supabase
    .from('owner_table')
    .select('owner_id, owner_name, email')
    .not('email', 'is', null)
    .neq('email', '')
    .is('deleted_at', null)
    .is('pending_password', null)
    .eq('credentials_sent', false);

  if (!owners?.length) return { staged: 0 };

  let staged = 0;
  for (const owner of owners) {
    const password = generatePassword();
    const { error } = await supabase
      .from('owner_table')
      .update({ pending_password: password })
      .eq('owner_id', owner.owner_id);
    if (!error) staged++;
  }

  console.log(`[credentials] Staged ${staged} new owner(s)`);
  return { staged };
}

// ── STEP 3: Send queued credentials (slow — email) ───────────────────────────
async function sendQueued() {
  const getSupabase = require('../supabase');
  const { sendCredentialsEmail, upsertSupabaseUser } = require('./authHelpers');
  const supabase = getSupabase();

  // Find owners that are staged but not yet sent
  const { data: owners } = await supabase
    .from('owner_table')
    .select('owner_id, owner_name, email, pending_password')
    .not('pending_password', 'is', null)
    .eq('credentials_sent', false)
    .is('deleted_at', null);

  if (!owners?.length) return { sent: 0, errors: [] };

  // Send all in parallel for speed
  const settled = await Promise.allSettled(
    owners.map(async owner => {
      const email    = owner.email.toLowerCase().trim();
      const password = owner.pending_password;
      const metadata = {
        full_name: owner.owner_name,
        role: 'pet_owner',
        owner_id: owner.owner_id,
      };

      // Create/update Supabase auth account
      await upsertSupabaseUser(supabase, email, password, metadata);

      // Send email with credentials and QR
      await sendCredentialsEmail(email, owner.owner_name, password);

      // Mark as sent and clear the plain text password
      await supabase
        .from('owner_table')
        .update({ credentials_sent: true, pending_password: null })
        .eq('owner_id', owner.owner_id);

      console.log(`[credentials] Sent to ${email}`);
    })
  );

  const sent   = settled.filter(r => r.status === 'fulfilled').length;
  const errors = settled
    .filter(r => r.status === 'rejected')
    .map(r => r.reason?.message);

  return { sent, errors };
}

// ── STEP 4: Run both steps together ─────────────────────────────────────────
async function runFullProvision() {
  const stage  = await stageCredentials();
  const queued = await sendQueued();
  return { staged: stage.staged, sent: queued.sent, errors: queued.errors };
}

// ── API ROUTES ────────────────────────────────────────────────────────────────

// POST /api/credentials/stage — stage only (fast)
router.post('/stage', requireAuth, async (req, res) => {
  try {
    const result = await stageCredentials();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/credentials/send — send queued only (slow, run in background)
router.post('/send', requireAuth, async (req, res) => {
  // Return immediately, send in background
  res.json({ message: 'Sending queued credentials in background…' });
  sendQueued().catch(e => console.error('[credentials] send error:', e.message));
});

// POST /api/credentials/send-now — stage + send immediately (vet "Send Now" button)
router.post('/send-now', requireAuth, async (req, res) => {
  res.json({ message: 'Provisioning in background…' });
  runFullProvision().catch(e => console.error('[credentials] error:', e.message));
});

// GET /api/credentials/status — counts for the vet dashboard
router.get('/status', requireAuth, async (req, res) => {
  try {
    const getSupabase = require('../supabase');
    const supabase    = getSupabase();

    const { data: owners } = await supabase
      .from('owner_table')
      .select('owner_id, credentials_sent, pending_password, email')
      .not('email', 'is', null)
      .neq('email', '')
      .is('deleted_at', null);

    const total   = owners?.length ?? 0;
    const sent    = owners?.filter(o => o.credentials_sent).length ?? 0;
    const staged  = owners?.filter(o => o.pending_password && !o.credentials_sent).length ?? 0;
    const pending = owners?.filter(o => !o.pending_password && !o.credentials_sent).length ?? 0;

    res.json({ total, sent, staged, pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, stageCredentials, sendQueued, runFullProvision };
