#!/usr/bin/env node
/**
 * migrate-vets-to-accounts.js
 *
 * Converts existing vet_table records into user_profile login accounts in Supabase.
 * vet_table has no email column, so placeholder emails are assigned by default.
 * Supply a JSON email map to attach real emails at migration time.
 *
 * Usage:
 *   node server/scripts/migrate-vets-to-accounts.js [options]
 *
 * Options:
 *   --dry-run                  Preview without writing to the database
 *   --force                    Re-process vets that already have a user_profile (resets password)
 *   --default-password <pw>    Use one shared password for all vets instead of per-vet random ones
 *   --emails <path/to/map.json>
 *       Optional JSON file mapping vet_id to email:
 *       { "1": "dr.santos@example.com", "2": "dr.reyes@example.com" }
 *       Vets not in the map get a placeholder: vet_<id>@placeholder.digivet
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const bcrypt           = require('bcryptjs');
const fs               = require('fs');
const path             = require('path');

const SALT_ROUNDS = 10;

// ── CLI flags ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const FORCE    = args.includes('--force');

const dpIdx = args.indexOf('--default-password');
const DEFAULT_PASSWORD = dpIdx !== -1 ? args[dpIdx + 1] : null;

const emailsIdx = args.indexOf('--emails');
const emailsFile = emailsIdx !== -1 ? args[emailsIdx + 1] : null;

// ── Load optional email map ────────────────────────────────────────────────────
// Keys are vet_id (as string), values are email strings.
let emailMap = {};
if (emailsFile) {
  try {
    const raw = fs.readFileSync(path.resolve(emailsFile), 'utf8');
    emailMap = JSON.parse(raw);
    console.log(`Loaded email map from ${emailsFile} — ${Object.keys(emailMap).length} entries.\n`);
  } catch (err) {
    console.error(`Failed to read email map file "${emailsFile}": ${err.message}`);
    process.exit(1);
  }
}

// ── Supabase client (service role) ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Password generator (same charset as authHelpers.js) ───────────────────────
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Create or update a Supabase auth account ──────────────────────────────────
async function upsertAuthAccount(email, password, vetName) {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: vetName, role: 'veterinarian' },
  });

  if (!error) return { ok: true };

  // Already exists — find their ID via generateLink (faster than listUsers)
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkErr || !linkData?.user?.id) {
    return { ok: false, error: `Auth upsert failed: ${linkErr?.message ?? 'unknown'}` };
  }

  await supabase.auth.admin.updateUserById(linkData.user.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: vetName, role: 'veterinarian' },
  });

  return { ok: true };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const LINE = '='.repeat(72);
  console.log(`\n${LINE}`);
  console.log('  DIGIVET — Vet Account Migration');
  console.log(`  Mode    : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (DEFAULT_PASSWORD) console.log(`  Password: shared default`);
  console.log(`${LINE}\n`);

  // 1. Fetch all vets
  const { data: vets, error: vetErr } = await supabase
    .from('vet_table')
    .select('vet_id, vet_name')
    .order('vet_id');

  if (vetErr) {
    console.error('Failed to fetch vet_table:', vetErr.message);
    process.exit(1);
  }
  if (!vets?.length) {
    console.log('No records found in vet_table. Nothing to do.');
    return;
  }
  console.log(`Found ${vets.length} vet record(s).\n`);

  // 2. Load existing user_profile entries to detect duplicates
  const { data: existingProfiles, error: profileErr } = await supabase
    .from('user_profile')
    .select('id, display_name, local_email, role');

  if (profileErr) {
    console.error('Failed to fetch user_profile:', profileErr.message);
    process.exit(1);
  }

  const byEmail = new Map(
    (existingProfiles ?? [])
      .filter(p => p.local_email)
      .map(p => [p.local_email.toLowerCase(), p])
  );
  const byName = new Map(
    (existingProfiles ?? [])
      .filter(p => p.display_name)
      .map(p => [p.display_name.toLowerCase(), p])
  );

  // 3. Process each vet
  const results = [];

  for (const vet of vets) {
    const vetId   = vet.vet_id;
    const vetName = (vet.vet_name ?? `Vet #${vetId}`).trim();

    // Resolve email: from map file, or placeholder
    const mappedEmail   = emailMap[String(vetId)] ?? null;
    const email         = mappedEmail ? mappedEmail.toLowerCase().trim() : null;
    const loginEmail    = email ?? `vet_${vetId}@placeholder.digivet`;
    const hasRealEmail  = Boolean(email);

    const existing = (email ? byEmail.get(email) : null) ?? byName.get(vetName.toLowerCase());
    const password = DEFAULT_PASSWORD || generatePassword();

    // Skip if already migrated and --force not set
    if (existing && !FORCE) {
      results.push({
        vet_id:   vetId,
        vet_name: vetName,
        email:    email ?? '—',
        login:    existing.local_email,
        status:   'SKIPPED',
        note:     'Already has user_profile — use --force to reset',
        password: '(unchanged)',
      });
      continue;
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const profileRow = {
      display_name:        vetName,
      role:                'ADMIN',
      local_email:         loginEmail,
      local_password_hash: hash,
    };

    let status = '';
    let note   = hasRealEmail ? '' : 'Placeholder email — update local_email in user_profile when real email is known';

    if (!DRY_RUN) {
      let writeErr = null;

      if (existing) {
        ({ error: writeErr } = await supabase
          .from('user_profile')
          .update(profileRow)
          .eq('id', existing.id));
      } else {
        ({ error: writeErr } = await supabase
          .from('user_profile')
          .insert(profileRow));
      }

      if (writeErr) {
        results.push({
          vet_id: vetId, vet_name: vetName, email: email ?? '—', login: loginEmail,
          status: 'ERROR', note: writeErr.message, password: '—',
        });
        continue;
      }

      if (hasRealEmail) {
        // Also write email back to vet_table so it's visible in the dashboard
        await supabase.from('vet_table').update({ email }).eq('vet_id', vetId);

        const authResult = await upsertAuthAccount(email, password, vetName);
        if (!authResult.ok) {
          note   += (note ? '; ' : '') + authResult.error;
          status  = existing ? 'UPDATED_PROFILE_ONLY' : 'CREATED_PROFILE_ONLY';
        } else {
          status = existing ? 'UPDATED' : 'CREATED';
        }
      } else {
        status = existing ? 'UPDATED_NO_EMAIL' : 'CREATED_NO_EMAIL';
      }
    } else {
      status = hasRealEmail
        ? (existing ? 'WOULD_UPDATE' : 'WOULD_CREATE')
        : (existing ? 'WOULD_UPDATE_NO_EMAIL' : 'WOULD_CREATE_NO_EMAIL');
    }

    results.push({ vet_id: vetId, vet_name: vetName, email: email ?? '—', login: loginEmail, status, note, password });
  }

  // 4. Print results table
  const sep = '-'.repeat(80);
  console.log('Results:\n');
  console.log(`${'ID'.padEnd(6)} | ${'VET NAME'.padEnd(26)} | ${'LOGIN EMAIL'.padEnd(36)} | STATUS`);
  console.log(sep);
  for (const r of results) {
    console.log(
      String(r.vet_id).padEnd(6) + ' | ' +
      r.vet_name.substring(0, 26).padEnd(26) + ' | ' +
      r.login.substring(0, 36).padEnd(36) + ' | ' +
      r.status
    );
    if (r.note)     console.log(`       NOTE: ${r.note}`);
    if (r.password && r.password !== '(unchanged)' && r.password !== '—') {
      console.log(`       PASS: ${r.password}`);
    }
  }
  console.log(sep);

  // 5. Summary counts
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log('\nSummary:');
  for (const [s, n] of Object.entries(counts)) console.log(`  ${s}: ${n}`);

  // 6. Save report
  const reportPath = path.join(__dirname, 'vet-migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    migratedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    counts,
    results,
  }, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
  console.log('IMPORTANT: This report contains plaintext passwords. Delete it after distributing credentials.\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] No changes were made.\n');
  } else {
    console.log(
      'Migration complete. Next steps:\n' +
      '  1. Distribute passwords to each vet (see report above or vet-migration-report.json).\n' +
      '  2. For vets with placeholder logins, update user_profile.local_email when their email is known.\n' +
      '  3. Trigger POST /api/sync/to-local so user_profile rows reach the local database.\n' +
      '  4. Delete vet-migration-report.json after credentials are distributed.\n'
    );
  }
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
