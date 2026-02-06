require('dotenv').config();

const { Client, Databases, Storage, ID } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'hydra_db';
const BUCKET_ID = process.env.APPWRITE_ARTIFACTS_BUCKET_ID || 'artifacts';

async function setup() {
  console.log('Setting up Appwrite database and collections...\n');

  try {
    await databases.create(DATABASE_ID, 'Hydra Database');
    console.log('✓ Database created');
  } catch (e) {
    if (e.code === 409) console.log('→ Database already exists');
    else throw e;
  }

  // Users collection
  try {
    await databases.createCollection(DATABASE_ID, 'users', 'Users');
    await databases.createStringAttribute(DATABASE_ID, 'users', 'userId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'users', 'username', 255, false);
    await databases.createStringAttribute(DATABASE_ID, 'users', 'displayName', 255, false);
    await databases.createStringAttribute(DATABASE_ID, 'users', 'email', 255, false);
    await databases.createStringAttribute(DATABASE_ID, 'users', 'profileImageUrl', 2048, false);
    await databases.createStringAttribute(DATABASE_ID, 'users', 'backgroundImageUrl', 2048, false);
    await databases.createStringAttribute(DATABASE_ID, 'users', 'bio', 1000, false);
    await databases.createIndex(DATABASE_ID, 'users', 'userId_idx', 'key', ['userId']);
    console.log('✓ Users collection created');
  } catch (e) {
    if (e.code === 409) console.log('→ Users collection already exists');
    else console.log('! Users error:', e.message);
  }

  // Artifacts collection
  try {
    await databases.createCollection(DATABASE_ID, 'artifacts', 'Artifacts');
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'userId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'fileId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'shop', 50, true);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'objectId', 255, true);
    await databases.createIntegerAttribute(DATABASE_ID, 'artifacts', 'artifactLengthInBytes', false);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'hostname', 255, false);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'winePrefixPath', 2048, false);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'homeDir', 2048, false);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'downloadOptionTitle', 255, false);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'platform', 50, false);
    await databases.createStringAttribute(DATABASE_ID, 'artifacts', 'label', 255, false);
    await databases.createIntegerAttribute(DATABASE_ID, 'artifacts', 'downloadCount', false);
    await databases.createBooleanAttribute(DATABASE_ID, 'artifacts', 'isFrozen', false);
    await databases.createIndex(DATABASE_ID, 'artifacts', 'userId_idx', 'key', ['userId']);
    await databases.createIndex(DATABASE_ID, 'artifacts', 'game_idx', 'key', ['userId', 'shop', 'objectId']);
    console.log('✓ Artifacts collection created');
  } catch (e) {
    if (e.code === 409) console.log('→ Artifacts collection already exists');
    else console.log('! Artifacts error:', e.message);
  }

  // Achievements collection
  try {
    await databases.createCollection(DATABASE_ID, 'achievements', 'Achievements');
    await databases.createStringAttribute(DATABASE_ID, 'achievements', 'userId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'achievements', 'gameId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'achievements', 'achievements', 100000, false);
    await databases.createIndex(DATABASE_ID, 'achievements', 'user_game_idx', 'key', ['userId', 'gameId']);
    console.log('✓ Achievements collection created');
  } catch (e) {
    if (e.code === 409) console.log('→ Achievements collection already exists');
    else console.log('! Achievements error:', e.message);
  }

  // Games collection
  try {
    await databases.createCollection(DATABASE_ID, 'games', 'Games');
    await databases.createStringAttribute(DATABASE_ID, 'games', 'userId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'games', 'objectId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, 'games', 'shop', 50, true);
    await databases.createStringAttribute(DATABASE_ID, 'games', 'title', 500, false);
    await databases.createStringAttribute(DATABASE_ID, 'games', 'iconUrl', 2048, false);
    await databases.createStringAttribute(DATABASE_ID, 'games', 'coverImage', 2048, false);
    await databases.createIntegerAttribute(DATABASE_ID, 'games', 'playTimeInSeconds', false);
    await databases.createDatetimeAttribute(DATABASE_ID, 'games', 'lastTimePlayed', false);
    await databases.createBooleanAttribute(DATABASE_ID, 'games', 'isFavorite', false);
    await databases.createBooleanAttribute(DATABASE_ID, 'games', 'isPinned', false);
    await databases.createIndex(DATABASE_ID, 'games', 'userId_idx', 'key', ['userId']);
    await databases.createIndex(DATABASE_ID, 'games', 'game_lookup_idx', 'key', ['userId', 'objectId', 'shop']);
    console.log('✓ Games collection created');
  } catch (e) {
    if (e.code === 409) console.log('→ Games collection already exists');
    else console.log('! Games error:', e.message);
  }

  // Storage bucket
  try {
    await storage.createBucket(
      BUCKET_ID,
      'Artifacts Storage',
      ['read("any")', 'write("any")'],
      false,  // fileSecurity
      true,   // enabled
      524288000,  // 500MB max file size
      ['tar', 'gz'],  // allowed extensions
      'gzip',  // compression
      false,  // encryption
      false   // antivirus
    );
    console.log('✓ Storage bucket created');
  } catch (e) {
    if (e.code === 409) console.log('→ Storage bucket already exists');
    else console.log('! Storage error:', e.message);
  }

  console.log('\n✓ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Update .env with your Appwrite credentials');
  console.log('3. Run: npm start');
}

setup().catch(console.error);
