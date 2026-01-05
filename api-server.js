import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import https from 'https';
import http from 'http';

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// SSL Certificate paths
// Use the new certificate files
process.env.SSL_KEY_PATH = '/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au_key.key';
process.env.SSL_CERT_PATH = '/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.crt';
// Optional: You can add the new CA bundle if it exists
process.env.SSL_CA_PATH = existsSync('/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.ca-bundle') 
    ? '/home/arcade/Webapp/ssl/jukebox.8bitbar.com.au.ca-bundle' 
    : null;
// SSL Certificate configuration
const SSL_OPTIONS = {
    key: process.env.SSL_KEY_PATH ? readFileSync(process.env.SSL_KEY_PATH) : null,
    cert: process.env.SSL_CERT_PATH ? readFileSync(process.env.SSL_CERT_PATH) : null,
    // Add CA certificate for intermediate certificates
    ca: process.env.SSL_CA_PATH ? readFileSync(process.env.SSL_CA_PATH) : null
};

// MongoDB connection
const PRIMARY_MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const FALLBACK_MONGODB_URI = process.env.MONGODB_DIRECT_URI || process.env.MONGODB_FALLBACK_URI || null;
const mongoClientOptions = {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS) || 5000
};
let db;
let mongoClient;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static files (HTML, CSS, JS)
app.get('/', (req, res) => {
    try {
        const content = readFileSync(join(__dirname, 'index.html'), 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(content);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(404).send('File not found');
    }
});

// Serve CSS files
app.get('/styles.css', (req, res) => {
    try {
        const content = readFileSync(join(__dirname, 'styles.css'), 'utf8');
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(content);
    } catch (error) {
        console.error('Error serving styles.css:', error);
        res.status(404).send('CSS file not found');
    }
});

// Serve JS files
app.get('/script.js', (req, res) => {
    try {
        const content = readFileSync(join(__dirname, 'script.js'), 'utf8');
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(content);
    } catch (error) {
        console.error('Error serving script.js:', error);
        res.status(404).send('JS file not found');
    }
});

// Load albums configuration
function loadAlbumsConfig() {
    try {
        // Try to load from config file first
        const configPath = join(__dirname, 'albums-config.json');
        if (existsSync(configPath)) {
            const configData = readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            if (config.albumsFolderPath) {
                process.env.ALBUMS_FOLDER_PATH = config.albumsFolderPath;
            }
            if (config.coverFileName) {
                process.env.COVER_FILE_NAME = config.coverFileName;
            }
            console.log('📁 Loaded albums config from file:', config);
        }
    } catch (error) {
        console.log('📁 No albums config file found, using defaults');
    }
}

// Helper function to calculate song progress
function calculateProgress(song) {
    if (!song || song.status !== 'playing' || !song.playedAt || !song.length) {
        return 0;
    }
    
    const now = new Date();
    const playedAt = song.playedAt instanceof Date ? song.playedAt : new Date(song.playedAt);
    const elapsedSeconds = Math.floor((now - playedAt) / 1000);
    const totalSeconds = song.length || song.duration || 0;
    
    // Return progress in seconds (elapsed)
    return Math.max(0, Math.min(elapsedSeconds, totalSeconds));
}

// Periodic check to remove finished songs
async function checkFinishedSongs() {
    if (!db) return;
    
    try {
        const tracklistCollection = db.collection('tracklist');
        const playingSongs = await tracklistCollection.find({ status: 'playing' }).toArray();
        
        for (const song of playingSongs) {
            if (!song.playedAt || !song.length) continue;
            
            const progress = calculateProgress(song);
            
            // If song has finished playing, remove it
            if (progress >= song.length) {
                console.log(`🎵 Song finished: ${song.title}, removing from tracklist`);
                await tracklistCollection.deleteOne({ _id: song._id });
                
                // Start next queued song if available
                const nextSong = await tracklistCollection.findOne(
                    { status: 'queued' },
                    { sort: { priority: 1, createdAt: 1 } }
                );
                
                if (nextSong) {
                    await tracklistCollection.updateOne(
                        { _id: nextSong._id },
                        { $set: { status: 'playing', playedAt: new Date() } }
                    );
                    console.log(`▶️ Started next song: ${nextSong.title}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error checking finished songs:', error);
    }
}

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
    try {
        mongoClient = await createMongoClient(PRIMARY_MONGODB_URI);
        console.log('✅ Connected to MongoDB (primary URI)');
    } catch (error) {
        console.error('⚠️  MongoDB connection failed for primary URI:', error?.message || error);

        // If DNS SRV error and no explicit fallback, try to auto-convert SRV to direct
        let fallbackUri = FALLBACK_MONGODB_URI;
        if (!fallbackUri && isDnsSrvError(error) && PRIMARY_MONGODB_URI.startsWith('mongodb+srv://')) {
            console.log('🔄 Attempting to convert SRV URI to direct connection...');
            fallbackUri = convertSrvToDirect(PRIMARY_MONGODB_URI);
            if (fallbackUri) {
                console.log('   Using auto-generated direct connection URI');
            }
        }

        if (!fallbackUri) {
            if (isDnsSrvError(error)) {
                console.error('❌ DNS SRV lookups appear blocked. Could not auto-convert to direct connection.');
            } else {
                console.error('❌ MongoDB connection failed and no fallback URI available.');
            }
            process.exit(1);
        }

        try {
            const fallbackOptions = fallbackUri.startsWith('mongodb://')
                ? { directConnection: true }
                : {};
            mongoClient = await createMongoClient(fallbackUri, fallbackOptions);
            console.log('✅ Connected to MongoDB (fallback URI)');
        } catch (fallbackError) {
            console.error('❌ MongoDB connection failed for fallback URI as well:', fallbackError?.message || fallbackError);
            process.exit(1);
        }
    }

    db = mongoClient.db('jukebox');
    
    // Start periodic check for finished songs (every second)
    setInterval(checkFinishedSongs, 1000);
    console.log('⏱️  Started progress tracking for finished songs');
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
        
        // Add progress for playing songs
        const tracklistWithProgress = tracklist.map(song => {
            if (song.status === 'playing') {
                const progress = calculateProgress(song);
                return {
                    ...song,
                    progress: progress,
                    progressPercent: song.length ? (progress / song.length) * 100 : 0
                };
            }
            return song;
        });
        
        console.log(`📋 Fetched ${tracklist.length} tracklist entries`);
        res.json(tracklistWithProgress);
    } catch (error) {
        console.error('Error fetching tracklist:', error);
        res.status(500).json({ error: 'Failed to fetch tracklist' });
    }
});

// Add song to tracklist
app.post('/api/tracklist', async (req, res) => {
    try {
        const { songId, title, artist, album, duration, priority, requestedBy, masterId, slaveId, existsAtMaster, length } = req.body;
        
        // Check if this song already exists in the tracklist
        const existingSong = await db.collection('tracklist').findOne({
            songId: songId,
            status: { $in: ['queued', 'playing'] } // Only check active songs
        });
        
        if (existingSong) {
            console.log(`⚠️ Song already exists in tracklist: ${title} (ID: ${existingSong._id})`);
            return res.json({ 
                success: true, 
                id: existingSong._id, 
                message: 'Song already in tracklist',
                existing: true
            });
        }
        
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

// Get albums configuration
app.get('/api/config/albums', (req, res) => {
    try {
        const config = {
            albumsFolderPath: process.env.ALBUMS_FOLDER_PATH || '/home/arcade/Desktop/jukeboxshare/Jukebox songs',
            coverFileName: process.env.COVER_FILE_NAME || 'cover'
        };
        
        // Add debug info
        const debugInfo = {
            ...config,
            folderExists: existsSync(config.albumsFolderPath),
            folderContents: existsSync(config.albumsFolderPath) ? 
                readdirSync(config.albumsFolderPath).slice(0, 5) : []
        };
        
        res.json(debugInfo);
    } catch (error) {
        console.error('Error getting albums config:', error);
        res.status(500).json({ error: 'Failed to get albums configuration' });
    }
});

// Update albums configuration
app.post('/api/config/albums', (req, res) => {
    try {
        const { albumsFolderPath, coverFileName } = req.body;
        
        // Update environment variables
        if (albumsFolderPath) {
            process.env.ALBUMS_FOLDER_PATH = albumsFolderPath;
        }
        if (coverFileName) {
            process.env.COVER_FILE_NAME = coverFileName;
        }
        
        // Save to config file for persistence
        const config = {
            albumsFolderPath: process.env.ALBUMS_FOLDER_PATH,
            coverFileName: process.env.COVER_FILE_NAME,
            updatedAt: new Date().toISOString()
        };
        
        const configPath = join(__dirname, 'albums-config.json');
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(`📁 Albums folder path updated to: ${albumsFolderPath}`);
        console.log(`🖼️ Cover file name updated to: ${coverFileName}`);
        console.log(`💾 Config saved to: ${configPath}`);
        
        res.json({ 
            success: true, 
            message: 'Albums configuration updated successfully',
            config: {
                albumsFolderPath: process.env.ALBUMS_FOLDER_PATH,
                coverFileName: process.env.COVER_FILE_NAME
            }
        });
    } catch (error) {
        console.error('Error updating albums config:', error);
        res.status(500).json({ error: 'Failed to update albums configuration' });
    }
});

// Get user configuration
app.get('/api/config/user', (req, res) => {
    try {
        const config = {
            songCooldown: process.env.SONG_COOLDOWN || 3
        };
        res.json(config);
    } catch (error) {
        console.error('Error getting user config:', error);
        res.status(500).json({ error: 'Failed to get user configuration' });
    }
});

// Update user configuration
app.post('/api/config/user', (req, res) => {
    try {
        const { songCooldown } = req.body;
        
        // Update environment variable
        if (songCooldown) {
            process.env.SONG_COOLDOWN = songCooldown.toString();
        }
        
        // Save to config file for persistence
        const config = {
            songCooldown: process.env.SONG_COOLDOWN || 3,
            updatedAt: new Date().toISOString()
        };
        
        const configPath = join(__dirname, 'user-config.json');
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(`⏱️ Song cooldown updated to: ${songCooldown} seconds`);
        console.log(`💾 User config saved to: ${configPath}`);
        
        res.json({ 
            success: true, 
            message: 'User configuration updated successfully',
            config: {
                songCooldown: process.env.SONG_COOLDOWN || 3
            }
        });
    } catch (error) {
        console.error('Error updating user config:', error);
        res.status(500).json({ error: 'Failed to update user configuration' });
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

// Serve album covers
app.get('/api/covers/:albumTitle', async (req, res) => {
    try {
        const albumTitle = decodeURIComponent(req.params.albumTitle);
        
        // Get albums folder path from environment or default
        const albumsFolderPath = process.env.ALBUMS_FOLDER_PATH || '/home/arcade/Desktop/jukeboxshare/Jukebox songs';
        const coverFileName = process.env.COVER_FILE_NAME || 'cover';
        
        console.log(`🔍 Looking for cover: ${albumTitle}`);
        console.log(`📁 Albums folder: ${albumsFolderPath}`);
        console.log(`🖼️ Cover file name: ${coverFileName}`);
        
        // Supported image extensions
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        
        // Try to find the cover image
        let coverPath = null;
        
        // First try the exact album title
        for (const ext of extensions) {
            const testPath = join(albumsFolderPath, albumTitle, `${coverFileName}.${ext}`);
            console.log(`🔍 Checking: ${testPath}`);
            if (existsSync(testPath)) {
                coverPath = testPath;
                console.log(`✅ Found cover: ${coverPath}`);
                break;
            }
        }
        
        // If not found, try common variations for cleaned album names
        if (!coverPath) {
            console.log(`🔍 Trying variations for cleaned album name: ${albumTitle}`);
            
            // Get all albums from database to find the original name
            try {
                if (db) {
                    const albumsCollection = db.collection('albums');
                    const albumDoc = await albumsCollection.findOne({ title: albumTitle });
                    
                    if (albumDoc && albumDoc.artist) {
                        // Try "Artist - Album Title" format
                        const originalFormat = `${albumDoc.artist} - ${albumTitle}`;
                        console.log(`🔍 Trying original format: ${originalFormat}`);
                        
                        for (const ext of extensions) {
                            const testPath = join(albumsFolderPath, originalFormat, `${coverFileName}.${ext}`);
                            console.log(`🔍 Checking: ${testPath}`);
                            if (existsSync(testPath)) {
                                coverPath = testPath;
                                console.log(`✅ Found cover with original format: ${coverPath}`);
                                break;
                            }
                        }
                    }
                    
                    // If still not found, try AC-DC specific variations
                    if (!coverPath && albumDoc && albumDoc.artist === 'AC/DC') {
                        const acdcFormat = `AC-DC ${albumTitle}`;
                        console.log(`🔍 Trying AC-DC format: ${acdcFormat}`);
                        
                        for (const ext of extensions) {
                            const testPath = join(albumsFolderPath, acdcFormat, `${coverFileName}.${ext}`);
                            console.log(`🔍 Checking: ${testPath}`);
                            if (existsSync(testPath)) {
                                coverPath = testPath;
                                console.log(`✅ Found cover with AC-DC format: ${coverPath}`);
                                break;
                            }
                        }
                    }
                }
            } catch (dbError) {
                console.log('Error querying database for album variations:', dbError);
            }
        }
        
        if (!coverPath) {
            console.log(`❌ No cover found for: ${albumTitle}`);
            // List what's actually in the albums folder for debugging
            try {
                const albumsDir = albumsFolderPath;
                if (existsSync(albumsDir)) {
                    const dirContents = readdirSync(albumsDir);
                    console.log(`📂 Albums directory contents:`, dirContents.slice(0, 10)); // Show first 10 items
                    
                    // Look for folders that might contain the album
                    const matchingFolders = dirContents.filter(folder => 
                        folder.toLowerCase().includes(albumTitle.toLowerCase()) ||
                        albumTitle.toLowerCase().includes(folder.toLowerCase())
                    );
                    if (matchingFolders.length > 0) {
                        console.log(`🔍 Potential matching folders:`, matchingFolders);
                    }
                } else {
                    console.log(`❌ Albums directory does not exist: ${albumsDir}`);
                }
            } catch (debugError) {
                console.log('Debug error:', debugError);
            }
            
            res.status(404).json({ error: 'Cover not found' });
            return;
        }
        
        // Determine content type
        const ext = extname(coverPath).toLowerCase().substring(1);
        const contentType = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }[ext] || 'image/jpeg';
        
        // Serve the image
        const imageBuffer = readFileSync(coverPath);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.send(imageBuffer);
        
        console.log(`🖼️ Served cover for album: ${albumTitle}`);
    } catch (error) {
        console.error('Error serving album cover:', error);
        res.status(500).json({ error: 'Failed to serve album cover' });
    }
});

// Serve other static files (must be after API routes)
app.get('/*', (req, res) => {
    const filePath = join(__dirname, req.path);
    const ext = extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    console.log('Serving static file:', req.path, '->', filePath);
    
    if (existsSync(filePath)) {
        try {
            const content = readFileSync(filePath);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(content);
        } catch (error) {
            console.error('Error reading file:', filePath, error);
            res.status(500).send('Error reading file');
        }
    } else {
        console.log('File not found:', filePath);
        res.status(404).send('File not found');
    }
});

// Start server
async function startServer() {
    loadAlbumsConfig();
    await connectToMongoDB();
    
    // Check if SSL certificates are available
    const hasSSL = SSL_OPTIONS.key && SSL_OPTIONS.cert;
    
    if (hasSSL) {
        console.log('🔒 SSL certificates found, starting HTTPS server...');
        
        // Start HTTPS server
        const httpsServer = https.createServer(SSL_OPTIONS, app);
        httpsServer.listen(HTTPS_PORT, () => {
            console.log(`🚀 HTTPS Server running on https://localhost:${HTTPS_PORT}`);
            console.log(`🌐 Public access: https://jukebox.8bitbar.com.au`);
            console.log(`📡 Available endpoints:`);
            console.log(`   GET  /api/albums - Get all albums`);
            console.log(`   GET  /api/songs - Get all songs`);
            console.log(`   GET  /api/songs/album/:title - Get songs by album`);
            console.log(`   GET  /api/tracklist - Get tracklist`);
            console.log(`   POST /api/tracklist - Add song to tracklist`);
            console.log(`   GET  /api/search?q=query - Search songs/albums`);
            console.log(`   GET  /api/health - Health check`);
        }).on('error', (err) => {
            console.error(`❌ HTTPS Server error:`, err.message);
            if (err.code === 'EADDRINUSE') {
                console.error(`   Port ${HTTPS_PORT} is already in use.`);
            }
            process.exit(1);
        });
        
        // Also start HTTP server for redirects (optional)
        const httpServer = http.createServer((req, res) => {
            res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
            res.end();
        });
        
        httpServer.listen(HTTP_PORT, () => {
            console.log(`🔄 HTTP Server running on http://localhost:${HTTP_PORT} (redirects to HTTPS)`);
        });
        
    } else {
        console.log('⚠️  No SSL certificates found, starting HTTP server...');
        console.log('   Set SSL_KEY_PATH and SSL_CERT_PATH environment variables for HTTPS');
        
        // Start HTTP server
        app.listen(HTTP_PORT, () => {
            console.log(`🚀 HTTP Server running on http://localhost:${HTTP_PORT}`);
            console.log(`🌐 Public access: http://jukebox.8bitbar.com.au`);
            console.log(`📡 Available endpoints:`);
            console.log(`   GET  /api/albums - Get all albums`);
            console.log(`   GET  /api/songs - Get all songs`);
            console.log(`   GET  /api/songs/album/:title - Get songs by album`);
            console.log(`   GET  /api/tracklist - Get tracklist`);
            console.log(`   POST /api/tracklist - Add song to tracklist`);
            console.log(`   GET  /api/search?q=query - Search songs/albums`);
            console.log(`   GET  /api/health - Health check`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${HTTP_PORT} is already in use.`);
                console.error(`   Try a different port or stop the process using port ${HTTP_PORT}.`);
                if (HTTP_PORT === 80) {
                    console.error(`   Port 80 requires administrator privileges on Windows.`);
                    console.error(`   Use start-jukebox-dev.bat for testing on port 3000.`);
                }
            } else {
                console.error(`❌ Server error:`, err.message);
            }
            process.exit(1);
        });
    }
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down API server...');
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