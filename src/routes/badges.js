const express = require('express');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  res.json([]);
});

module.exports = router;
