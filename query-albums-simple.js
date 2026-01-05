#!/usr/bin/env node

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

async function queryAlbums() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('jukebox');
        const albumsCollection = db.collection('albums');
        const songsCollection = db.collection('songs');
        
        console.log('\n📀 Querying Albums Database...\n');
        
        // Get total count
        const totalAlbums = await albumsCollection.countDocuments();
        console.log(`📊 Total Albums: ${totalAlbums}`);
        
        if (totalAlbums === 0) {
            console.log('❌ No albums found in database');
            return;
        }
        
        // Get all albums sorted by title
        const albums = await albumsCollection.find({}).sort({ title: 1 }).toArray();
        
        console.log('\n📀 Albums in database (raw MongoDB format):');
        console.log('─'.repeat(80));
        
        for (let i = 0; i < albums.length; i++) {
            const album = albums[i];
            const songCount = await songsCollection.countDocuments({ album: album.title });
            
            // Show raw MongoDB document
            console.log(`\n${i + 1}. Album Document:`);
            console.log(JSON.stringify(album, null, 2));
            console.log(`   Songs in database: ${songCount}`);
        }
        
        // Show statistics
        console.log('\n📊 Statistics:');
        console.log('─'.repeat(80));
        
        const albumsWithSongs = albums.filter(async (album) => {
            const count = await songsCollection.countDocuments({ album: album.title });
            return count > 0;
        });
        
        const totalSongs = await songsCollection.countDocuments();
        console.log(`Total Albums: ${totalAlbums}`);
        console.log(`Albums with songs: ${albums.length}`); // This is approximate
        console.log(`Total Songs: ${totalSongs}`);
        
        // Show top albums by song count
        console.log('\n🏆 Top 10 Albums by Song Count:');
        console.log('─'.repeat(80));
        
        const albumStats = [];
        for (const album of albums) {
            const count = await songsCollection.countDocuments({ album: album.title });
            albumStats.push({ title: album.title, count });
        }
        
        albumStats.sort((a, b) => b.count - a.count);
        
        for (let i = 0; i < Math.min(10, albumStats.length); i++) {
            const stat = albumStats[i];
            console.log(`${String(i + 1).padStart(2)}. "${stat.title}" - ${stat.count} songs`);
        }
        
        // Show albums with 0 songs
        console.log('\n⚠️  Albums with 0 songs:');
        console.log('─'.repeat(80));
        
        let albumsWithNoSongs = 0;
        for (const album of albums) {
            const count = await songsCollection.countDocuments({ album: album.title });
            if (count === 0) {
                console.log(`   - "${album.title}"`);
                albumsWithNoSongs++;
            }
        }
        
        if (albumsWithNoSongs === 0) {
            console.log('   ✓ All albums have songs');
        } else {
            console.log(`\n   Total albums with 0 songs: ${albumsWithNoSongs}`);
        }
        
    } catch (error) {
        console.error('❌ Error querying albums:', error);
    } finally {
        await client.close();
        console.log('\n✅ Query complete');
    }
}

queryAlbums().catch(console.error);

