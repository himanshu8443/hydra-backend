const express = require('express');
const axios = require('axios');
const { optionalAuth } = require('../middleware/auth');
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

// Proxy features list from official API
router.get('/', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${HYDRA_API}/features`, {
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    // If auth fails or proxy fails, return empty list (or common features if known)
    // Common response might be ["cloud_save", "achievements", "community"]
    res.json([]);
  }
});

module.exports = router;
