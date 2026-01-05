#!/usr/bin/env node

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parseFile } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const ALBUMS_FOLDER = process.argv[2] || process.env.ALBUMS_FOLDER_PATH || '/home/arcade/Desktop/jukeboxshare/Jukebox songs';
const OUTPUT_FILE = process.argv[3] || process.env.OUTPUT_FILE || './album-metadata.txt';
const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac']);

// Check if albums folder exists
function isAudioFile(filename) {
    return AUDIO_EXTENSIONS.has(extname(filename).toLowerCase());
}

function listAlbumFolders(rootDir) {
    try {
        const entries = readdirSync(rootDir);
        const dirs = [];
        for (const name of entries) {
            if (name.startsWith('.')) continue; // skip hidden
            const full = join(rootDir, name);
            try {
                const st = statSync(full);
                if (st.isDirectory()) {
                    // only consider as album folder if it contains at least one audio file
                    const files = readdirSync(full);
                    const hasAudio = files.some(f => isAudioFile(f));
                    if (hasAudio) {
                        dirs.push({ name, path: full });
                    }
                }
            } catch (err) {
                console.warn(`⚠️  Could not read ${full}:`, err.message);
            }
        }
        return dirs.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        console.error(`❌ Error reading albums folder: ${err.message}`);
        process.exit(1);
    }
}

async function extractMetadata(filePath) {
    try {
        const metadata = await parseFile(filePath);
        const common = metadata.common;
        return {
            artist: common.artist || common.albumartist || 'Unknown Artist',
            title: common.title || basename(filePath, extname(filePath)) || 'Unknown Title',
            album: common.album || null,
            track: common.track?.no || null,
            year: common.year || null
        };
    } catch (err) {
        console.warn(`⚠️  Could not read metadata from ${filePath}:`, err.message);
        return {
            artist: 'Unknown Artist',
            title: basename(filePath, extname(filePath)),
            album: null,
            track: null,
            year: null
        };
    }
}

async function processAlbumFolder(albumFolder) {
    const albumName = albumFolder.name;
    const albumPath = albumFolder.path;
    
    console.log(`📀 Processing album: ${albumName}`);
    
    const files = readdirSync(albumPath)
        .filter(f => isAudioFile(f))
        .map(f => join(albumPath, f))
        .sort();
    
    const songs = [];
    
    for (const filePath of files) {
        const metadata = await extractMetadata(filePath);
        songs.push({
            ...metadata,
            filename: basename(filePath)
        });
    }
    
    return {
        albumName,
        songs
    };
}

function formatOutput(albums) {
    let output = '';
    output += '='.repeat(80) + '\n';
    output += 'ALBUM METADATA EXTRACTION REPORT\n';
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Total Albums: ${albums.length}\n`;
    output += '='.repeat(80) + '\n\n';
    
    for (const album of albums) {
        output += `\n📀 ALBUM: ${album.albumName}\n`;
        output += '-'.repeat(80) + '\n';
        output += `Total Songs: ${album.songs.length}\n\n`;
        
        for (let i = 0; i < album.songs.length; i++) {
            const song = album.songs[i];
            output += `${i + 1}. ${song.artist} - ${song.title}\n`;
            if (song.album && song.album !== album.albumName) {
                output += `   (Album tag: ${song.album})\n`;
            }
            if (song.track) {
                output += `   Track #${song.track}\n`;
            }
            if (song.year) {
                output += `   Year: ${song.year}\n`;
            }
            output += `   File: ${song.filename}\n`;
            output += '\n';
        }
        output += '\n';
    }
    
    // Summary
    output += '\n' + '='.repeat(80) + '\n';
    output += 'SUMMARY\n';
    output += '='.repeat(80) + '\n';
    const totalSongs = albums.reduce((sum, album) => sum + album.songs.length, 0);
    output += `Total Albums: ${albums.length}\n`;
    output += `Total Songs: ${totalSongs}\n`;
    
    return output;
}

async function main() {
    console.log('🎵 Starting album metadata extraction...\n');
    console.log(`📁 Albums folder: ${ALBUMS_FOLDER}`);
    console.log(`📄 Output file: ${OUTPUT_FILE}\n`);
    
    // Check if albums folder exists
    try {
        const stats = statSync(ALBUMS_FOLDER);
        if (!stats.isDirectory()) {
            console.error(`❌ Error: ${ALBUMS_FOLDER} is not a directory`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`❌ Error: Could not access ${ALBUMS_FOLDER}:`, err.message);
        process.exit(1);
    }
    
    // List album folders
    const albumFolders = listAlbumFolders(ALBUMS_FOLDER);
    console.log(`📚 Found ${albumFolders.length} album folder(s)\n`);
    
    if (albumFolders.length === 0) {
        console.log('⚠️  No album folders found. Exiting.');
        process.exit(0);
    }
    
    // Process each album
    const albums = [];
    for (const albumFolder of albumFolders) {
        const album = await processAlbumFolder(albumFolder);
        albums.push(album);
    }
    
    // Format and write output
    const output = formatOutput(albums);
    writeFileSync(OUTPUT_FILE, output, 'utf8');
    
    console.log(`\n✅ Successfully extracted metadata from ${albums.length} album(s)`);
    console.log(`📄 Output written to: ${OUTPUT_FILE}`);
    
    const totalSongs = albums.reduce((sum, album) => sum + album.songs.length, 0);
    console.log(`🎵 Total songs processed: ${totalSongs}`);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});

