const Bull = require('bull');
const fs = require('fs');
const path = require('path');
const imageThumbnail = require('image-thumbnail');
const dbClient = require('./utils/db');
const { ObjectId } = require('mongodb');

const fileQueue = new Bull('fileQueue');

// Function to generate thumbnails
async function generateThumbnails(originalPath) {
  const thumbnailSizes = [500, 250, 100];

  try {
    // Loop over each size and generate thumbnail
    for (const size of thumbnailSizes) {
      // Generate the thumbnail with the specified width
      const thumbnail = await imageThumbnail(originalPath, { width: size });

      // Construct the new file path with the size appended to the filename
      const ext = path.extname(originalPath);
      const fileNameWithoutExt = path.basename(originalPath, ext);
      const thumbnailPath = path.join(path.dirname(originalPath), `${fileNameWithoutExt}_${size}${ext}`);

      // Write the thumbnail to the new path
      await fs.promises.writeFile(thumbnailPath, thumbnail);
      console.log(`Thumbnail saved at: ${thumbnailPath}`);
    }
  } catch (error) {
    console.error('Error generating thumbnails:', error);
  }
}

// Process jobs in the queue
fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  // Retrieve the file document from the database
  const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId });
  if (!file) throw new Error('File not found');
  if (file.type !== 'image' || !file.localPath) throw new Error('File is not an image or missing localPath');

  // Generate and save thumbnails for the image file
  await generateThumbnails(file.localPath);
});
