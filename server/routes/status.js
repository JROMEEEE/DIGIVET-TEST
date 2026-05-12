const router = require('express').Router();
const supabase = require('../supabase');

router.get('/', async (req, res) => {
  const checks = {
    server: { ok: true, message: 'Express is running' },
    environment: { ok: false, message: '' },
    supabase_url: { ok: false, message: '' },
    supabase_key: { ok: false, message: '' },
    supabase_connection: { ok: false, message: '' },
  };

  // Environment
  const env = process.env.NODE_ENV || 'undefined';
  checks.environment = { ok: true, message: env };

  // Env vars present
  checks.supabase_url = process.env.SUPABASE_URL
    ? { ok: true, message: process.env.SUPABASE_URL.replace(/^(https:\/\/[^.]{4})[^.]+/, '$1***') }
    : { ok: false, message: 'SUPABASE_URL not set' };

  checks.supabase_key = process.env.SUPABASE_SERVICE_KEY
    ? { ok: true, message: 'present' }
    : { ok: false, message: 'SUPABASE_SERVICE_KEY not set' };

  // Live Supabase ping
  try {
    const start = Date.now();
    const { error } = await supabase.from('_test_ping').select('*').limit(1);
    const ms = Date.now() - start;
    // PGRST116 = table not found, but connection itself succeeded
    if (!error || error.code === 'PGRST116' || error.code === '42P01') {
      checks.supabase_connection = { ok: true, message: `reachable (${ms}ms)` };
    } else {
      checks.supabase_connection = { ok: false, message: error.message };
    }
  } catch (err) {
    checks.supabase_connection = { ok: false, message: err.message };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  res.status(allOk ? 200 : 500).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

module.exports = router;
