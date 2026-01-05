import { MongoClient } from 'mongodb';

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

// Function to clean song title by removing track numbers and file extensions
function cleanSongTitle(title) {
    if (!title) return title;
    
    // Remove track numbers (e.g., "02 - ", "01. ", "1) ", etc.)
    let cleaned = title.replace(/^\d{1,2}[\s\-\.\)]+/, '');
    
    // Remove file extensions (e.g., ".mp3", ".wav", ".flac", etc.)
    cleaned = cleaned.replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/i, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
}

async function cleanSongTitles() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('jukebox');
        
        console.log('✅ Connected to MongoDB');
        
        // Get the songs collection
        const songsCollection = db.collection('songs');
        
        // Find all songs
        console.log('📋 Fetching all songs...');
        const songs = await songsCollection.find({}).toArray();
        console.log(`📊 Found ${songs.length} songs`);
        
        if (songs.length === 0) {
            console.log('ℹ️  No songs found in the database');
            return;
        }
        
        // Process songs and identify which ones need cleaning
        const songsToUpdate = [];
        let cleanedCount = 0;
        
        for (const song of songs) {
            const originalTitle = song.title;
            const cleanedTitle = cleanSongTitle(originalTitle);
            
            if (originalTitle !== cleanedTitle) {
                songsToUpdate.push({
                    _id: song._id,
                    originalTitle: originalTitle,
                    cleanedTitle: cleanedTitle
                });
                cleanedCount++;
            }
        }
        
        console.log(`🧹 Found ${cleanedCount} songs that need cleaning`);
        
        if (songsToUpdate.length === 0) {
            console.log('✅ All song titles are already clean!');
            return;
        }
        
        // Show what will be changed
        console.log('\n📝 Songs to be updated:');
        songsToUpdate.forEach((song, index) => {
            console.log(`${index + 1}. "${song.originalTitle}" → "${song.cleanedTitle}"`);
        });
        
        // Update songs in batches
        console.log('\n🔄 Updating songs in database...');
        let updatedCount = 0;
        
        for (const song of songsToUpdate) {
            try {
                const result = await songsCollection.updateOne(
                    { _id: song._id },
                    { $set: { title: song.cleanedTitle } }
                );
                
                if (result.modifiedCount === 1) {
                    updatedCount++;
                    console.log(`✅ Updated: "${song.originalTitle}" → "${song.cleanedTitle}"`);
                } else {
                    console.log(`❌ Failed to update: "${song.originalTitle}"`);
                }
            } catch (error) {
                console.error(`❌ Error updating song "${song.originalTitle}":`, error.message);
            }
        }
        
        console.log(`\n🎉 Successfully updated ${updatedCount} out of ${songsToUpdate.length} songs`);
        
        // Verify the changes
        console.log('\n🔍 Verifying changes...');
        const updatedSongs = await songsCollection.find({}).toArray();
        const stillNeedCleaning = updatedSongs.filter(song => {
            const cleaned = cleanSongTitle(song.title);
            return song.title !== cleaned;
        });
        
        if (stillNeedCleaning.length === 0) {
            console.log('✅ All song titles are now clean!');
        } else {
            console.log(`⚠️  ${stillNeedCleaning.length} songs still need cleaning:`);
            stillNeedCleaning.forEach(song => {
                console.log(`   - "${song.title}"`);
            });
        }
        
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
console.log('🎵 Starting song title cleaning process...');
console.log('This will remove .mp3, .wav, .flac, and other audio file extensions from song titles');
console.log('It will also remove track numbers like "01 - ", "02. ", etc.');
console.log('');

cleanSongTitles()
    .then(() => {
        console.log('\n✅ Song title cleaning completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });


