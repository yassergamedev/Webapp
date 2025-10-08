import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 80;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
let db;

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('jukebox');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}

// API Routes

// Debug route to test if API is working
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

// Get all albums
app.get('/api/albums', async (req, res) => {
    try {
        const albums = await db.collection('albums').find({}).toArray();
        console.log(`📀 Fetched ${albums.length} albums`);
        res.json(albums);
    } catch (error) {
        console.error('Error fetching albums:', error);
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
});

// Get all songs
app.get('/api/songs', async (req, res) => {
    try {
        const songs = await db.collection('songs').find({}).toArray();
        console.log(`🎵 Fetched ${songs.length} songs`);
        res.json(songs);
    } catch (error) {
        console.error('Error fetching songs:', error);
        res.status(500).json({ error: 'Failed to fetch songs' });
    }
});

// Get songs by album
app.get('/api/songs/album/:albumTitle', async (req, res) => {
    try {
        const albumTitle = decodeURIComponent(req.params.albumTitle);
        const songs = await db.collection('songs').find({ album: albumTitle }).toArray();
        console.log(`🎵 Fetched ${songs.length} songs for album: ${albumTitle}`);
        res.json(songs);
    } catch (error) {
        console.error('Error fetching songs by album:', error);
        res.status(500).json({ error: 'Failed to fetch songs by album' });
    }
});

// Get tracklist (playlist)
app.get('/api/tracklist', async (req, res) => {
    try {
        const tracklist = await db.collection('tracklist').find({}).sort({ priority: 1, createdAt: 1 }).toArray();
        console.log(`📋 Fetched ${tracklist.length} tracklist entries`);
        res.json(tracklist);
    } catch (error) {
        console.error('Error fetching tracklist:', error);
        res.status(500).json({ error: 'Failed to fetch tracklist' });
    }
});

// Add song to tracklist
app.post('/api/tracklist', async (req, res) => {
    try {
        const { songId, title, artist, album, duration, priority, requestedBy, masterId, slaveId, existsAtMaster, length } = req.body;
        
        const tracklistEntry = {
            songId,
            title,
            artist: artist || 'Unknown Artist',
            album: album || 'Unknown Album',
            duration: duration || 180,
            length: length || 0, // Use provided length or default to 0
            status: 'queued',
            priority: priority || 2,
            createdAt: new Date(),
            playedAt: null,
            requestedBy: requestedBy || 'Anonymous',
            masterId: masterId || 'webapp',
            slaveId: slaveId || 'webapp',
            existsAtMaster: false // Always false for slave requests - master must confirm
        };
        
        const result = await db.collection('tracklist').insertOne(tracklistEntry);
        console.log(`➕ Added song to tracklist: ${title} (existsAtMaster: ${tracklistEntry.existsAtMaster}, length: ${tracklistEntry.length})`);
        res.json({ success: true, id: result.insertedId });
    } catch (error) {
        console.error('Error adding to tracklist:', error);
        res.status(500).json({ error: 'Failed to add song to tracklist' });
    }
});

// Search songs
app.get('/api/search', async (req, res) => {
    try {
        const { q, type = 'all' } = req.query;
        
        if (!q) {
            return res.json([]);
        }
        
        const searchRegex = new RegExp(q, 'i');
        let query = {};
        
        if (type === 'songs') {
            query = { title: searchRegex };
        } else if (type === 'albums') {
            query = { title: searchRegex };
        } else {
            // Search both songs and albums
            const songs = await db.collection('songs').find({ title: searchRegex }).toArray();
            const albums = await db.collection('albums').find({ title: searchRegex }).toArray();
            return res.json({ songs, albums });
        }
        
        const results = await db.collection(type === 'albums' ? 'albums' : 'songs').find(query).toArray();
        console.log(`🔍 Search for "${q}" returned ${results.length} results`);
        res.json(results);
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: 'Failed to search' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        mongodb: db ? 'connected' : 'disconnected'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Jukebox API Server',
        version: '1.0.0',
        endpoints: [
            'GET /api/test - Test endpoint',
            'GET /api/albums - Get all albums',
            'GET /api/songs - Get all songs',
            'GET /api/songs/album/:title - Get songs by album',
            'GET /api/tracklist - Get tracklist',
            'POST /api/tracklist - Add song to tracklist',
            'GET /api/search?q=query - Search songs/albums',
            'GET /api/health - Health check'
        ]
    });
});

// Start server
async function startServer() {
    await connectToMongoDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 API Server running on http://localhost:${PORT}`);
        console.log(`📡 Available endpoints:`);
        console.log(`   GET  /api/albums - Get all albums`);
        console.log(`   GET  /api/songs - Get all songs`);
        console.log(`   GET  /api/songs/album/:title - Get songs by album`);
        console.log(`   GET  /api/tracklist - Get tracklist`);
        console.log(`   POST /api/tracklist - Add song to tracklist`);
        console.log(`   GET  /api/search?q=query - Search songs/albums`);
        console.log(`   GET  /api/health - Health check`);
    });
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down API server...');
    process.exit(0);
});
