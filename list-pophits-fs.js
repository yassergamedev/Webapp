#!/usr/bin/env node

import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg']);

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
    // Strip extension
    let title = filename.replace(/\.(mp3|flac|wav|m4a|aac|ogg)$/i, '');
    // Strip leading track numbers like "01 - ", "01.", "1) ", etc.
    title = title.replace(/^\s*\d{1,2}[\s\-\.\)]\s*/, '');
    return title.trim();
}

function listAlbumSongTitles(rootDir, albumFolderName) {
    const albumPath = join(rootDir, albumFolderName);
    try {
        const entries = readdirSync(albumPath);
        const audioFiles = entries.filter(isAudio).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return audioFiles.map(cleanSongTitle);
    } catch (err) {
        return [];
    }
}

function main() {
    const root = resolveScanRoot();
    console.log(`📁 Scanning: ${root}`);

    // Find album folders matching "Pophits 00-24 VolX"
    let folders = [];
    try {
        folders = readdirSync(root)
            .filter(name => {
                try {
                    return statSync(join(root, name)).isDirectory();
                } catch (_) { return false; }
            })
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

    for (const folder of folders) {
        const titles = listAlbumSongTitles(root, folder);
        console.log(`\n📀 ${folder} — ${titles.length} songs`);
        if (titles.length === 0) continue;
        titles.forEach((t, i) => {
            console.log(`  ${String(i + 1).padStart(2, '0')}. ${t}`);
        });
    }
}

main();


