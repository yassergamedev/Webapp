#!/usr/bin/env node

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';
const DRY_RUN = process.argv.includes('--dry-run');

function reverseTitle(title) {
    if (!title || typeof title !== 'string') return title;
    
    // Check if title matches pattern "Song Title - Artist Name"
    const match = title.match(/^(.+?)\s*-\s*(.+)$/);
    if (match) {
        const [, songTitle, artistName] = match;
        // Return reversed: "Artist Name - Song Title"
        return `${artistName.trim()} - ${songTitle.trim()}`;
    }
    
    return title; // No change if doesn't match pattern
}

async function main() {
    console.log('🔄 Reversing song titles in Pophits 00-24 albums...');
    if (DRY_RUN) console.log('🧪 Dry run mode enabled (no DB writes)');
    
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(DATABASE_NAME);
        console.log('✅ Connected to MongoDB');
        
        const songsCol = db.collection('songs');
        
        // Find all Pophits 00-24 Vol* albums dynamically
        const albumsCol = db.collection('albums');
        const pophitsAlbums = await albumsCol.find({ 
            title: { $regex: /^Pophits 00-24 Vol\d+$/i } 
        }).toArray();
        
        if (pophitsAlbums.length === 0) {
            console.log('⚠️  No Pophits 00-24 Vol* albums found');
            return;
        }
        
        console.log(`📀 Found ${pophitsAlbums.length} Pophits albums to process`);
        
        let totalUpdated = 0;
        
        for (const album of pophitsAlbums) {
            const albumTitle = album.title;
            console.log(`\n📀 Processing album: ${albumTitle}`);
            const songs = await songsCol.find({ album: albumTitle }).toArray();
            console.log(`   Found ${songs.length} songs`);
            
            for (const song of songs) {
                const originalTitle = song.title;
                const reversedTitle = reverseTitle(originalTitle);
                
                if (originalTitle !== reversedTitle) {
                    console.log(`   ↻ "${originalTitle}" → "${reversedTitle}"`);
                    
                    if (!DRY_RUN) {
                        const result = await songsCol.updateOne(
                            { _id: song._id },
                            { $set: { title: reversedTitle } }
                        );
                        
                        if (result.modifiedCount === 1) {
                            totalUpdated++;
                        } else {
                            console.log(`   ⚠️ Failed to update: "${originalTitle}"`);
                        }
                    } else {
                        totalUpdated++;
                    }
                }
            }
        }
        
        console.log(`\n✅ Complete! ${totalUpdated} song titles reversed${DRY_RUN ? ' (dry run)' : ''}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

main().catch(console.error);

