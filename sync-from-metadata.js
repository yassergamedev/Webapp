#!/usr/bin/env node

import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';
const METADATA_FILE = process.argv[2] || './album-metadata.txt';
const DRY_RUN = process.argv.includes('--dry-run');

// Parse album metadata from text file
function parseMetadataFile(content) {
    const albums = [];
    const lines = content.split('\n');
    let currentAlbum = null;
    let currentSong = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Album header
        if (line.startsWith('📀 ALBUM:')) {
            if (currentAlbum && currentAlbum.songs.length > 0) {
                albums.push(currentAlbum);
            }
            const albumName = line.replace('📀 ALBUM:', '').trim();
            currentAlbum = {
                title: albumName,
                songs: []
            };
            continue;
        }
        
        // Song entry (format: "1. Artist - Title")
        if (line.match(/^\d+\.\s+.+?\s+-\s+.+$/)) {
            const match = line.match(/^\d+\.\s+(.+?)\s+-\s+(.+)$/);
            if (match && currentAlbum) {
                const [, artist, title] = match;
                currentSong = {
                    artist: artist.trim(),
                    title: title.trim()
                };
                currentAlbum.songs.push(currentSong);
            }
            continue;
        }
        
        
    }
    
    // Add last album
    if (currentAlbum && currentAlbum.songs.length > 0) {
        albums.push(currentAlbum);
    }
    
    return albums;
}

// Extract artist from album name if present (e.g., "Artist - Album Name")
function extractArtistFromAlbumName(albumName) {
    const dashIndex = albumName.indexOf(' - ');
    if (dashIndex !== -1) {
        return albumName.substring(0, dashIndex).trim();
    }
    
    // Special case for AC-DC
    if (/^AC-DC\b/i.test(albumName)) {
        return 'AC';
    }
    
    return null;
}

async function syncToMongoDB() {
    let client;
    
    try {
        console.log('📖 Reading metadata file...');
        const metadataContent = readFileSync(METADATA_FILE, 'utf8');
        const albums = parseMetadataFile(metadataContent);
        console.log(`✅ Parsed ${albums.length} albums from metadata file`);
        
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DATABASE_NAME);
        const albumsCollection = db.collection('albums');
        const songsCollection = db.collection('songs');
        
        let albumsCreated = 0;
        let albumsUpdated = 0;
        let songsCreated = 0;
        let songsUpdated = 0;
        let songsDeleted = 0;
        
        for (const albumData of albums) {
            const albumTitle = albumData.title;
            const albumArtist = extractArtistFromAlbumName(albumTitle);
            
            console.log(`\n📀 Processing album: ${albumTitle}`);
            console.log(`   Songs in metadata: ${albumData.songs.length}`);
            
            // Find or create album
            let album = await albumsCollection.findOne({ title: albumTitle });
            let oldAlbumTitle = null;
            
            if (!album) {
                // Check for similar album names (e.g., "24 Vol1" vs "Pophits 00-24 Vol1")
                const normalizedTitle = albumTitle.toLowerCase().replace(/^pophits\s*00-?/i, '').trim();
                album = await albumsCollection.findOne({
                    $or: [
                        { title: { $regex: new RegExp(`^${normalizedTitle}$`, 'i') } },
                        { title: { $regex: new RegExp(normalizedTitle.replace(/^24\s*vol/i, '24 vol'), 'i') } }
                    ]
                });
                
                if (album) {
                    oldAlbumTitle = album.title;
                    console.log(`   ⚠️  Found similar album: "${album.title}", will update to "${albumTitle}"`);
                }
            }
            
            const albumUpdate = {
                title: albumTitle
            };
            if (albumArtist) {
                albumUpdate.artist = albumArtist;
            }
            
            if (!album) {
                if (!DRY_RUN) {
                    const result = await albumsCollection.insertOne(albumUpdate);
                    album = { _id: result.insertedId, ...albumUpdate };
                    albumsCreated++;
                    console.log(`   ✅ Created album`);
                } else {
                    console.log(`   [DRY RUN] Would create album`);
                    albumsCreated++;
                }
            } else {
                if (!DRY_RUN) {
                    // Only update title and artist, preserve other fields, remove updatedAt and createdAt if they exist
                    const updateDoc = { 
                        $set: albumUpdate,
                        $unset: { updatedAt: "", createdAt: "" }
                    };
                    await albumsCollection.updateOne(
                        { _id: album._id },
                        updateDoc
                    );
                    
                    // If album title changed, update all songs to use new album title
                    if (oldAlbumTitle && oldAlbumTitle !== albumTitle) {
                        await songsCollection.updateMany(
                            { album: oldAlbumTitle },
                            { $set: { album: albumTitle }, $unset: { updatedAt: "" } }
                        );
                        console.log(`   ✅ Updated ${oldAlbumTitle} songs to use new album title`);
                    }
                    
                    albumsUpdated++;
                    console.log(`   ✅ Updated album`);
                } else {
                    console.log(`   [DRY RUN] Would update album`);
                    albumsUpdated++;
                }
            }
            
            // Get existing songs for this album (use new title)
            const existingSongs = await songsCollection.find({ album: albumTitle }).toArray();
            const existingSongsMap = new Map();
            existingSongs.forEach(song => {
                const key = `${song.artist || ''}|${song.title || ''}`.toLowerCase();
                existingSongsMap.set(key, song);
            });
            
            // Process songs from metadata
            const processedSongs = new Set();
            
            for (const songData of albumData.songs) {
                const songKey = `${songData.artist}|${songData.title}`.toLowerCase();
                processedSongs.add(songKey);
                
                const existingSong = existingSongsMap.get(songKey);
                
                const songDoc = {
                    album: albumTitle,
                    artist: songData.artist,
                    title: songData.title,
                    familyFriendly: true
                };
                
                if (!existingSong) {
                    if (!DRY_RUN) {
                        await songsCollection.insertOne(songDoc);
                        songsCreated++;
                    } else {
                        console.log(`   [DRY RUN] Would create song: ${songData.artist} - ${songData.title}`);
                        songsCreated++;
                    }
                } else {
                    if (!DRY_RUN) {
                        await songsCollection.updateOne(
                            { _id: existingSong._id },
                            { 
                                $set: songDoc,
                                $unset: { updatedAt: "", track: "", year: "", filename: "" }
                            }
                        );
                        songsUpdated++;
                    } else {
                        console.log(`   [DRY RUN] Would update song: ${songData.artist} - ${songData.title}`);
                        songsUpdated++;
                    }
                }
            }
            
            // Delete songs that are in MongoDB but not in metadata
            for (const existingSong of existingSongs) {
                const songKey = `${existingSong.artist || ''}|${existingSong.title || ''}`.toLowerCase();
                if (!processedSongs.has(songKey)) {
                    if (!DRY_RUN) {
                        await songsCollection.deleteOne({ _id: existingSong._id });
                        songsDeleted++;
                        console.log(`   🗑️  Deleted song: ${existingSong.artist} - ${existingSong.title}`);
                    } else {
                        console.log(`   [DRY RUN] Would delete song: ${existingSong.artist} - ${existingSong.title}`);
                        songsDeleted++;
                    }
                }
            }
        }
        
        // Clean up any unwanted fields from all albums and songs
        if (!DRY_RUN) {
            console.log('\n🧹 Cleaning up unwanted fields...');
            const albumsCleanedUpdated = await albumsCollection.updateMany(
                { updatedAt: { $exists: true } },
                { $unset: { updatedAt: "" } }
            );
            const albumsCleanedCreated = await albumsCollection.updateMany(
                { createdAt: { $exists: true } },
                { $unset: { createdAt: "" } }
            );
            const songsCleanedUpdated = await songsCollection.updateMany(
                { updatedAt: { $exists: true } },
                { $unset: { updatedAt: "" } }
            );
            const songsCleanedTrack = await songsCollection.updateMany(
                { track: { $exists: true } },
                { $unset: { track: "" } }
            );
            const songsCleanedYear = await songsCollection.updateMany(
                { year: { $exists: true } },
                { $unset: { year: "" } }
            );
            const songsCleanedFilename = await songsCollection.updateMany(
                { filename: { $exists: true } },
                { $unset: { filename: "" } }
            );
            if (albumsCleanedUpdated.modifiedCount > 0) {
                console.log(`   ✅ Removed updatedAt from ${albumsCleanedUpdated.modifiedCount} albums`);
            }
            if (albumsCleanedCreated.modifiedCount > 0) {
                console.log(`   ✅ Removed createdAt from ${albumsCleanedCreated.modifiedCount} albums`);
            }
            if (songsCleanedUpdated.modifiedCount > 0) {
                console.log(`   ✅ Removed updatedAt from ${songsCleanedUpdated.modifiedCount} songs`);
            }
            if (songsCleanedTrack.modifiedCount > 0) {
                console.log(`   ✅ Removed track from ${songsCleanedTrack.modifiedCount} songs`);
            }
            if (songsCleanedYear.modifiedCount > 0) {
                console.log(`   ✅ Removed year from ${songsCleanedYear.modifiedCount} songs`);
            }
            if (songsCleanedFilename.modifiedCount > 0) {
                console.log(`   ✅ Removed filename from ${songsCleanedFilename.modifiedCount} songs`);
            }
        }
        
        // Delete albums that are in MongoDB but not in metadata
        const allMongoAlbums = await albumsCollection.find({}).toArray();
        const metadataAlbumTitles = new Set(albums.map(a => a.title));
        
        for (const mongoAlbum of allMongoAlbums) {
            // Check if album exists in metadata (with normalization)
            let found = metadataAlbumTitles.has(mongoAlbum.title);
            
            if (!found) {
                // Try normalized matching
                const normalizedMongo = mongoAlbum.title.toLowerCase().replace(/^pophits\s*00-?/i, '').trim();
                found = Array.from(metadataAlbumTitles).some(title => {
                    const normalizedMeta = title.toLowerCase().replace(/^pophits\s*00-?/i, '').trim();
                    return normalizedMongo === normalizedMeta;
                });
            }
            
            if (!found) {
                // Delete album and its songs
                const albumSongs = await songsCollection.find({ album: mongoAlbum.title }).toArray();
                if (!DRY_RUN) {
                    await songsCollection.deleteMany({ album: mongoAlbum.title });
                    await albumsCollection.deleteOne({ _id: mongoAlbum._id });
                    console.log(`\n🗑️  Deleted album: ${mongoAlbum.title} (${albumSongs.length} songs)`);
                } else {
                    console.log(`\n[DRY RUN] Would delete album: ${mongoAlbum.title} (${albumSongs.length} songs)`);
                }
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('SYNC SUMMARY');
        console.log('='.repeat(80));
        console.log(`Albums created: ${albumsCreated}`);
        console.log(`Albums updated: ${albumsUpdated}`);
        console.log(`Songs created: ${songsCreated}`);
        console.log(`Songs updated: ${songsUpdated}`);
        console.log(`Songs deleted: ${songsDeleted}`);
        
        if (DRY_RUN) {
            console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
        } else {
            console.log('\n✅ Sync completed successfully!');
        }
        
    } catch (error) {
        console.error('❌ Error syncing data:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 MongoDB connection closed');
        }
    }
}

syncToMongoDB().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});

