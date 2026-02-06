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

router.get('/home', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${HYDRA_API}/catalogue/home`, {
      params: req.query,
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.json([]);
  }
});

router.get('/featured', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${HYDRA_API}/catalogue/featured`, {
      params: req.query,
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.json([]);
  }
});

router.get('/hot', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${HYDRA_API}/catalogue/hot`, {
      params: req.query,
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.json([]);
  }
});

router.get('/weekly', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${HYDRA_API}/catalogue/weekly`, {
      params: req.query,
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.json([]);
  }
});

router.get('/achievements', optionalAuth, async (req, res) => {
  try {
    const response = await axios.get(`${HYDRA_API}/catalogue/achievements`, {
      params: req.query,
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.json([]);
  }
});

router.post('/search', optionalAuth, async (req, res) => {
  try {
    const response = await axios.post(`${HYDRA_API}/catalogue/search`, req.body, {
      headers: await getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.json({ results: [], hasNextPage: false });
  }
});

module.exports = router;
