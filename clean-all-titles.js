import { MongoClient } from 'mongodb';

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

// Function to clean title by removing track numbers and file extensions
function cleanTitle(title, isSong = true) {
    if (!title) return title;
    
    let cleaned = title;
    
    // For songs, remove track numbers (e.g., "02 - ", "01. ", "1) ", etc.)
    if (isSong) {
        cleaned = cleaned.replace(/^\d{1,2}[\s\-\.\)]+/, '');
    }
    
    // Remove file extensions (e.g., ".mp3", ".wav", ".flac", etc.)
    cleaned = cleaned.replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/i, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
}

async function cleanAllTitles() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('jukebox');
        
        console.log('✅ Connected to MongoDB');
        
        // Clean songs
        console.log('\n🎵 Cleaning song titles...');
        const songsCollection = db.collection('songs');
        const songs = await songsCollection.find({}).toArray();
        console.log(`📊 Found ${songs.length} songs`);
        
        let songsUpdated = 0;
        for (const song of songs) {
            const originalTitle = song.title;
            const cleanedTitle = cleanTitle(originalTitle, true);
            
            if (originalTitle !== cleanedTitle) {
                try {
                    await songsCollection.updateOne(
                        { _id: song._id },
                        { $set: { title: cleanedTitle } }
                    );
                    console.log(`✅ Song: "${originalTitle}" → "${cleanedTitle}"`);
                    songsUpdated++;
                } catch (error) {
                    console.error(`❌ Failed to update song "${originalTitle}":`, error.message);
                }
            }
        }
        
        // Clean albums
        console.log('\n📀 Cleaning album titles...');
        const albumsCollection = db.collection('albums');
        const albums = await albumsCollection.find({}).toArray();
        console.log(`📊 Found ${albums.length} albums`);
        
        let albumsUpdated = 0;
        for (const album of albums) {
            const originalTitle = album.title;
            const cleanedTitle = cleanTitle(originalTitle, false);
            
            if (originalTitle !== cleanedTitle) {
                try {
                    await albumsCollection.updateOne(
                        { _id: album._id },
                        { $set: { title: cleanedTitle } }
                    );
                    console.log(`✅ Album: "${originalTitle}" → "${cleanedTitle}"`);
                    albumsUpdated++;
                } catch (error) {
                    console.error(`❌ Failed to update album "${originalTitle}":`, error.message);
                }
            }
        }
        
        console.log(`\n🎉 Cleaning completed!`);
        console.log(`   Songs updated: ${songsUpdated}`);
        console.log(`   Albums updated: ${albumsUpdated}`);
        console.log(`   Total updated: ${songsUpdated + albumsUpdated}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 Disconnected from MongoDB');
        }
    }
}

// Run the script
console.log('🧹 Starting comprehensive title cleaning process...');
console.log('This will clean both song and album titles by removing:');
console.log('   - File extensions (.mp3, .wav, .flac, .m4a, .aac, .ogg)');
console.log('   - Track numbers (01 -, 02., 1) , etc.) - for songs only');
console.log('');

cleanAllTitles()
    .then(() => {
        console.log('\n✅ All titles cleaned successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });


