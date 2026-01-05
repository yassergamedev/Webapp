import { WebSocket, WebSocketServer } from 'ws';
import { MongoClient } from 'mongodb';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PRIMARY_MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox";
const FALLBACK_MONGODB_URI = process.env.MONGODB_DIRECT_URI || process.env.MONGODB_FALLBACK_URI || null;
const mongoClientOptions = {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS) || 5000
};

// Track clients with metadata (role: 'master' | 'slave' | 'unknown')
let clients = new Map(); // Map<WebSocket, { role: string, id: string }>
let hubClient = null; // Reference to the hub/master WebSocket connection
let db = null;
let mongoClient = null;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
function isDnsSrvError(error) {
    if (!error) return false;
    if (error.code && ['ENOTFOUND', 'ESERVFAIL', 'ETIMEOUT', 'ENODATA'].includes(error.code)) {
        return true;
    }
    return typeof error.message === 'string' && /_mongodb\._tcp\./.test(error.message);
}

async function createMongoClient(uri, options = {}) {
    const client = new MongoClient(uri, {
        ...mongoClientOptions,
        ...options
    });
    await client.connect();
    return client;
}

async function initializeDatabase(client) {
    mongoClient = client;
    db = mongoClient.db('jukebox');
    const tracklist = db.collection('tracklist');

    const changeStream = tracklist.watch();
    changeStream.on('change', async (change) => {
        console.log('🔄 MongoDB change detected:', change.operationType);

        const message = JSON.stringify({
            operationType: change.operationType,
            songId: change.fullDocument?._id,
            songTitle: change.fullDocument?.title,
            status: change.fullDocument?.status,
            album: change.fullDocument?.album,
            artist: change.fullDocument?.artist,
            existsAtMaster: change.fullDocument?.existsAtMaster,
            length: change.fullDocument?.length,
            priority: change.fullDocument?.priority,
            requestedBy: change.fullDocument?.requestedBy,
            masterId: change.fullDocument?.masterId,
            slaveId: change.fullDocument?.slaveId,
            createdAt: change.fullDocument?.createdAt,
            playedAt: change.fullDocument?.playedAt,
            timestamp: new Date().toISOString()
        });

        console.log(`📡 Broadcasting to ${clients.size} client(s):`, {
            operationType: change.operationType,
            songTitle: change.fullDocument?.title,
            status: change.fullDocument?.status
        });

        // Broadcast to all clients
        clients.forEach((clientInfo, clientSocket) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(message);
            }
        });
    });

    changeStream.on('error', (error) => {
        console.error('❌ Change stream error:', error);
    });
}

// Convert SRV URI to direct connection URI
function convertSrvToDirect(srvUri) {
    if (!srvUri.startsWith('mongodb+srv://')) {
        return srvUri;
    }
    
    // Extract credentials and hostname from SRV URI
    const match = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^\/]+)(\/.*)?$/);
    if (!match) {
        return null;
    }
    
    const [, credentials, hostname, path] = match;
    
    // MongoDB Atlas typically uses these hostname patterns
    // Try common shard patterns
    const baseHost = hostname.replace(/\.mongodb\.net$/, '');
    const directHosts = [
        `${baseHost}-shard-00-00.w1btiwn.mongodb.net:27017`,
        `${baseHost}-shard-00-01.w1btiwn.mongodb.net:27017`,
        `${baseHost}-shard-00-02.w1btiwn.mongodb.net:27017`
    ];
    
    const dbPath = path || '/jukebox';
    const queryParams = '?ssl=true&replicaSet=atlas-shard-0&authSource=admin&retryWrites=true&w=majority';
    
    return `mongodb://${credentials}@${directHosts.join(',')}${dbPath}${queryParams}`;
}

async function connectToMongoDB() {
    let lastError = null;
    try {
        const client = await createMongoClient(PRIMARY_MONGODB_URI);
        console.log('✅ Connected to MongoDB (primary URI)');
        await initializeDatabase(client);
        return;
    } catch (error) {
        lastError = error;
        console.error('⚠️  MongoDB connection error for primary URI:', error?.message || error);
    }

    // If DNS SRV error and no explicit fallback, try to auto-convert SRV to direct
    let fallbackUri = FALLBACK_MONGODB_URI;
    if (!fallbackUri && isDnsSrvError(lastError) && PRIMARY_MONGODB_URI.startsWith('mongodb+srv://')) {
        console.log('🔄 Attempting to convert SRV URI to direct connection...');
        fallbackUri = convertSrvToDirect(PRIMARY_MONGODB_URI);
        if (fallbackUri) {
            console.log('   Using auto-generated direct connection URI');
        }
    }

    if (!fallbackUri) {
        if (isDnsSrvError(lastError)) {
            console.error('❌ DNS SRV lookups appear blocked. Could not auto-convert to direct connection.');
        } else {
            console.error('❌ MongoDB connection failed and no fallback URI available.');
        }
        return;
    }

    try {
        const fallbackOptions = fallbackUri.startsWith('mongodb://')
            ? { directConnection: true }
            : {};
        const client = await createMongoClient(fallbackUri, fallbackOptions);
        console.log('✅ Connected to MongoDB (fallback URI)');
        await initializeDatabase(client);
    } catch (fallbackError) {
        console.error('❌ MongoDB connection failed for fallback URI as well:', fallbackError?.message || fallbackError);
    }
}

// Handle WebSocket connections
// 
// Client Registration:
// Clients should send a registration message after connecting:
//   { type: 'register', role: 'master' }  - for hub/master clients
//   { type: 'register', role: 'slave' }   - for slave clients
//
// Hub Disconnection Notification:
// When the hub/master disconnects, all registered slave clients will receive:
//   { operationType: 'hubStatus', hubConnected: false, timestamp: '...' }
// When the hub/master reconnects, slaves will receive:
//   { operationType: 'hubStatus', hubConnected: true, timestamp: '...' }
//
wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(2, 11);
    console.log(`🔌 New WebSocket client connected (ID: ${clientId})`);
    
    // Initialize client with unknown role
    clients.set(ws, { role: 'unknown', id: clientId });
    
    // Send current tracklist to new client
    if (db) {
        db.collection('tracklist').find({}).sort({ priority: 1, createdAt: 1 }).toArray()
            .then(tracklist => {
                const initialData = JSON.stringify({
                    operationType: 'initial',
                    tracklist: tracklist,
                    timestamp: new Date().toISOString()
                });
                ws.send(initialData);
                console.log(`📤 Sent initial tracklist (${tracklist.length} songs) to client ${clientId}`);
            })
            .catch(error => {
                console.error('❌ Error sending initial data:', error);
            });
    }
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📨 Received message from client ${clientId}:`, data);
            
            // Handle different message types
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                    break;
                case 'getTracklist':
                    if (db) {
                        db.collection('tracklist').find({}).sort({ priority: 1, createdAt: 1 }).toArray()
                            .then(tracklist => {
                                ws.send(JSON.stringify({
                                    type: 'tracklist',
                                    tracklist: tracklist,
                                    timestamp: new Date().toISOString()
                                }));
                            });
                    }
                    break;
                case 'register':
                    // Client is registering its role (master/hub or slave)
                    const role = data.role || 'unknown';
                    const clientInfo = clients.get(ws);
                    if (clientInfo) {
                        clientInfo.role = role;
                        console.log(`📝 Client ${clientId} registered as: ${role}`);
                        
                        // If this is the hub/master, store reference
                        if (role === 'master' || role === 'hub') {
                            // If there was a previous hub, notify slaves about the change
                            if (hubClient && hubClient !== ws) {
                                console.log('⚠️  Previous hub connection exists, replacing it');
                                const oldHubInfo = clients.get(hubClient);
                                if (oldHubInfo) {
                                    oldHubInfo.role = 'unknown';
                                }
                            }
                            hubClient = ws;
                            console.log(`🏠 Hub/Master registered: ${clientId}`);
                        }
                        
                        // Send confirmation
                        ws.send(JSON.stringify({
                            type: 'registered',
                            role: role,
                            clientId: clientId,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;
                default:
                    console.log(`❓ Unknown message type from client ${clientId}:`, data.type);
            }
        } catch (error) {
            console.error(`❌ Error parsing client message from ${clientId}:`, error);
        }
    });
    
    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        const role = clientInfo?.role || 'unknown';
        console.log(`🔌 WebSocket client disconnected (ID: ${clientId}, Role: ${role})`);
        
        // If the hub disconnected, clear the reference
        if (role === 'master' || role === 'hub' || ws === hubClient) {
            hubClient = null;
        }
        
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        const clientInfo = clients.get(ws);
        const role = clientInfo?.role || 'unknown';
        console.error(`❌ WebSocket error for client ${clientId} (Role: ${role}):`, error);
        
        // If the hub had an error, clear the reference
        if (role === 'master' || role === 'hub' || ws === hubClient) {
            hubClient = null;
        }
        
        clients.delete(ws);
    });
});

// Handle server errors
wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error);
});

// API Routes

// Add song to tracklist
app.post('/api/tracklist', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const tracklistCollection = db.collection('tracklist');
        const newEntry = {
            ...req.body,
            _id: new Date().getTime().toString(),
            createdAt: new Date(),
            playedAt: null
        };

        const result = await tracklistCollection.insertOne(newEntry);
        res.json({ success: true, id: result.insertedId });
    } catch (error) {
        console.error('Error adding to tracklist:', error);
        res.status(500).json({ error: 'Failed to add to tracklist' });
    }
});

// Pause current song
app.post('/api/pause', async (req, res) => {
    console.log('[API] /api/pause called');
    try {
        if (!db) {
            console.log('[API] /api/pause -> DB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const tracklistCollection = db.collection('tracklist');
        
        // Find currently playing song
        const currentSong = await tracklistCollection.findOne({ status: 'playing' });
        if (!currentSong) {
            console.log('[API] /api/pause -> No song currently playing');
            return res.status(404).json({ error: 'No song currently playing' });
        }

        // Update status to paused
        await tracklistCollection.updateOne(
            { _id: currentSong._id },
            { $set: { status: 'paused', pausedAt: new Date() } }
        );
        console.log('[API] /api/pause -> Paused', { _id: currentSong._id, title: currentSong.title });
        
        // Broadcast explicit PAUSE command to all WebSocket clients
        const pauseMessage = JSON.stringify({
            operationType: 'pause',
            songId: currentSong._id,
            songTitle: currentSong.title,
            status: 'paused',
            timestamp: new Date().toISOString()
        });
        
        clients.forEach((clientInfo, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(pauseMessage);
            }
        });
        
        console.log('[API] /api/pause -> Broadcasted PAUSE command to clients');
        res.json({ success: true, message: 'Song paused' });
    } catch (error) {
        console.error('Error pausing song:', error);
        res.status(500).json({ error: 'Failed to pause song' });
    }
});

// Resume paused song
app.post('/api/resume', async (req, res) => {
    console.log('[API] /api/resume called');
    try {
        if (!db) {
            console.log('[API] /api/resume -> DB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const tracklistCollection = db.collection('tracklist');
        
        // Find paused song
        const pausedSong = await tracklistCollection.findOne({ status: 'paused' });
        if (!pausedSong) {
            console.log('[API] /api/resume -> No song currently paused');
            return res.status(404).json({ error: 'No song currently paused' });
        }

        // Update status to playing
        await tracklistCollection.updateOne(
            { _id: pausedSong._id },
            { $set: { status: 'playing', resumedAt: new Date() } }
        );
        console.log('[API] /api/resume -> Resumed', { _id: pausedSong._id, title: pausedSong.title });
        
        // Broadcast explicit RESUME command to all WebSocket clients
        const resumeMessage = JSON.stringify({
            operationType: 'resume',
            songId: pausedSong._id,
            songTitle: pausedSong.title,
            status: 'playing',
            timestamp: new Date().toISOString()
        });
        
        clients.forEach((clientInfo, client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(resumeMessage);
            }
        });
        
        console.log('[API] /api/resume -> Broadcasted RESUME command to clients');
        res.json({ success: true, message: 'Song resumed' });
    } catch (error) {
        console.error('Error resuming song:', error);
        res.status(500).json({ error: 'Failed to resume song' });
    }
});

// Skip current song
app.post('/api/skip', async (req, res) => {
    console.log('[API] /api/skip called');
    try {
        if (!db) {
            console.log('[API] /api/skip -> DB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const tracklistCollection = db.collection('tracklist');
        
        // Find currently playing song
        const currentSong = await tracklistCollection.findOne({ status: 'playing' });
        if (!currentSong) {
            console.log('[API] /api/skip -> No song currently playing');
            return res.status(404).json({ error: 'No song currently playing' });
        }

        // Remove current song from tracklist entirely instead of marking as skipped
        await tracklistCollection.deleteOne({ _id: currentSong._id });
        console.log('[API] /api/skip -> Deleted', { _id: currentSong._id, title: currentSong.title });

        // Find next queued song
        const nextSong = await tracklistCollection.findOne(
            { status: 'queued' },
            { sort: { priority: 1, createdAt: 1 } }
        );

        if (nextSong) {
            // Start next song
            await tracklistCollection.updateOne(
                { _id: nextSong._id },
                { $set: { status: 'playing', playedAt: new Date() } }
            );
            console.log('[API] /api/skip -> Started next song', { _id: nextSong._id, title: nextSong.title });
        }

        res.json({ success: true, message: 'Song skipped', nextSong: nextSong?.title || null });
    } catch (error) {
        console.error('Error skipping song:', error);
        res.status(500).json({ error: 'Failed to skip song' });
    }
});

// Update song validation status
app.post('/api/validate', async (req, res) => {
    console.log('[API] /api/validate called');
    try {
        if (!db) {
            console.log('[API] /api/validate -> DB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const { tracklistId, existsAtMaster, length } = req.body;
        
        if (!tracklistId) {
            return res.status(400).json({ error: 'tracklistId is required' });
        }

        const tracklistCollection = db.collection('tracklist');
        
        // Update the song's validation status
        const updateData = { existsAtMaster: existsAtMaster };
        if (length !== undefined) {
            updateData.length = length;
        }
        
        const result = await tracklistCollection.updateOne(
            { _id: tracklistId },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            console.log('[API] /api/validate -> Song not found:', tracklistId);
            return res.status(404).json({ error: 'Song not found' });
        }
        
        console.log('[API] /api/validate -> Updated validation status:', {
            tracklistId,
            existsAtMaster,
            length
        });
        
        res.json({ success: true, message: 'Validation status updated' });
    } catch (error) {
        console.error('Error updating validation status:', error);
        res.status(500).json({ error: 'Failed to update validation status' });
    }
});

// Get current status
app.get('/api/status', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const tracklistCollection = db.collection('tracklist');
        
        const [currentSong, queuedSongs, playedSongs] = await Promise.all([
            tracklistCollection.findOne({ status: 'playing' }),
            tracklistCollection.find({ status: 'queued' }).sort({ priority: 1, createdAt: 1 }).toArray(),
            tracklistCollection.find({ status: 'played' }).sort({ playedAt: -1 }).limit(5).toArray()
        ]);

        res.json({
            currentSong,
            queuedSongs,
            playedSongs,
            totalQueued: queuedSongs.length,
            totalPlayed: playedSongs.length
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Start the server
console.log('🚀 Starting combined WebSocket and API server on port 8081...');

// Start server
server.listen(8081, () => {
    console.log('✅ Server running on port 8081');
    console.log('  📡 WebSocket: ws://localhost:8081');
    console.log('  🌐 HTTP API: http://localhost:8081');
});

// Connect to MongoDB
connectToMongoDB();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wss.close(async () => {
        console.log('✅ WebSocket server closed');
        if (mongoClient) {
            try {
                await mongoClient.close();
                console.log('✅ MongoDB connection closed');
            } catch (error) {
                console.error('⚠️  Error closing MongoDB connection:', error);
            }
        }
        process.exit(0);
    });
});

console.log('✅ WebSocket server running on port 8080');
