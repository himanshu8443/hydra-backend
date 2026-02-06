const express = require('express');
const axios = require('axios');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, ID, Query } = require('../config/appwrite');
const OfficialApi = require('../services/official-api');

const router = express.Router();

const HYDRA_API = process.env.HYDRA_OFFICIAL_API || 'https://hydra-api-us-east-1.losbroxas.org';

// Helper for proxied requests
const getHeaders = async () => {
  const token = await OfficialApi.getAccessToken();
  const headers = { 'User-Agent': 'HydraLauncher' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Proxy achievements from official Hydra API
router.get('/:shop/:objectId/achievements', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const { language } = req.query;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/achievements`, {
      params: { language: language || 'en' },
      headers: await getHeaders()
    });

    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 304) {
      return res.status(304).end();
    }
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch achievements' });
  }
});

// Proxy game stats from official Hydra API
router.get('/:shop/:objectId/stats', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/stats`, {
      headers: await getHeaders()
    });

    res.json(response.data);
  } catch {
    res.json({ downloadCount: 0, playerCount: 0 });
  }
});

// Proxy game assets from official Hydra API
router.get('/:shop/:objectId/assets', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/assets`, {
      headers: await getHeaders()
    });

    res.json(response.data);
  } catch {
    res.json(null);
  }
});

// Proxy download sources from official Hydra API
router.get('/:shop/:objectId/download-sources', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/download-sources`, {
      headers: await getHeaders()
    });

    res.json(response.data);
  } catch {
    res.json([]);
  }
});

// Track download (just acknowledge)
router.post('/:shop/:objectId/download', optionalAuth, async (req, res) => {
  res.json({ ok: true });
});

// Reviews (proxy or stub)
router.get('/:shop/:objectId/reviews', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/reviews`, {
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch {
    res.json({ reviews: [], total: 0 });
  }
});

router.get('/:shop/:objectId/reviews/check', optionalAuth, async (req, res) => {
  res.json({ recommended: null });
});

router.post('/:shop/:objectId/reviews', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

// Proxy how-long-to-beat from official Hydra API
router.get('/:shop/:objectId/how-long-to-beat', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/how-long-to-beat`, {
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch {
    res.json(null);
  }
});

module.exports = router;
