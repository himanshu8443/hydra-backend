const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, Query } = require('../config/appwrite');

const router = express.Router();

router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const users = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
      Query.equal('userId', req.params.userId)
    ]);

    if (users.documents.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users.documents[0];

    res.json({
      id: user.userId,
      username: user.username,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      backgroundImageUrl: user.backgroundImageUrl,
      profileVisibility: 'PUBLIC',
      bio: user.bio || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId/friends', optionalAuth, async (req, res) => {
  res.json({ totalFriends: 0, friends: [] });
});

router.post('/:userId/block', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.post('/:userId/unblock', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.get('/:userId/games/achievements/compare', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId, language } = req.query;
    const targetUserId = req.params.userId;

    // Get current user's achievements
    const ownerAchievements = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, [
      Query.equal('userId', req.userId),
      Query.equal('gameId', objectId)
    ]);

    // Get target user's achievements
    const targetAchievements = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, [
      Query.equal('userId', targetUserId),
      Query.equal('gameId', objectId)
    ]);

    const ownerUnlocked = ownerAchievements.documents[0]
      ? JSON.parse(ownerAchievements.documents[0].achievements)
      : [];
    
    const targetUnlocked = targetAchievements.documents[0]
      ? JSON.parse(targetAchievements.documents[0].achievements)
      : [];

    // Get target user info
    const targetUsers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
      Query.equal('userId', targetUserId)
    ]);

    const targetUser = targetUsers.documents[0] || { displayName: 'Unknown', profileImageUrl: null };

    res.json({
      achievementsPointsTotal: 1000,
      owner: {
        totalAchievementCount: 50,
        unlockedAchievementCount: ownerUnlocked.length,
        achievementsPointsEarnedSum: ownerUnlocked.length * 10
      },
      target: {
        displayName: targetUser.displayName,
        profileImageUrl: targetUser.profileImageUrl,
        totalAchievementCount: 50,
        unlockedAchievementCount: targetUnlocked.length,
        achievementsPointsEarnedSum: targetUnlocked.length * 10
      },
      achievements: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId/reviews', optionalAuth, async (req, res) => {
  res.json({ reviews: [], total: 0 });
});

router.get('/:userId/stats', optionalAuth, async (req, res) => {
  res.json({
    librarySize: 0,
    totalPlayTimeInSeconds: 0,
    totalAchievements: 0
  });
});

router.get('/:userId/library', optionalAuth, async (req, res) => {
  res.json([]);
});

module.exports = router;
