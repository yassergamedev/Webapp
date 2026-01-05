#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

async function fixAlbumsFromList() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('jukebox');
        
        // Read albums_list.txt
        console.log('📖 Reading albums_list.txt...');
        const content = readFileSync('./albums_list.txt', 'utf8');
        const lines = content.split('\n');
        
        // Parse albums from the file
        const albumsFromFile = [];
        let currentAlbum = null;
        
        for (const line of lines) {
            if (line.startsWith('Album:')) {
                if (currentAlbum) {
                    albumsFromFile.push(currentAlbum);
                }
                const albumName = line.replace('Album:', '').trim();
                currentAlbum = {
                    name: albumName,
                    songs: []
                };
            } else if (currentAlbum && line.trim() && line.match(/\.mp3$/)) {
                currentAlbum.songs.push(line.trim());
            }
        }
        
        if (currentAlbum) {
            albumsFromFile.push(currentAlbum);
        }
        
        console.log(`✅ Found ${albumsFromFile.length} albums in albums_list.txt\n`);
        
        // Now fix the database
        console.log('🔧 Fixing database...\n');
        
        const albumsCollection = db.collection('albums');
        const songsCollection = db.collection('songs');
        
        // Step 1: Remove all existing albums and recreate them from the list
        console.log('1️⃣  Removing all existing albums...');
        await albumsCollection.deleteMany({});
        console.log('   ✓ All albums removed\n');
        
        // Step 2: Create new albums from the file
        console.log('2️⃣  Creating albums from albums_list.txt...');
        
        for (let i = 0; i < albumsFromFile.length; i++) {
            const album = albumsFromFile[i];
            
            // Extract artist from album name if present (format: "Artist - Album Title")
            let artist = null;
            let title = album.name;
            
            const match = album.name.match(/^(.+?)\s*-\s*(.+)$/);
            if (match) {
                artist = match[1].trim();
                title = match[2].trim();
            } else if (album.name.startsWith('AC-DC ')) {
                // Special handling for AC-DC albums
                artist = 'AC/DC';
                title = album.name.replace(/^AC-DC\s+/, '');
            }
            
            const albumDoc = {
                title: album.name,  // Keep full name like "AC-DC Best Of CD1"
                artist: artist || null
            };
            
            await albumsCollection.insertOne(albumDoc);
            console.log(`   ✓ Created: "${album.name}" (${album.songs.length} songs)`);
        }
        
        console.log(`\n   ✅ Created ${albumsFromFile.length} albums\n`);
        
        // Step 3: Update songs to match the album names from the file
        console.log('3️⃣  Updating song album references...');
        
        let totalSongsUpdated = 0;
        
        for (const album of albumsFromFile) {
            // For each song in this album from the file, try to find it in the database
            for (const songFileLine of album.songs) {
                // Extract song info from the file line
                // Format: "01 - Song Title - Artist.mp3"
                const match = songFileLine.match(/^\s*\d+\s*-\s*(.+?)\s*-\s*(.+?)\.mp3$/);
                
                if (match) {
                    const songTitle = match[1].trim();
                    const songArtist = match[2].trim();
                    
                    // Try to find this song in the database by title
                    const songs = await songsCollection.find({
                        title: new RegExp(songTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    }).toArray();
                    
                    // Update all matching songs to point to the correct album
                    for (const song of songs) {
                        if (song.album !== album.name) {
                            await songsCollection.updateOne(
                                { _id: song._id },
                                { $set: { album: album.name } }
                            );
                            totalSongsUpdated++;
                        }
                    }
                }
            }
        }
        
        console.log(`   ✅ Updated ${totalSongsUpdated} song references\n`);
        
        // Step 4: Show results
        console.log('4️⃣  Final album count and statistics...\n');
        
        const finalAlbums = await albumsCollection.find({}).sort({ title: 1 }).toArray();
        
        for (const album of finalAlbums) {
            const songCount = await songsCollection.countDocuments({ album: album.title });
            const artistStr = album.artist ? ` | Artist: ${album.artist}` : '';
            console.log(`   - "${album.title}"${artistStr} | Songs in DB: ${songCount}`);
        }
        
        console.log(`\n✅ Done! Total albums: ${finalAlbums.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

fixAlbumsFromList().catch(console.error);

