const express = require('express');
const axios = require('axios');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, Query } = require('../config/appwrite');
const OfficialApi = require('../services/official-api');

const router = express.Router();

const HYDRA_API = process.env.HYDRA_OFFICIAL_API || 'https://hydra-api-us-east-1.losbroxas.org';

// Helper to fetch game assets from official API
const fetchGameAssets = async (shop, objectId) => {
  try {
    const token = await OfficialApi.getAccessToken();
    const headers = { 'User-Agent': 'HydraLauncher' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    console.log(`[Users/fetchAssets] Fetching ${shop}/${objectId}...`);
    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/assets`, {
      headers,
      timeout: 5000
    });
    console.log(`[Users/fetchAssets] Got assets for ${shop}/${objectId}:`, response.data?.libraryImageUrl?.substring(0, 50) || 'null');
    return response.data;
  } catch (error) {
    console.error(`[Users/fetchAssets] Error for ${shop}/${objectId}:`, error.message);
    return null;
  }
};

router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const users = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
      Query.equal('userId', req.params.userId)
    ]);

    if (users.documents.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users.documents[0];

    // Get user's games for library display with assets
    const gamesDb = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.params.userId),
      Query.limit(10)
    ]);

    const libraryGames = await Promise.all(
      gamesDb.documents.map(async (g) => {
        const assets = await fetchGameAssets(g.shop, g.objectId);
        return {
          objectId: g.objectId,
          shop: g.shop,
          title: assets?.title || g.title,
          iconUrl: assets?.iconUrl || g.iconUrl,
          libraryImageUrl: assets?.libraryImageUrl || null,
          libraryHeroImageUrl: assets?.libraryHeroImageUrl || null,
          logoImageUrl: assets?.logoImageUrl || null,
          playTimeInSeconds: g.playTimeInSeconds || 0,
          lastTimePlayed: g.lastTimePlayed,
          unlockedAchievementCount: 0,
          achievementCount: 0,
          achievementsPointsEarnedSum: 0,
          hasManuallyUpdatedPlaytime: false,
          isFavorite: g.isFavorite || false,
          isPinned: g.isPinned || false
        };
      })
    );

    res.json({
      id: user.userId,
      displayName: user.displayName || user.username,
      profileImageUrl: user.profileImageUrl,
      email: user.email,
      backgroundImageUrl: user.backgroundImageUrl,
      profileVisibility: 'PUBLIC',
      libraryGames: libraryGames,
      recentGames: libraryGames.slice(0, 5),
      friends: [],
      totalFriends: 0,
      relation: null,
      currentGame: null,
      bio: user.bio || '',
      hasActiveSubscription: true,
      karma: 0,
      quirks: {
        backupsPerGameLimit: 10
      },
      badges: [],
      hasCompletedWrapped2025: false
    });
  } catch (error) {
    console.error('[Users] Error fetching user:', error.message);
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
  try {
    const games = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.params.userId)
    ]);

    const totalPlayTime = games.documents.reduce((acc, g) => acc + (g.playTimeInSeconds || 0), 0);

    res.json({
      libraryCount: games.total,
      friendsCount: 0,
      totalPlayTimeInSeconds: {
        value: totalPlayTime,
        topPercentile: 50
      },
      achievementsPointsEarnedSum: {
        value: 0,
        topPercentile: 50
      },
      unlockedAchievementSum: 0
    });
  } catch (error) {
    console.error('[Users/Stats] Error:', error.message);
    res.json({
      libraryCount: 0,
      friendsCount: 0,
      totalPlayTimeInSeconds: { value: 0, topPercentile: 50 },
      achievementsPointsEarnedSum: { value: 0, topPercentile: 50 },
      unlockedAchievementSum: 0
    });
  }
});

router.get('/:userId/library', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { take = '12', skip = '0', sortBy } = req.query;
    
    console.log(`[Users/Library] Fetching library for user ${userId}`);
    
    const library = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', userId),
      Query.limit(parseInt(take)),
      Query.offset(parseInt(skip))
    ]);

    console.log(`[Users/Library] Found ${library.documents.length} games`);

    // Fetch assets for each game in parallel
    const games = await Promise.all(
      library.documents.map(async (doc) => {
        console.log(`[Users/Library] Fetching assets for ${doc.shop}/${doc.objectId}`);
        const assets = await fetchGameAssets(doc.shop, doc.objectId);
        return {
          objectId: doc.objectId,
          shop: doc.shop,
          title: assets?.title || doc.title,
          iconUrl: assets?.iconUrl || doc.iconUrl,
          libraryImageUrl: assets?.libraryImageUrl || null,
          libraryHeroImageUrl: assets?.libraryHeroImageUrl || null,
          logoImageUrl: assets?.logoImageUrl || null,
          logoPosition: assets?.logoPosition || null,
          // Map libraryImageUrl to coverImageUrl as client expects it
          coverImageUrl: assets?.coverImageUrl || assets?.libraryImageUrl || null,
          downloadSources: assets?.downloadSources || [],
          playTimeInSeconds: doc.playTimeInSeconds || 0,
          lastTimePlayed: doc.lastTimePlayed,
          unlockedAchievementCount: 0,
          achievementCount: 0,
          achievementsPointsEarnedSum: 0,
          hasManuallyUpdatedPlaytime: false,
          isFavorite: doc.isFavorite || false,
          isPinned: doc.isPinned || false,
          pinnedDate: null
        };
      })
    );

    // Separate pinned games
    const pinnedGames = games.filter(g => g.isPinned);
    const regularGames = games.filter(g => !g.isPinned);

    res.json({
      totalCount: library.total,
      library: regularGames,
      pinnedGames: pinnedGames
    });
  } catch (error) {
    console.error('[Users/Library] Error:', error.message);
    res.json({
      totalCount: 0,
      library: [],
      pinnedGames: []
    });
  }
});

// Add game to library (Pin)
router.post('/:userId/library', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { objectId, shop, title, coverImage } = req.body;

    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if already exists
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      return res.json({ ok: true, id: existing.documents[0].$id });
    }

    // Create new library entry
    const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.GAMES, ID.unique(), {
      userId,
      objectId,
      shop,
      title,
      coverImage,
      playTimeInSeconds: 0,
      lastPlayedDate: null
    });

    res.json({ ok: true, id: doc.$id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove game from library (Unpin)
router.delete('/:userId/library/:shop/:objectId', authMiddleware, async (req, res) => {
  try {
    const { userId, shop, objectId } = req.params;

    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const output = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (output.documents.length > 0) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.GAMES, output.documents[0].$id);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
