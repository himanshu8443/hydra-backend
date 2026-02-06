const express = require('express');

const router = express.Router();

router.put('/:reviewId', (req, res) => res.json({ ok: true }));
router.delete('/:reviewId', (req, res) => res.json({ ok: true }));
router.put('/:reviewId/upvote', (req, res) => res.json({ ok: true }));
router.put('/:reviewId/downvote', (req, res) => res.json({ ok: true }));

module.exports = router;
