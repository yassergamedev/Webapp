#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { writeFileSync } from 'fs';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';
const OUTPUT_FILE = process.argv[2] || process.env.OUTPUT_FILE || './mongodb-export.txt';

async function exportMongoDBData() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DATABASE_NAME);
        
        // Get albums
        console.log('📀 Fetching albums...');
        const albums = await db.collection('albums').find({}).sort({ title: 1 }).toArray();
        console.log(`   Found ${albums.length} album(s)`);
        
        // Get songs
        console.log('🎵 Fetching songs...');
        const songs = await db.collection('songs').find({}).sort({ album: 1, track: 1 }).toArray();
        console.log(`   Found ${songs.length} song(s)`);
        
        // Group songs by album
        const songsByAlbum = {};
        for (const song of songs) {
            const albumTitle = song.album || 'Unknown Album';
            if (!songsByAlbum[albumTitle]) {
                songsByAlbum[albumTitle] = [];
            }
            songsByAlbum[albumTitle].push(song);
        }
        
        // Format output
        let output = '';
        output += '='.repeat(80) + '\n';
        output += 'MONGODB DATA EXPORT\n';
        output += `Generated: ${new Date().toISOString()}\n`;
        output += `Database: ${DATABASE_NAME}\n`;
        output += `Total Albums: ${albums.length}\n`;
        output += `Total Songs: ${songs.length}\n`;
        output += '='.repeat(80) + '\n\n';
        
        // Export albums section
        output += '\n' + '='.repeat(80) + '\n';
        output += 'ALBUMS\n';
        output += '='.repeat(80) + '\n\n';
        
        for (const album of albums) {
            output += `📀 ALBUM: ${album.title || 'Unknown'}\n`;
            if (album.artist) {
                output += `   Artist: ${album.artist}\n`;
            }
            if (album.year) {
                output += `   Year: ${album.year}\n`;
            }
            if (album.coverPath) {
                output += `   Cover: ${album.coverPath}\n`;
            }
            if (album.path) {
                output += `   Path: ${album.path}\n`;
            }
            if (album._id) {
                output += `   ID: ${album._id}\n`;
            }
            output += '\n';
        }
        
        // Export songs section
        output += '\n' + '='.repeat(80) + '\n';
        output += 'SONGS (Grouped by Album)\n';
        output += '='.repeat(80) + '\n\n';
        
        // Sort albums alphabetically
        const sortedAlbums = Object.keys(songsByAlbum).sort();
        
        for (const albumTitle of sortedAlbums) {
            const albumSongs = songsByAlbum[albumTitle];
            output += `\n📀 ALBUM: ${albumTitle}\n`;
            output += '-'.repeat(80) + '\n';
            output += `Total Songs: ${albumSongs.length}\n\n`;
            
            // Sort songs by track number if available, otherwise by title
            albumSongs.sort((a, b) => {
                if (a.track && b.track) {
                    return a.track - b.track;
                }
                if (a.track) return -1;
                if (b.track) return 1;
                return (a.title || '').localeCompare(b.title || '');
            });
            
            for (let i = 0; i < albumSongs.length; i++) {
                const song = albumSongs[i];
                output += `${i + 1}. ${song.artist || 'Unknown Artist'} - ${song.title || 'Unknown Title'}\n`;
                if (song.track) {
                    output += `   Track #${song.track}\n`;
                }
                if (song.year) {
                    output += `   Year: ${song.year}\n`;
                }
                if (song.path) {
                    output += `   Path: ${song.path}\n`;
                }
                if (song.filename) {
                    output += `   File: ${song.filename}\n`;
                }
                if (song._id) {
                    output += `   ID: ${song._id}\n`;
                }
                output += '\n';
            }
        }
        
        // Summary statistics
        output += '\n' + '='.repeat(80) + '\n';
        output += 'SUMMARY STATISTICS\n';
        output += '='.repeat(80) + '\n';
        output += `Total Albums: ${albums.length}\n`;
        output += `Total Songs: ${songs.length}\n`;
        
        // Count songs per album
        const albumSongCounts = Object.entries(songsByAlbum)
            .map(([album, songs]) => ({ album, count: songs.length }))
            .sort((a, b) => b.count - a.count);
        
        output += '\nAlbums by song count:\n';
        for (const { album, count } of albumSongCounts) {
            output += `  ${album}: ${count} song(s)\n`;
        }
        
        // Write to file
        writeFileSync(OUTPUT_FILE, output, 'utf8');
        
        console.log(`\n✅ Successfully exported data`);
        console.log(`📄 Output written to: ${OUTPUT_FILE}`);
        console.log(`📀 Albums: ${albums.length}`);
        console.log(`🎵 Songs: ${songs.length}`);
        
    } catch (error) {
        console.error('❌ Error exporting data:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 MongoDB connection closed');
        }
    }
}

exportMongoDBData().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});














