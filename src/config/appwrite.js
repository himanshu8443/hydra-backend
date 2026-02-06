const { Client, Databases, Storage, ID, Query } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const BUCKET_ID = process.env.APPWRITE_ARTIFACTS_BUCKET_ID;

const COLLECTIONS = {
  USERS: 'users',
  ARTIFACTS: 'artifacts',
  ACHIEVEMENTS: 'achievements',
  GAMES: 'games'
};

module.exports = {
  client,
  databases,
  storage,
  DATABASE_ID,
  BUCKET_ID,
  COLLECTIONS,
  ID,
  Query
};
