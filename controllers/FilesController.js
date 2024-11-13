const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');
const { ObjectId } = require('mongodb');
const mime = require('mime-types');
const Bull = require('bull');


const fileQueue = new Bull('fileQueue');
const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const fileId = req.params.id;

    let file;
    try {
      file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
      if (!file) return res.status(404).json({ error: 'Not found' });
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if the file is a folder
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Check if the file is public or if the user is authorized
    const userId = await redisClient.get(`auth_${token}`);
    if (!file.isPublic && (!userId || userId !== file.userId.toString())) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if the file exists on the local system
    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Get the MIME type and serve the file content
    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(file.localPath);
    fileStream.pipe(res);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    let file;

    try {
      // Find the file document by ID and ensure it belongs to the authenticated user
      file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId });
      if (!file) return res.status(404).json({ error: 'Not found' });

      // Update isPublic to true
      await dbClient.db.collection('files').updateOne(
        { _id: new ObjectId(fileId) },
        { $set: { isPublic: true } }
      );

      // Retrieve the updated document
      file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
      return res.status(200).json(file);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    let file;

    try {
      // Find the file document by ID and ensure it belongs to the authenticated user
      file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId });
      if (!file) return res.status(404).json({ error: 'Not found' });

      // Update isPublic to false
      await dbClient.db.collection('files').updateOne(
        { _id: new ObjectId(fileId) },
        { $set: { isPublic: false } }
      );

      // Retrieve the updated document
      file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
      return res.status(200).json(file);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    let file;

    try {
      file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId });
      if (!file) return res.status(404).json({ error: 'Not found' });
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { parentId = 0, page = 0 } = req.query;
    const limit = 20;
    const skip = parseInt(page) * limit;
    const query = { userId };

    // If parentId is not 0, add it to the query
    if (parentId !== '0') {
      query.parentId = parentId;
    }

    try {
      const files = await dbClient.db.collection('files')
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

      return res.status(200).json(files);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    
    // Validate user token
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const { name, type, parentId = 0, isPublic = false, data } = req.body;
    
    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });
    
    // Check parentId validity if set
    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: parentId });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }
    
    // Prepare the file document
    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };
    
    if (type === 'folder') {
      // Save folder to DB
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({ id: result.insertedId, ...fileDocument });
    } else {
      // Handle file or image
      await fs.promises.mkdir(FOLDER_PATH, { recursive: true }); // Create directory if it doesn't exist
      
      const fileId = uuidv4();
      const filePath = path.join(FOLDER_PATH, fileId);
      
      // Decode and save the file data
      const fileBuffer = Buffer.from(data, 'base64');
      await fs.promises.writeFile(filePath, fileBuffer);
      
      // Add localPath to the file document
      fileDocument.localPath = filePath;
      
      // Save file to DB
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({ id: result.insertedId, ...fileDocument });
    }
  }
}

module.exports = FilesController;
