#!/usr/bin/env node

import { MongoClient } from 'mongodb';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';

async function checkAlbumsFields() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB\n');
        
        const db = client.db(DATABASE_NAME);
        const albumsCollection = db.collection('albums');
        
        // Get all albums
        const albums = await albumsCollection.find({}).sort({ title: 1 }).toArray();
        
        console.log(`📀 Found ${albums.length} albums\n`);
        console.log('='.repeat(80));
        
        let albumsWithCreatedAt = 0;
        let albumsWithUpdatedAt = 0;
        let albumsWithExtraFields = 0;
        
        for (const album of albums) {
            const fields = Object.keys(album);
            const hasCreatedAt = fields.includes('createdAt');
            const hasUpdatedAt = fields.includes('updatedAt');
            const extraFields = fields.filter(f => !['_id', 'title', 'artist'].includes(f));
            
            if (hasCreatedAt) albumsWithCreatedAt++;
            if (hasUpdatedAt) albumsWithUpdatedAt++;
            if (extraFields.length > 0) albumsWithExtraFields++;
            
            // Show all albums, highlight problematic ones
            if (hasCreatedAt || hasUpdatedAt || extraFields.length > 0) {
                console.log(`\n📀 Album: "${album.title}" ⚠️`);
                console.log(`   ID: ${album._id}`);
                console.log(`   All fields: ${fields.join(', ')}`);
                console.log(`   Full document:`);
                console.log(JSON.stringify(album, null, 2));
                
                if (hasCreatedAt) {
                    console.log(`   ⚠️  HAS createdAt: ${album.createdAt}`);
                }
                if (hasUpdatedAt) {
                    console.log(`   ⚠️  HAS updatedAt: ${album.updatedAt}`);
                }
                if (extraFields.length > 0) {
                    console.log(`   ⚠️  Extra fields: ${extraFields.join(', ')}`);
                }
            } else {
                console.log(`\n📀 Album: "${album.title}" ✅`);
                console.log(`   Fields: ${fields.join(', ')}`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total albums: ${albums.length}`);
        console.log(`Albums with createdAt: ${albumsWithCreatedAt}`);
        console.log(`Albums with updatedAt: ${albumsWithUpdatedAt}`);
        console.log(`Albums with extra fields: ${albumsWithExtraFields}`);
        
        // Also check songs
        const songsCollection = db.collection('songs');
        const allSongs = await songsCollection.find({}).toArray();
        const songs = allSongs.slice(0, 20); // Show first 20
        
        console.log('\n' + '='.repeat(80));
        console.log('SAMPLE SONGS (first 20)');
        console.log('='.repeat(80));
        
        let songsWithExtraFields = 0;
        
        for (const song of songs) {
            const fields = Object.keys(song);
            const expectedFields = ['_id', 'title', 'artist', 'album', 'familyFriendly'];
            const extraFields = fields.filter(f => !expectedFields.includes(f));
            
            if (extraFields.length > 0) {
                songsWithExtraFields++;
                console.log(`\n🎵 Song: "${song.title}" by ${song.artist} ⚠️`);
                console.log(`   Album: ${song.album}`);
                console.log(`   All fields: ${fields.join(', ')}`);
                console.log(`   Extra fields: ${extraFields.join(', ')}`);
                console.log(`   Full document:`);
                console.log(JSON.stringify(song, null, 2));
            } else {
                console.log(`\n🎵 Song: "${song.title}" by ${song.artist} ✅`);
                console.log(`   Fields: ${fields.join(', ')}`);
            }
        }
        
        // Check all songs for extra fields
        const songsWithCreatedAt = await songsCollection.countDocuments({ createdAt: { $exists: true } });
        const songsWithUpdatedAt = await songsCollection.countDocuments({ updatedAt: { $exists: true } });
        const songsWithTrack = await songsCollection.countDocuments({ track: { $exists: true } });
        const songsWithYear = await songsCollection.countDocuments({ year: { $exists: true } });
        const songsWithFilename = await songsCollection.countDocuments({ filename: { $exists: true } });
        
        console.log('\n' + '='.repeat(80));
        console.log('SONGS SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total songs: ${allSongs.length}`);
        console.log(`Songs with createdAt: ${songsWithCreatedAt}`);
        console.log(`Songs with updatedAt: ${songsWithUpdatedAt}`);
        console.log(`Songs with track: ${songsWithTrack}`);
        console.log(`Songs with year: ${songsWithYear}`);
        console.log(`Songs with filename: ${songsWithFilename}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 MongoDB connection closed');
        }
    }
}

checkAlbumsFields().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});

