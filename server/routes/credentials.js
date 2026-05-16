const router = require('express').Router();
const requireAuth = require('../middleware/auth');

function getClientUrl() {
  return (process.env.CLIENT_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, '');
}

// ── STEP 2: Stage credentials (fast — no email) ──────────────────────────────
async function stageCredentials() {
  const getSupabase = require('../supabase');
  const { generatePassword } = require('./authHelpers');
  const supabase = getSupabase();

  // Treat both false AND null as "not sent"
  const { data: owners, error: fetchErr } = await supabase
    .from('owner_table')
    .select('owner_id, owner_name, email')
    .not('email', 'is', null)
    .neq('email', '')
    .is('deleted_at', null)
    .is('pending_password', null)
    .or('credentials_sent.eq.false,credentials_sent.is.null');

  if (fetchErr) {
    console.error('[credentials] Fetch error:', fetchErr.message);
    return { staged: 0 };
  }

  console.log(`[credentials] Found ${owners?.length ?? 0} owner(s) to stage`);
  if (!owners?.length) return { staged: 0 };

  let staged = 0;
  for (const owner of owners) {
    const email = owner.email?.toLowerCase().trim();
    if (!email) continue;

    const password = generatePassword();
    const { error } = await supabase
      .from('owner_table')
      .update({ pending_password: password })
      .eq('owner_id', owner.owner_id);

    if (error) {
      console.error(`[credentials] Stage failed for ${email}:`, error.message);
    } else {
      console.log(`[credentials] Staged: ${email}`);
      staged++;
    }
  }

  console.log(`[credentials] Total staged: ${staged}`);
  return { staged };
}

// ── STEP 3: Send queued credentials (slow — email) ───────────────────────────
async function sendQueued() {
  const getSupabase = require('../supabase');
  const { deliverOwnerCredentials, syncOwnerLocalCredentials } = require('./authHelpers');
  const supabase = getSupabase();

  const { data: owners } = await supabase
    .from('owner_table')
    .select('owner_id, owner_name, email, pending_password')
    .not('pending_password', 'is', null)
    .or('credentials_sent.eq.false,credentials_sent.is.null')
    .is('deleted_at', null);

  if (!owners?.length) return { sent: 0, errors: [] };
  const settled = await Promise.allSettled(
    owners.map(async owner => {
      const email      = owner.email.toLowerCase().trim();
      const password   = owner.pending_password;
      const metadata   = { full_name: owner.owner_name, role: 'pet_owner', owner_id: owner.owner_id };
      const redirectTo = `${getClientUrl()}/welcome`;

      await deliverOwnerCredentials(supabase, email, owner.owner_name, password, metadata, redirectTo);
      await syncOwnerLocalCredentials(supabase, owner.owner_id, email, password, owner.owner_name);

      await supabase
        .from('owner_table')
        .update({ credentials_sent: true })
        .eq('owner_id', owner.owner_id);

      console.log(`[credentials] Sent to ${email}`);
    })
  );

  const sent   = settled.filter(r => r.status === 'fulfilled').length;
  const errors = settled.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  return { sent, errors };
}

// ── STEP 4: Run both steps together ─────────────────────────────────────────
async function runFullProvision() {
  const stage  = await stageCredentials();
  const queued = await sendQueued();
  return { staged: stage.staged, sent: queued.sent, errors: queued.errors };
}

// ── API ROUTES ────────────────────────────────────────────────────────────────

router.post('/stage', requireAuth, async (req, res) => {
  try { res.json(await stageCredentials()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/send', requireAuth, async (req, res) => {
  res.json({ message: 'Sending queued credentials in background…' });
  sendQueued().catch(e => console.error('[credentials] send error:', e.message));
});

router.post('/send-now', requireAuth, async (req, res) => {
  res.json({ message: 'Provisioning in background…' });
  runFullProvision().catch(e => console.error('[credentials] error:', e.message));
});

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

    const sent    = owners?.filter(o => o.credentials_sent).length ?? 0;
    const staged  = owners?.filter(o => o.pending_password && !o.credentials_sent).length ?? 0;
    const pending = owners?.filter(o => !o.pending_password && !o.credentials_sent).length ?? 0;

    res.json({ total: owners?.length ?? 0, sent, staged, pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, stageCredentials, sendQueued, runFullProvision };
