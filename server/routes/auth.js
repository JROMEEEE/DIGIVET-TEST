const router = require('express').Router();
const requireAuth = require('../middleware/auth');

// GET /api/auth/me — returns the authenticated user's profile info
router.get('/me', requireAuth, (req, res) => {
  const { id, email, user_metadata } = req.user;
  res.json({
    id,
    email,
    role: user_metadata?.role ?? null,
    full_name: user_metadata?.full_name ?? null,
  });
});

module.exports = router;
