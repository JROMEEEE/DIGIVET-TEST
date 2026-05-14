const router = require('express').Router();
const getSupabase = require('../supabase');

router.get('/', async (req, res) => {
  const checks = {
    server:             { ok: true,  message: 'Express is running' },
    environment:        { ok: false, message: '' },
    supabase_url:       { ok: false, message: '' },
    supabase_key:       { ok: false, message: '' },
    supabase_connection:{ ok: false, message: '' },
    local_db:           { ok: null,  message: 'not configured' },
  };

  checks.environment = { ok: true, message: process.env.NODE_ENV || 'undefined' };

  checks.supabase_url = process.env.SUPABASE_URL
    ? { ok: true, message: process.env.SUPABASE_URL.replace(/^(https:\/\/[^.]{4})[^.]+/, '$1***') }
    : { ok: false, message: 'SUPABASE_URL not set' };

  const hasKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  checks.supabase_key = hasKey
    ? { ok: true, message: 'present' }
    : { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY not set' };

  // Live Supabase ping — query a real table so there's no schema-cache error
  try {
    const start = Date.now();
    const { error } = await getSupabase().from('vet_table').select('vet_id').limit(1);
    const ms = Date.now() - start;
    checks.supabase_connection = error
      ? { ok: false, message: error.message }
      : { ok: true,  message: `${ms}ms` };
  } catch (err) {
    checks.supabase_connection = { ok: false, message: err.message };
  }

  // Local PostgreSQL ping (optional)
  if (process.env.LOCAL_DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool  = new Pool({ connectionString: process.env.LOCAL_DATABASE_URL, connectionTimeoutMillis: 3000 });
      const start = Date.now();
      await pool.query('SELECT 1');
      await pool.end();
      checks.local_db = { ok: true, message: `${Date.now() - start}ms` };
    } catch (err) {
      checks.local_db = { ok: false, message: err.message };
    }
  }

  // Which DB is being used as the primary data source
  // Local DB takes priority in auth.js; data queries always go to Supabase
  const data_source = checks.local_db.ok === true ? 'local' : 'supabase';

  const allOk = Object.values(checks).every(c => c.ok === true || c.ok === null);
  res.status(allOk ? 200 : 500).json({
    status: allOk ? 'ok' : 'degraded',
    data_source,
    timestamp: new Date().toISOString(),
    checks,
  });
});

module.exports = router;
