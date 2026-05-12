const router = require('express').Router();
const getSupabase = require('../supabase');

router.get('/', async (req, res) => {
  try {
    const { error } = await getSupabase().from('_health').select('*').limit(1);
    res.json({
      status: 'ok',
      server: 'DIGIVET Online API',
      supabase: error ? 'unreachable' : 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.json({ status: 'ok', server: 'DIGIVET Online API', supabase: 'unchecked' });
  }
});

module.exports = router;
