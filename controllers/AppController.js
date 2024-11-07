const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static async getStatus(req, res) {
    res.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static async getStats(req, res) {
    try {
      const usersCount = await dbClient.nbUsers();
      const filesCount = await dbClient.nbFiles();
      
      res.status(200).json({
        users: usersCount,
        files: filesCount,
      });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while fetching stats' });
    }
  }
}

module.exports = AppController;
