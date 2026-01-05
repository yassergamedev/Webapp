#!/usr/bin/env node

import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { MongoClient } from 'mongodb';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg']);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';
const DRY_RUN = process.argv.includes('--dry-run');

function resolveScanRoot() {
    const dirArg = process.argv.find(a => a.startsWith('--dir='))
        || (process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : null);
    const fromArg = dirArg ? (dirArg.startsWith('--dir=') ? dirArg.slice(6) : dirArg) : null;
    const fromEnv = process.env.ALBUMS_SCAN_DIR;
    const defaultPath = '/home/arcade/Desktop/jukeboxshare/Jukebox songs/';
    return (fromArg && fromArg.trim()) || (fromEnv && fromEnv.trim()) || defaultPath;
}

function isAudio(filename) {
    return AUDIO_EXTENSIONS.has(extname(filename).toLowerCase());
}

function cleanSongTitle(filename) {
    if (!filename) return filename;
    let title = filename.replace(/\.(mp3|flac|wav|m4a|aac|ogg)$/i, '');
    title = title.replace(/^\s*\d{1,2}[\s\-\.\)]\s*/, '');
    return title.trim();
}

function listAlbumSongTitles(rootDir, albumFolderName) {
    const albumPath = join(rootDir, albumFolderName);
    try {
        const entries = readdirSync(albumPath);
        const audioFiles = entries.filter(isAudio).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return audioFiles.map(cleanSongTitle);
    } catch (_) {
        return [];
    }
}

async function main() {
    const root = resolveScanRoot();
    console.log(`📁 Scanning FS: ${root}`);
    if (DRY_RUN) console.log('🧪 Dry run (no DB writes)');

    // Discover matching album folders
    let folders = [];
    try {
        folders = readdirSync(root)
            .filter(name => { try { return statSync(join(root, name)).isDirectory(); } catch { return false; } })
            .filter(name => /^Pophits 00-24 Vol\d+$/i.test(name))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } catch (err) {
        console.error('❌ Failed to read albums directory:', err.message);
        process.exit(1);
    }

    if (folders.length === 0) {
        console.log('⚠️  No matching Pophits 00-24 Vol* album folders found.');
        return;
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const songsCol = db.collection('songs');
    console.log('✅ Connected to MongoDB');

    try {
        let totalAlbums = 0;
        let totalInserted = 0;

        for (const folder of folders) {
            const titles = listAlbumSongTitles(root, folder);
            console.log(`\n📀 ${folder}: ${titles.length} songs from FS`);
            if (titles.length === 0) continue;

            if (!DRY_RUN) {
                // Replace DB songs for this album with FS-derived list
                const del = await songsCol.deleteMany({ album: folder });
                if (del.deletedCount) {
                    console.log(`   🗑️  Removed ${del.deletedCount} existing DB songs for "${folder}"`);
                }
                if (titles.length) {
                    const docs = titles.map(t => ({ title: t, album: folder, familyFriendly: true }));
                    const ins = await songsCol.insertMany(docs, { ordered: true });
                    totalInserted += ins.insertedCount || titles.length;
                }
            } else {
                console.log(`   (dry-run) Would replace songs in DB for "${folder}" with ${titles.length} entries`);
                totalInserted += titles.length;
            }

            totalAlbums += 1;
        }

        console.log(`\n✅ Sync complete: albums=${totalAlbums}, songs written=${totalInserted}${DRY_RUN ? ' (dry run)' : ''}`);
    } catch (err) {
        console.error('❌ Error syncing:', err.message);
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


