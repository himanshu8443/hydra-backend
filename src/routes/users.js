const express = require('express');
const axios = require('axios');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, Query } = require('../config/appwrite');
// const OfficialApi = require('../services/official-api');

const router = express.Router();

const HYDRA_API = process.env.HYDRA_OFFICIAL_API || 'https://hydra-api-us-east-1.losbroxas.org';

// Helper to fetch game assets from official API
const fetchGameAssets = async (shop, objectId) => {
  try {
    // const token = await OfficialApi.getAccessToken();
    const headers = { 'User-Agent': 'HydraLauncher' };
    // if (token) headers['Authorization'] = `Bearer ${token}`;
    
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
          id: g.$id,
          remoteId: g.$id,
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
    const userId = req.params.userId;

    // Fetch games for playtime calculation
    const games = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', userId),
      Query.limit(500)
    ]);

    const totalPlayTime = games.documents.reduce((acc, g) => acc + (g.playTimeInSeconds || 0), 0);

    // Fetch all achievements for this user
    const achievementDocs = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, [
      Query.equal('userId', userId),
      Query.limit(500)
    ]);

    // Count total unlocked achievements across all games
    let totalUnlockedAchievements = 0;
    let totalAchievementPoints = 0;

    for (const doc of achievementDocs.documents) {
      try {
        // Achievements are stored as JSON string array
        const achievements = typeof doc.achievements === 'string' 
          ? JSON.parse(doc.achievements) 
          : (doc.achievements || []);
        
        totalUnlockedAchievements += achievements.length;
        // Each achievement is worth 10 points by default
        totalAchievementPoints += achievements.length * 10;
      } catch (e) {
        // Skip malformed achievement data
        console.error('[Users/Stats] Error parsing achievements:', e.message);
      }
    }

    console.log(`[Users/Stats] User ${userId}: ${totalUnlockedAchievements} achievements, ${totalPlayTime}s playtime`);

    res.json({
      libraryCount: games.total,
      friendsCount: 0,
      totalPlayTimeInSeconds: {
        value: totalPlayTime,
        topPercentile: 50
      },
      achievementsPointsEarnedSum: {
        value: totalAchievementPoints,
        topPercentile: 50
      },
      unlockedAchievementSum: totalUnlockedAchievements
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
    
    console.log(`[Users/Library] Fetching library for user ${userId}, sortBy: ${sortBy}`);
    
    // First, fetch all games (we'll sort in JS for achievement sorting)
    const library = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', userId),
      Query.limit(500) // Get all for proper sorting
    ]);

    // Fetch all achievements for this user at once
    const achievementDocs = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ACHIEVEMENTS, [
      Query.equal('userId', userId),
      Query.limit(500)
    ]);

    // Create a map of gameId -> achievement count
    const achievementMap = {};
    for (const doc of achievementDocs.documents) {
      try {
        const achievements = typeof doc.achievements === 'string' 
          ? JSON.parse(doc.achievements) 
          : (doc.achievements || []);
        achievementMap[doc.gameId] = {
          unlocked: achievements.length,
          points: achievements.length * 10
        };
      } catch (e) {
        achievementMap[doc.gameId] = { unlocked: 0, points: 0 };
      }
    }

    console.log(`[Users/Library] Found ${library.documents.length} games, ${achievementDocs.documents.length} achievement records`);

    // Build games with achievement data
    let games = await Promise.all(
      library.documents.map(async (doc) => {
        const assets = await fetchGameAssets(doc.shop, doc.objectId);
        const achData = achievementMap[doc.objectId] || { unlocked: 0, points: 0 };
        
        return {
          id: doc.$id,
          remoteId: doc.$id,
          objectId: doc.objectId,
          shop: doc.shop,
          title: assets?.title || doc.title,
          iconUrl: assets?.iconUrl || doc.iconUrl,
          libraryImageUrl: assets?.libraryImageUrl || null,
          libraryHeroImageUrl: assets?.libraryHeroImageUrl || null,
          logoImageUrl: assets?.logoImageUrl || null,
          logoPosition: assets?.logoPosition || null,
          coverImageUrl: assets?.coverImageUrl || assets?.libraryImageUrl || null,
          downloadSources: assets?.downloadSources || [],
          playTimeInSeconds: doc.playTimeInSeconds || 0,
          lastTimePlayed: doc.lastTimePlayed,
          unlockedAchievementCount: achData.unlocked,
          achievementCount: achData.unlocked, // Total unlocked (we don't track total possible)
          achievementsPointsEarnedSum: achData.points,
          hasManuallyUpdatedPlaytime: doc.hasManuallyUpdatedPlaytime || false,
          isFavorite: doc.isFavorite || false,
          isPinned: doc.isPinned || false,
          pinnedDate: doc.pinnedDate || null
        };
      })
    );

    // Sort based on sortBy parameter
    if (sortBy === 'playtime') {
      games.sort((a, b) => (b.playTimeInSeconds || 0) - (a.playTimeInSeconds || 0));
    } else if (sortBy === 'playedRecently') {
      games.sort((a, b) => {
        const dateA = a.lastTimePlayed ? new Date(a.lastTimePlayed).getTime() : 0;
        const dateB = b.lastTimePlayed ? new Date(b.lastTimePlayed).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === 'achievementCount') {
      games.sort((a, b) => (b.unlockedAchievementCount || 0) - (a.unlockedAchievementCount || 0));
    } else {
      // Default: most recently played
      games.sort((a, b) => {
        const dateA = a.lastTimePlayed ? new Date(a.lastTimePlayed).getTime() : 0;
        const dateB = b.lastTimePlayed ? new Date(b.lastTimePlayed).getTime() : 0;
        return dateB - dateA;
      });
    }

    // Apply pagination after sorting
    const startIndex = parseInt(skip);
    const endIndex = startIndex + parseInt(take);
    const paginatedGames = games.slice(startIndex, endIndex);

    // Separate pinned games
    const pinnedGames = paginatedGames.filter(g => g.isPinned);
    const regularGames = paginatedGames.filter(g => !g.isPinned);

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
