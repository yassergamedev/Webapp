#!/usr/bin/env node

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';
const DATABASE_NAME = process.env.MONGODB_DB || 'jukebox';
const DRY_RUN = process.argv.includes('--dry-run');

// Extract only the song part from titles like "Artist - Song Title"
function extractSongOnly(title) {
    if (!title || typeof title !== 'string') return title;
    const parts = title.split(' - ');
    if (parts.length >= 2) {
        // Keep everything after the first separator as the song title
        return parts.slice(1).join(' - ').trim();
    }
    return title.trim();
}

async function main() {
    console.log('🔧 Fixing Pophits titles to remove artist from song titles...');
    if (DRY_RUN) console.log('🧪 Dry run mode (no DB writes)');

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const songsCol = db.collection('songs');
    console.log('✅ Connected to MongoDB');

    try {
        // Scope: only albums named like Pophits 00-24 Vol*
        const cursor = songsCol.find({ album: { $regex: /^Pophits 00-24 Vol\d+$/i } });
        let total = 0;
        let changed = 0;

        while (await cursor.hasNext()) {
            const song = await cursor.next();
            total++;
            const original = song.title || '';
            const fixed = extractSongOnly(original);
            if (fixed !== original) {
                console.log(`   ✎ ${original}  ->  ${fixed}`);
                if (!DRY_RUN) {
                    await songsCol.updateOne({ _id: song._id }, { $set: { title: fixed } });
                }
                changed++;
            }
        }

        console.log(`\n✅ Done. Processed=${total}, Updated=${changed}${DRY_RUN ? ' (dry run)' : ''}`);
    } catch (err) {
        console.error('❌ Error fixing titles:', err.message);
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


