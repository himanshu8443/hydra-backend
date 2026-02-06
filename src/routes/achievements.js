const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, ID, Query } = require('../config/appwrite');

const router = express.Router();

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { id, achievements } = req.body;

    // Find or create achievement record for this game
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, [
      Query.equal('userId', req.userId),
      Query.equal('gameId', id)
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.ACHIEVEMENTS,
        existing.documents[0].$id,
        { achievements: JSON.stringify(achievements) }
      );
    } else {
      await databases.createDocument(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, ID.unique(), {
        userId: req.userId,
        gameId: id,
        achievements: JSON.stringify(achievements)
      });
    }

    // Get game info to return proper response
    const games = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId)
    ]);

    const game = games.documents.find(g => g.$id === id || g.objectId === id);

    res.json({
      objectId: game?.objectId || id,
      shop: game?.shop || 'steam',
      achievements
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:remoteId', authMiddleware, async (req, res) => {
  try {
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, [
      Query.equal('userId', req.userId),
      Query.equal('gameId', req.params.remoteId)
    ]);

    for (const doc of existing.documents) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, doc.$id);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
