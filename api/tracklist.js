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
    if (req.method === 'GET') {
        try {
            const db = await connectToDatabase();
            const tracklist = await db.collection('tracklist').find({}).sort({ priority: 1, createdAt: 1 }).toArray();
            console.log(`📋 Fetched ${tracklist.length} tracklist entries`);
            res.json(tracklist);
        } catch (error) {
            console.error('Error fetching tracklist:', error);
            res.status(500).json({ error: 'Failed to fetch tracklist' });
        }
    } else if (req.method === 'POST') {
        try {
            const db = await connectToDatabase();
            const { songId, title, artist, album, duration, priority, requestedBy, masterId, slaveId, existsAtMaster, length } = req.body;
            
            const tracklistEntry = {
                songId,
                title,
                artist: artist || 'Unknown Artist',
                album: album || 'Unknown Album',
                duration: duration || 180,
                length: length || 0,
                status: 'queued',
                priority: priority || 2,
                createdAt: new Date(),
                playedAt: null,
                requestedBy: requestedBy || 'Anonymous',
                masterId: masterId || 'webapp',
                slaveId: slaveId || 'webapp',
                existsAtMaster: false
            };
            
            const result = await db.collection('tracklist').insertOne(tracklistEntry);
            console.log(`➕ Added song to tracklist: ${title} (existsAtMaster: ${tracklistEntry.existsAtMaster}, length: ${tracklistEntry.length})`);
            res.json({ success: true, id: result.insertedId });
        } catch (error) {
            console.error('Error adding to tracklist:', error);
            res.status(500).json({ error: 'Failed to add song to tracklist' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
