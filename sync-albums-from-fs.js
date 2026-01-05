#!/usr/bin/env node

import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { MongoClient } from 'mongodb';

// Configuration (SIMPLE DB DEDUPE)
// - Run this script from anywhere (e.g., the Webapp folder).
// - It will connect to MongoDB and remove duplicate documents:
//   1) In `albums`: duplicates by normalized title (case-insensitive, collapsed spaces)
//      → keep one (prefers one with artist), delete the rest
//   2) In `songs`: within each album title, duplicates by normalized song title
//      → keep one, delete the rest
// - MongoDB connection string: set MONGODB_URI env or edit fallback below.

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac']);
const DEFAULT_FAMILY_FRIENDLY = true;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';

const DRY_RUN = process.argv.includes('--dry-run');

// Directory scanning no longer used for DB-level dedupe

function isAudioFile(filename) {
    return AUDIO_EXTENSIONS.has(extname(filename).toLowerCase());
}

function listAlbumFolders(rootDir) {
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
                if (hasAudio) dirs.push({ name, path: full });
            }
        } catch (_) {}
    }
    return dirs;
}

// Apply the same cleanup semantics used elsewhere in the project
// - "Artist - Album" → artist, cleanedTitle
// - "AC-DC Album" → artist "AC/DC" and title without prefix
function parseAlbumFolderName(folderName) {
    // AC-DC special-case
    if (/^AC-DC\b/i.test(folderName)) {
        const cleanedTitle = folderName.replace(/^AC-DC\s*/i, '').trim();
        return { title: cleanedTitle, artist: 'AC/DC' };
    }

    const dashIndex = folderName.indexOf(' - ');
    if (dashIndex !== -1) {
        const artist = folderName.substring(0, dashIndex).trim();
        const cleanedTitle = folderName.substring(dashIndex + 3).trim().replace(/\s+/g, ' ');
        return { title: cleanedTitle, artist: artist || 'Unknown Artist' };
    }

    return { title: folderName.trim(), artist: undefined };
}

// Parse song filenames similar to existing logic
// Examples:
//  "01 - Thunderstruck - ACDC.mp3"
//  "Artist - Title.mp3"
//  "Title - Artist.flac"
function parseSongFilename(filename) {
    const base = filename.replace(/\.(mp3|flac)$/i, '');

    let trackNumber = null;
    let working = base;
    const numbered = working.match(/^(\d{2})\s*-\s*(.+)$/);
    if (numbered) {
        trackNumber = parseInt(numbered[1], 10);
        working = numbered[2];
    }

    const parts = working.split(' - ');
    let title = working;
    let artist = null;
    if (parts.length >= 2) {
        // Heuristic: use last token as artist, the rest as title
        artist = parts[parts.length - 1];
        title = parts.slice(0, parts.length - 1).join(' - ');
    }

    return {
        trackNumber,
        title: title.trim(),
        artist: artist ? artist.trim() : null,
    };
}

async function connectToDb() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    return { client, db };
}

function normalizeTitle(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function dedupeAlbumsInDb(db) {
    console.log('\n🧹 Removing duplicate albums in MongoDB (by normalized title)...');
    const albumsCol = db.collection('albums');
    const all = await albumsCol.find({}).toArray();
    const groups = new Map();
    for (const a of all) {
        const key = normalizeTitle(a.title);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    }
    let removed = 0;
    for (const [key, list] of groups.entries()) {
        if (list.length <= 1) continue;
        const canonical = list.find(x => x.artist && String(x.artist).trim()) || list[0];
        const toDelete = list.filter(x => String(x._id) !== String(canonical._id)).map(x => x._id);
        if (toDelete.length) {
            if (!DRY_RUN) {
                const del = await albumsCol.deleteMany({ _id: { $in: toDelete } });
                removed += del.deletedCount || 0;
            }
            console.log(`   🗑️ Removed ${toDelete.length} duplicate album(s) for title: "${canonical.title}"`);
        }
    }
    if (!removed && !DRY_RUN) console.log('✅ No duplicate albums found');
}

async function dedupeSongsPerAlbumInDb(db) {
    console.log('\n🧹 Removing duplicate songs within each album (by normalized title)...');
    const songsCol = db.collection('songs');
    const albums = await songsCol.distinct('album');
    let removed = 0;
    for (const albumTitle of albums) {
        const songs = await songsCol.find({ album: albumTitle }).toArray();
        const groups = new Map();
        for (const s of songs) {
            const key = normalizeTitle(s.title);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(s);
        }
        for (const [key, list] of groups.entries()) {
            if (list.length <= 1) continue;
            const keep = list[0];
            const toDelete = list.slice(1).map(x => x._id);
            if (toDelete.length) {
                if (!DRY_RUN) {
                    const del = await songsCol.deleteMany({ _id: { $in: toDelete } });
                    removed += del.deletedCount || 0;
                }
                console.log(`   🗑️ Removed ${toDelete.length} duplicate song(s) in album "${albumTitle}" for title: "${keep.title}"`);
            }
        }
    }
    if (!removed && !DRY_RUN) console.log('✅ No duplicate songs found');
}

async function upsertAlbum(db, album) {
    if (DRY_RUN) return { upserted: true, dryRun: true };
    await db.collection('albums').updateOne(
        { title: album.title },
        { $setOnInsert: { title: album.title }, $set: album.artist ? { artist: album.artist } : {} },
        { upsert: true }
    );
    return { upserted: true };
}

async function insertSongIfMissing(db, songDoc) {
    if (DRY_RUN) return { inserted: true, dryRun: true };
    try {
        await db.collection('songs').insertOne(songDoc);
        return { inserted: true };
    } catch (err) {
        if (err && err.code === 11000) {
            // duplicate key on { album, title }
            return { inserted: false, duplicate: true };
        }
        throw err;
    }
}

async function main() {
    console.log('📡 DB dedupe mode (no filesystem changes)');
    if (DRY_RUN) console.log('🧪 Dry run mode enabled (no DB writes)');

    const { client, db } = await connectToDb();
    console.log('✅ Connected to MongoDB');

    try {
        await dedupeAlbumsInDb(db);
        await dedupeSongsPerAlbumInDb(db);

        console.log('\n✅ DB duplicate cleanup complete');
        if (DRY_RUN) console.log('ℹ️ Dry run: no changes were written to the database');
    } catch (err) {
        console.error('❌ Error during sync:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});


