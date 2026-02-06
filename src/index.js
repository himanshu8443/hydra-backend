require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const artifactsRoutes = require('./routes/artifacts');
const gamesRoutes = require('./routes/games');
const achievementsRoutes = require('./routes/achievements');
const usersRoutes = require('./routes/users');
const catalogueRoutes = require('./routes/catalogue');
const downloadSourcesRoutes = require('./routes/download-sources');
const badgesRoutes = require('./routes/badges');
const reviewsRoutes = require('./routes/reviews');
const featuresRoutes = require('./routes/features');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/tar', limit: '500mb' }));

// Debug logger
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path}`);
  next();
});

// Serve static auth pages
app.use('/auth', express.static(path.join(__dirname, '../public/auth')));

// Redirect root /auth to /auth/sign-in
app.get('/auth', (req, res) => res.redirect('/auth/sign-in'));
app.get('/auth/', (req, res) => res.redirect('/auth/sign-in'));

// Auth page routes - serve HTML for browser navigation
app.get('/auth/sign-in', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/auth/sign-in.html'));
});
app.get('/auth/sign-up', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/auth/sign-in.html'));
});

// API Routes
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/profile/games/artifacts', artifactsRoutes);
app.use('/profile/games/achievements', achievementsRoutes);
app.use('/games', gamesRoutes);
app.use('/users', usersRoutes);
app.use('/catalogue', catalogueRoutes);
app.use('/download-sources', downloadSourcesRoutes);
app.use('/badges', badgesRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/features', featuresRoutes);

// Hosters endpoint for Nimbus
app.post('/hosters/unlock', (req, res) => {
  res.json({ url: req.body.url });
});

// Client releases
app.get('/client/releases/decky', (req, res) => {
  res.json({ version: '1.0.0', downloadUrl: null });
});

// Debrid
app.post('/debrid/request-file', (req, res) => {
  res.json({ url: null });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Hydra Backend Server`);
  console.log(`========================================`);
  console.log(`  Status:  Running`);
  console.log(`  Port:    ${PORT}`);
  console.log(`  Time:    ${new Date().toISOString()}`);
  console.log(`========================================\n`);
});
