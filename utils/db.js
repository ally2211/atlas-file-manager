import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = 'localhost';
    const port = 27017;
    const database = 'files_manager';
    const url = `mongodb+srv://myAtlasDBUser:HelloAgain22@myatlasclusteredu.asusjdu.mongodb.net/?retryWrites=true&w=majority&appName=myAtlasClusterEDU`
    //const url = `mongodb://${host}:${port}`;

    // Create the client instance but do not connect immediately
    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    this.db = null;

    // Connect manually and set up the database
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db('files_manager');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB Client Error:', error);
    }
  }

  isAlive() {
    return this.client && this.client.topology && this.client.topology.isConnected();
  }

  async nbUsers() {
    if (!this.db) return 0;
    await this.client.connect();
    const usersCollection = this.db.collection('users');
    //console.log('in nbUsers' + usersCollection.countDocuments());
    return usersCollection.countDocuments();
  }

async getUsers() {
  if (!this.db) return [];
  const usersCollection = this.db.collection('users');
  return await usersCollection.find({}).toArray();
}

  async nbFiles() {
    if (!this.db) return 0;
    const filesCollection = this.db.collection('files');
    return filesCollection.countDocuments();
  }
}

// Create and export an instance of DBClient
const dbClient = new DBClient();
module.exports = dbClient;
