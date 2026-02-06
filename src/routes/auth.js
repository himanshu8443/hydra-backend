const express = require('express');
const { generateToken, verifyToken, authMiddleware } = require('../middleware/auth');
const { databases, DATABASE_ID, COLLECTIONS, ID, Query } = require('../config/appwrite');
const { Account, Client } = require('node-appwrite');

const router = express.Router();

const createUserClient = () => {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID);
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const client = createUserClient();
    client.setKey(process.env.APPWRITE_API_KEY);
    const account = new Account(client);

    const user = await account.create(
      ID.unique(),
      email,
      password,
      username || email.split('@')[0]
    );

    await databases.createDocument(DATABASE_ID, COLLECTIONS.USERS, ID.unique(), {
      userId: user.$id,
      username: username || email.split('@')[0],
      displayName: username || email.split('@')[0],
      email: email,
      profileImageUrl: null,
      backgroundImageUrl: null,
      bio: ''
    });

    const accessToken = generateToken(user.$id, '7d');
    const refreshToken = generateToken(user.$id, '30d');

    res.json({
      user: {
        id: user.$id,
        email: user.email,
        username: username || email.split('@')[0]
      },
      accessToken,
      refreshToken,
      expiresIn: 604800
    });
  } catch (error) {
    if (error.code === 409) {
      return res.status(409).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const client = createUserClient();
    const account = new Account(client);

    const session = await account.createEmailPasswordSession(email, password);
    
    client.setSession(session.secret);
    const user = await account.get();

    const accessToken = generateToken(user.$id, '7d');
    const refreshToken = generateToken(user.$id, '30d');

    res.json({
      user: {
        id: user.$id,
        email: user.email,
        username: user.name
      },
      accessToken,
      refreshToken,
      expiresIn: 604800
    });
  } catch (error) {
    if (error.code === 401) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = generateToken(decoded.userId, '7d');
    
    res.json({
      accessToken,
      expiresIn: 604800
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ws', authMiddleware, async (req, res) => {
  const wsToken = generateToken(req.userId, '1h');
  res.json({ token: wsToken });
});

router.post('/logout', authMiddleware, async (req, res) => {
  res.json({ ok: true });
});

router.post('/payment', authMiddleware, async (req, res) => {
  res.json({ paymentUrl: null, message: 'Premium features are free on this server!' });
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const users = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
      Query.equal('userId', req.userId)
    ]);

    if (users.documents.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users.documents[0];
    res.json({
      id: user.userId,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
