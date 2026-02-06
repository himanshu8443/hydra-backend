const express = require('express');
const axios = require('axios');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, ID, Query } = require('../config/appwrite');
// const OfficialApi = require('../services/official-api');

const router = express.Router();

const HYDRA_API = process.env.HYDRA_OFFICIAL_API || 'https://hydra-api-us-east-1.losbroxas.org';

// Helper for proxied requests
// const getHeaders = async () => { ... } removed
const getHeaders = () => ({ 'User-Agent': 'HydraLauncher' });

// Helper to rewrite relative image URLs to absolute CDN URLs
const formatResponse = (data) => {
  if (!data) return data;
  const CDN_URL = 'https://cdn.losbroxas.org';

  const rewrite = (url) => {
    if (typeof url === 'string' && url.startsWith('/')) {
      return `${CDN_URL}${url}`;
    }
    return url;
  };

  if (Array.isArray(data)) {
    return data.map(item => formatResponse(item));
  }

  if (typeof data === 'object') {
    const newData = { ...data };
    
    // Common image URL keys
    const imageKeys = [
      'cover', 'icon', 'backgroundImage', 'background', 
      'hero', 'logo', 'capsule', 'header', 
      'library_hero', 'library_logo', 'iconUrl',
      'coverImage', 'coverUrl', 'imageUrl', 'thumbnail'
    ];
    
    for (const key of imageKeys) {
      if (newData[key]) {
        newData[key] = rewrite(newData[key]);
      }
    }
    
    // Handle screenshots array
    if (Array.isArray(newData.screenshots)) {
      newData.screenshots = newData.screenshots.map(s => {
        if (typeof s === 'string') return rewrite(s);
        if (typeof s === 'object' && s.url) return { ...s, url: rewrite(s.url) };
        return s;
      });
    }
    
    // Recursively process nested objects
    for (const key of Object.keys(newData)) {
      if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) {
        newData[key] = formatResponse(newData[key]);
      }
    }
    
    return newData;
  }

  return data;
};

// Proxy game details (FIX: This was missing and caused missing images)
router.get('/:shop/:objectId', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const { language } = req.query;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}`, {
      params: { language: language || 'en' },
      headers: getHeaders()
    });

    console.log(`[GameDetails] Response for ${shop}/${objectId}:`, JSON.stringify(response.data).substring(0, 500));
    res.json(formatResponse(response.data));
  } catch (error) {
    if (error.response?.status === 304) {
      return res.status(304).end();
    }
    const status = error.response?.status || 500;
    // Don't log 404s for games not found on backend (common)
    if (status !== 404) {
      console.error(`[GameDetails] Error fetching ${shop}/${objectId}:`, error.message);
    }
    res.status(status).json({ error: 'Failed to fetch game details' });
  }
});

// Proxy achievements from official Hydra API
router.get('/:shop/:objectId/achievements', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;
    const { language } = req.query;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/achievements`, {
      params: { language: language || 'en' },
      headers: getHeaders()
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
      headers: getHeaders()
    });

    res.json(response.data);
  } catch {
    res.json({ downloadCount: 0, playerCount: 0 });
  }
});

// Proxy game assets from official Hydra API
router.get('/:shop/:objectId/assets', optionalAuth, async (req, res) => {
  console.log(`[Assets] Route hit for ${req.params.shop}/${req.params.objectId}`);
  try {
    const { shop, objectId } = req.params;

    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/assets`, {
      headers: getHeaders()
    });

    console.log(`[Assets] Response:`, JSON.stringify(response.data).substring(0, 500));
    res.json(formatResponse(response.data));
  } catch (error) {
    console.error(`[Assets] Error:`, error.message);
    res.json(null);
  }
});

// Proxy download sources from official Hydra API
router.get('/:shop/:objectId/download-sources', optionalAuth, async (req, res) => {
  try {
    const { shop, objectId } = req.params;

    const { take, skip, ...rest } = req.query;

    console.log(`[DownloadSources] Fetching for ${shop}/${objectId}... Query:`, JSON.stringify(req.query));
    const response = await axios.get(`${HYDRA_API}/games/${shop}/${objectId}/download-sources`, {
      params: {
        take: take || 100,
        skip: skip || 0,
        ...rest
      },
      headers: { 'User-Agent': 'HydraLauncher' }
    });

    console.log(`[DownloadSources] Got ${response.data?.length || 0} sources`);
    res.json(response.data);
  } catch (error) {
    console.error(`[DownloadSources] Error for ${req.params.shop}/${req.params.objectId}:`, error.message);
    if (error.response) {
      console.error(`[DownloadSources] Status: ${error.response.status}`);
      console.error(`[DownloadSources] Data:`, JSON.stringify(error.response.data));
    }
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
      headers: getHeaders()
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
      headers: getHeaders()
    });
    res.json(response.data);
  } catch {
    res.json(null);
  }
});

module.exports = router;
