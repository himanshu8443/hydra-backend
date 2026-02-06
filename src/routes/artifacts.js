const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { databases, storage, DATABASE_ID, BUCKET_ID, COLLECTIONS, ID, Query } = require('../config/appwrite');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { objectId, shop } = req.query;

    const queries = [Query.equal('userId', req.userId)];
    if (objectId) queries.push(Query.equal('objectId', objectId));
    if (shop) queries.push(Query.equal('shop', shop));

    const artifacts = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ARTIFACTS, queries);

    res.json(artifacts.documents.map(doc => ({
      id: doc.$id,
      artifactLengthInBytes: doc.artifactLengthInBytes,
      downloadOptionTitle: doc.downloadOptionTitle,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
      hostname: doc.hostname,
      downloadCount: doc.downloadCount || 0,
      label: doc.label,
      isFrozen: doc.isFrozen || false
    })));
  } catch {
    res.json([]);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      artifactLengthInBytes,
      shop,
      objectId,
      hostname,
      winePrefixPath,
      homeDir,
      downloadOptionTitle,
      platform,
      label
    } = req.body;

    const fileId = ID.unique();
    
    const artifact = await databases.createDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, ID.unique(), {
      userId: req.userId,
      fileId,
      shop,
      objectId,
      artifactLengthInBytes,
      hostname,
      winePrefixPath,
      homeDir,
      downloadOptionTitle,
      platform,
      label,
      downloadCount: 0,
      isFrozen: false
    });

    // Generate upload URL - Appwrite requires using their SDK for uploads
    // Client will upload to this endpoint with the file
    const uploadUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files`;

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const token = req.headers.authorization?.split(' ')[1] || '';
    res.json({
      id: artifact.$id,
      uploadUrl: `${baseUrl}/profile/games/artifacts/${artifact.$id}/upload?token=${token}`,
      fileId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/upload', authMiddleware, async (req, res) => {
  try {
    console.log(`[Upload] Starting upload for artifact ${req.params.id}`);
    const artifact = await databases.getDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);
    
    if (artifact.userId !== req.userId) {
      console.log('[Upload] Forbidden: User mismatch');
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Handle file upload from raw body (parsed by express.raw middleware)
    let finalBuffer = req.body;
    
    console.log(`[Upload] Body type: ${typeof req.body}, IsBuffer: ${Buffer.isBuffer(req.body)}, Length: ${req.body?.length}`);

    if (!Buffer.isBuffer(finalBuffer) || finalBuffer.length === 0) {
      // Fallback if middleware didn't parse it
      console.log('[Upload] Parsing stream manually...');
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const manualBuffer = Buffer.concat(chunks);
      if (manualBuffer.length > 0) {
           finalBuffer = manualBuffer;
      } else {
         console.log('[Upload] Empty file error');
         return res.status(400).json({ error: 'Empty file' });
      }
    }
    
    console.log(`[Upload] Final buffer size: ${finalBuffer.length}`);

    const { InputFile } = require('node-appwrite');
    const file = await storage.createFile(
      BUCKET_ID,
      artifact.fileId,
      InputFile.fromBuffer(finalBuffer, `${artifact.fileId}.tar`)
    );
    
    console.log(`[Upload] Created file in Appwrite: ${file.$id}`);

    res.json({ ok: true, fileId: file.$id });
  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/download', authMiddleware, async (req, res) => {
  try {
    const artifact = await databases.getDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);
    
    if (artifact.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Update download count
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id, {
      downloadCount: (artifact.downloadCount || 0) + 1
    });

    // Get file download URL
    const fileUrl = storage.getFileDownload(BUCKET_ID, artifact.fileId);

    res.json({
      downloadUrl: fileUrl,
      objectKey: `artifacts/${artifact.userId}/${artifact.fileId}.tar`,
      homeDir: artifact.homeDir,
      winePrefixPath: artifact.winePrefixPath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const artifact = await databases.getDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);
    
    if (artifact.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete file from storage
    try {
      await storage.deleteFile(BUCKET_ID, artifact.fileId);
    } catch {}

    // Delete document
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/label', authMiddleware, async (req, res) => {
  try {
    const { label } = req.body;
    const artifact = await databases.getDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);
    
    if (artifact.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id, { label });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/freeze', authMiddleware, async (req, res) => {
  try {
    const artifact = await databases.getDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);
    
    if (artifact.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id, { isFrozen: true });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/unfreeze', authMiddleware, async (req, res) => {
  try {
    const artifact = await databases.getDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id);
    
    if (artifact.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.ARTIFACTS, req.params.id, { isFrozen: false });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
