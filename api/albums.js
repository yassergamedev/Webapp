import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    cachedDb = client.db('jukebox');
    return cachedDb;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = await connectToDatabase();
        const albums = await db.collection('albums').find({}).toArray();
        console.log(`📀 Fetched ${albums.length} albums`);
        res.json(albums);
    } catch (error) {
        console.error('Error fetching albums:', error);
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
}
