const express = require('express');
const { optionalAuth, authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/sync', optionalAuth, async (req, res) => {
  res.json([]);
});

router.post('/', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.post('/changes', authMiddleware, async (req, res) => {
  res.json([]);
});

module.exports = router;
