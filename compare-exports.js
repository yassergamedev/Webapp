#!/usr/bin/env node

import { readFileSync } from 'fs';

// Read both files
const mongoContent = readFileSync('./mongodb-export.txt', 'utf8');
const fsContent = readFileSync('./album-metadata.txt', 'utf8');

// Extract albums from MongoDB export
function extractMongoAlbums(content) {
    const albums = new Map();
    const lines = content.split('\n');
    let currentAlbum = null;
    let inAlbumsSection = false;
    let inSongsSection = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('ALBUMS')) {
            inAlbumsSection = true;
            continue;
        }
        
        if (line.includes('SONGS (Grouped by Album)')) {
            inAlbumsSection = false;
            inSongsSection = true;
            continue;
        }
        
        if (inAlbumsSection && line.includes('📀 ALBUM:')) {
            const albumName = line.replace('📀 ALBUM:', '').trim();
            albums.set(albumName, { name: albumName, songs: [], source: 'mongodb' });
        }
        
        if (inSongsSection && line.includes('📀 ALBUM:')) {
            const albumName = line.replace('📀 ALBUM:', '').trim();
            currentAlbum = albumName;
            if (!albums.has(albumName)) {
                albums.set(albumName, { name: albumName, songs: [], source: 'mongodb' });
            }
        }
        
        if (inSongsSection && currentAlbum && line.match(/^\d+\./)) {
            const match = line.match(/^\d+\.\s+(.+?)\s+-\s+(.+?)$/);
            if (match) {
                const [, artist, title] = match;
                albums.get(currentAlbum).songs.push({ artist: artist.trim(), title: title.trim() });
            }
        }
    }
    
    return albums;
}

// Extract albums from file system export
function extractFSAlbums(content) {
    const albums = new Map();
    const lines = content.split('\n');
    let currentAlbum = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('📀 ALBUM:')) {
            const albumName = line.replace('📀 ALBUM:', '').trim();
            currentAlbum = albumName;
            if (!albums.has(albumName)) {
                albums.set(albumName, { name: albumName, songs: [], source: 'filesystem' });
            }
        }
        
        if (currentAlbum && line.match(/^\d+\./)) {
            const match = line.match(/^\d+\.\s+(.+?)\s+-\s+(.+?)$/);
            if (match) {
                const [, artist, title] = match;
                albums.get(currentAlbum).songs.push({ artist: artist.trim(), title: title.trim() });
            }
        }
    }
    
    return albums;
}

// Normalize album names for comparison
function normalizeAlbumName(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^pophits\s*00-?/i, '')
        .replace(/^24\s*vol/i, '24 vol')
        .replace(/^dc\s*best\s*of/i, 'ac-dc best of')
        .trim();
}

// Compare albums
const mongoAlbums = extractMongoAlbums(mongoContent);
const fsAlbums = extractFSAlbums(fsContent);

// Create normalized maps for comparison
const mongoNormalized = new Map();
for (const [name, album] of mongoAlbums) {
    const normalized = normalizeAlbumName(name);
    if (!mongoNormalized.has(normalized)) {
        mongoNormalized.set(normalized, []);
    }
    mongoNormalized.get(normalized).push({ original: name, album });
}

const fsNormalized = new Map();
for (const [name, album] of fsAlbums) {
    const normalized = normalizeAlbumName(name);
    if (!fsNormalized.has(normalized)) {
        fsNormalized.set(normalized, []);
    }
    fsNormalized.get(normalized).push({ original: name, album });
}

// Find differences
const onlyInMongo = [];
const onlyInFS = [];
const inBoth = [];

for (const [normalized, mongoEntries] of mongoNormalized) {
    if (fsNormalized.has(normalized)) {
        inBoth.push({ normalized, mongo: mongoEntries, fs: fsNormalized.get(normalized) });
    } else {
        onlyInMongo.push({ normalized, entries: mongoEntries });
    }
}

for (const [normalized, fsEntries] of fsNormalized) {
    if (!mongoNormalized.has(normalized)) {
        onlyInFS.push({ normalized, entries: fsEntries });
    }
}

// Generate report
let report = '';
report += '='.repeat(80) + '\n';
report += 'COMPARISON REPORT: MongoDB vs File System\n';
report += `Generated: ${new Date().toISOString()}\n`;
report += '='.repeat(80) + '\n\n';

report += 'SUMMARY\n';
report += '-'.repeat(80) + '\n';
report += `MongoDB Albums: ${mongoAlbums.size}\n`;
report += `File System Albums: ${fsAlbums.size}\n`;
report += `Albums in Both: ${inBoth.length}\n`;
report += `Albums Only in MongoDB: ${onlyInMongo.length}\n`;
report += `Albums Only in File System: ${onlyInFS.length}\n\n`;

const mongoTotalSongs = Array.from(mongoAlbums.values()).reduce((sum, a) => sum + a.songs.length, 0);
const fsTotalSongs = Array.from(fsAlbums.values()).reduce((sum, a) => sum + a.songs.length, 0);
report += `MongoDB Total Songs: ${mongoTotalSongs}\n`;
report += `File System Total Songs: ${fsTotalSongs}\n`;
report += `Difference: ${fsTotalSongs - mongoTotalSongs} songs\n\n`;

// Albums only in MongoDB
if (onlyInMongo.length > 0) {
    report += '\n' + '='.repeat(80) + '\n';
    report += 'ALBUMS ONLY IN MONGODB\n';
    report += '='.repeat(80) + '\n';
    for (const { normalized, entries } of onlyInMongo) {
        for (const { original, album } of entries) {
            report += `\n📀 ${original}\n`;
            report += `   Songs: ${album.songs.length}\n`;
        }
    }
}

// Albums only in File System
if (onlyInFS.length > 0) {
    report += '\n' + '='.repeat(80) + '\n';
    report += 'ALBUMS ONLY IN FILE SYSTEM\n';
    report += '='.repeat(80) + '\n';
    for (const { normalized, entries } of onlyInFS) {
        for (const { original, album } of entries) {
            report += `\n📀 ${original}\n`;
            report += `   Songs: ${album.songs.length}\n`;
        }
    }
}

// Albums in both - compare song counts
report += '\n' + '='.repeat(80) + '\n';
report += 'ALBUMS IN BOTH (Comparing Song Counts)\n';
report += '='.repeat(80) + '\n';
for (const { normalized, mongo, fs } of inBoth) {
    const mongoEntry = mongo[0];
    const fsEntry = fs[0];
    const mongoCount = mongoEntry.album.songs.length;
    const fsCount = fsEntry.album.songs.length;
    
    if (mongoEntry.original !== fsEntry.original || mongoCount !== fsCount) {
        report += `\n📀 ${normalized}\n`;
        report += `   MongoDB: "${mongoEntry.original}" (${mongoCount} songs)\n`;
        report += `   File System: "${fsEntry.original}" (${fsCount} songs)\n`;
        if (mongoCount !== fsCount) {
            report += `   ⚠️  Song count difference: ${fsCount - mongoCount}\n`;
        }
    }
}

// Write report
const outputFile = './comparison-report.txt';
import { writeFileSync } from 'fs';
writeFileSync(outputFile, report, 'utf8');

console.log('✅ Comparison complete!');
console.log(`📄 Report written to: ${outputFile}`);
console.log(`\nSummary:`);
console.log(`  MongoDB: ${mongoAlbums.size} albums, ${mongoTotalSongs} songs`);
console.log(`  File System: ${fsAlbums.size} albums, ${fsTotalSongs} songs`);
console.log(`  Only in MongoDB: ${onlyInMongo.length} albums`);
console.log(`  Only in File System: ${onlyInFS.length} albums`);
console.log(`  In Both: ${inBoth.length} albums`);













