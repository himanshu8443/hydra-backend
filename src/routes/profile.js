const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, ID, Query } = require('../config/appwrite');
const OfficialApi = require('../services/official-api');

const router = express.Router();

const HYDRA_API = process.env.HYDRA_OFFICIAL_API || 'https://hydra-api-us-east-1.losbroxas.org';

// Helper to fetch game assets from official API
const fetchGameAssets = async (shop, objectId) => {
  try {
    const token = await OfficialApi.getAccessToken();
    const headers = { 'User-Agent': 'HydraLauncher' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/assets`, {
      headers,
      timeout: 5000
    });
    return response.data;
  } catch {
    return null;
  }
};

router.get('/me', authMiddleware, async (req, res) => {
  try {
    console.log('[Profile/Me] Fetching profile for userId:', req.userId);
    
    let user;
    
    const users = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
      Query.equal('userId', req.userId)
    ]);
    
    if (users.documents.length > 0) {
      user = users.documents[0];
    } else {
      user = await databases.createDocument(DATABASE_ID, COLLECTIONS.USERS, ID.unique(), {
        userId: req.userId,
        username: 'user_' + req.userId.substring(0, 8),
        displayName: 'New User',
        email: null,
        profileImageUrl: null,
        backgroundImageUrl: null,
        bio: ''
      });
    }

    const response = {
      id: user.userId,
      username: user.username,
      displayName: user.displayName || user.username,
      email: user.email,
      profileImageUrl: user.profileImageUrl,
      backgroundImageUrl: user.backgroundImageUrl,
      profileVisibility: 'PUBLIC',
      bio: user.bio || '',
      featurebaseJwt: '',
      workwondersJwt: '',
      subscription: {
        id: 'lifetime',
        status: 'active',
        expiresAt: '2099-12-31T23:59:59Z',
        plan: { id: 'premium', name: 'Lifetime Premium' }
      },
      karma: 0,
      quirks: { backupsPerGameLimit: 10 }
    };
    
    console.log('[Profile/Me] Returning user id:', response.id);
    res.json(response);
  } catch (error) {
    console.error('[Profile/Me] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/', authMiddleware, async (req, res) => {
  try {
    const { displayName, profileVisibility, bio } = req.body;
    
    const users = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
      Query.equal('userId', req.userId)
    ]);

    if (users.documents.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.USERS,
      users.documents[0].$id,
      { displayName, bio }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload-image', authMiddleware, async (req, res) => {
  res.json({ presignedUrl: null });
});

router.get('/games', authMiddleware, async (req, res) => {
  try {
    const games = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.limit(500)
    ]);
    
    // Fetch assets for each game in parallel
    const gamesWithAssets = await Promise.all(
      games.documents.map(async (g) => {
        const assets = await fetchGameAssets(g.shop, g.objectId);
        return {
          id: g.$id,
          objectId: g.objectId,
          shop: g.shop,
          title: assets?.title || g.title,
          iconUrl: assets?.iconUrl || g.iconUrl,
          libraryImageUrl: assets?.libraryImageUrl || null,
          libraryHeroImageUrl: assets?.libraryHeroImageUrl || null,
          logoImageUrl: assets?.logoImageUrl || null,
          playTimeInMilliseconds: (g.playTimeInSeconds || 0) * 1000,
          lastTimePlayed: g.lastTimePlayed,
          isFavorite: g.isFavorite || false,
          isPinned: g.isPinned || false
        };
      })
    );
    
    res.json(gamesWithAssets);
  } catch (error) {
    console.error('[Profile/Games] Error:', error.message);
    res.json([]);
  }
});

router.post('/games', authMiddleware, async (req, res) => {
  try {
    const { objectId, shop, title, iconUrl, playTimeInMilliseconds, lastTimePlayed, isFavorite, isPinned } = req.body;

    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      return res.json({
        id: existing.documents[0].$id,
        ...existing.documents[0]
      });
    }

    const game = await databases.createDocument(DATABASE_ID, COLLECTIONS.GAMES, ID.unique(), {
      userId: req.userId,
      objectId,
      shop,
      title,
      iconUrl,
      playTimeInSeconds: Math.floor((playTimeInMilliseconds || 0) / 1000),
      lastTimePlayed: lastTimePlayed || null,
      isFavorite: isFavorite || false,
      isPinned: isPinned || false
    });

    res.json({ id: game.$id, ...game });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/games/batch', authMiddleware, async (req, res) => {
  try {
    const games = req.body;
    const results = [];

    for (const game of games) {
      const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
        Query.equal('userId', req.userId),
        Query.equal('objectId', game.objectId),
        Query.equal('shop', game.shop)
      ]);

      if (existing.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, existing.documents[0].$id, {
          playTimeInSeconds: Math.floor((game.playTimeInMilliseconds || 0) / 1000),
          lastTimePlayed: game.lastTimePlayed || null,
          isFavorite: game.isFavorite || false,
          isPinned: game.isPinned || false
        });
        results.push({ id: existing.documents[0].$id, objectId: game.objectId });
      } else {
        const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.GAMES, ID.unique(), {
          userId: req.userId,
          objectId: game.objectId,
          shop: game.shop,
          title: game.title || game.objectId,
          iconUrl: null,
          playTimeInSeconds: Math.floor((game.playTimeInMilliseconds || 0) / 1000),
          lastTimePlayed: game.lastTimePlayed || null,
          isFavorite: game.isFavorite || false,
          isPinned: game.isPinned || false
        });
        results.push({ id: doc.$id, objectId: game.objectId });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/games/:shop/:objectId', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const { playTimeDeltaInSeconds, lastTimePlayed } = req.body;

    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      const current = existing.documents[0];
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, current.$id, {
        playTimeInSeconds: (current.playTimeInSeconds || 0) + (playTimeDeltaInSeconds || 0),
        lastTimePlayed: lastTimePlayed || current.lastTimePlayed
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/games/:remoteId', authMiddleware, async (req, res) => {
  try {
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.GAMES, req.params.remoteId);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.put('/games/:shop/:objectId/favorite', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, existing.documents[0].$id, {
        isFavorite: true
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/games/:shop/:objectId/unfavorite', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, existing.documents[0].$id, {
        isFavorite: false
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/games/:shop/:objectId/pin', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, existing.documents[0].$id, {
        isPinned: true
      });
      res.json({ id: existing.documents[0].$id, isPinned: true });
    } else {
      res.json({ ok: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/games/:shop/:objectId/unpin', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, existing.documents[0].$id, {
        isPinned: false
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/games/:shop/:objectId/playtime', authMiddleware, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const { playTimeInMilliseconds } = req.body;

    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GAMES, [
      Query.equal('userId', req.userId),
      Query.equal('objectId', objectId),
      Query.equal('shop', shop)
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.GAMES, existing.documents[0].$id, {
        playTimeInSeconds: Math.floor((playTimeInMilliseconds || 0) / 1000)
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/download-sources', authMiddleware, async (req, res) => {
  res.json([]);
});

router.post('/download-sources', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.delete('/download-sources', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.get('/notifications', authMiddleware, async (req, res) => {
  res.json({
    notifications: [],
    pagination: { total: 0, take: 20, skip: 0, hasMore: false }
  });
});

router.get('/notifications/count', authMiddleware, async (req, res) => {
  res.json({ count: 0 });
});

router.patch('/notifications/:id', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.delete('/notifications/:id', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.delete('/notifications/all', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.delete('/friend-requests/:userId', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.get('/blocks', authMiddleware, async (req, res) => {
  res.json({ totalBlocks: 0, blocks: [] });
});

module.exports = router;

