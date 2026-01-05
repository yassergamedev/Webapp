import { MongoClient } from 'mongodb';

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

// Function to clean album title by removing file extensions
function cleanAlbumTitle(title) {
    if (!title) return title;
    
    // Remove file extensions (e.g., ".mp3", ".wav", ".flac", etc.)
    let cleaned = title.replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/i, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
}

async function cleanAlbumTitles() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('jukebox');
        
        console.log('✅ Connected to MongoDB');
        
        // Get the albums collection
        const albumsCollection = db.collection('albums');
        
        // Find all albums
        console.log('📋 Fetching all albums...');
        const albums = await albumsCollection.find({}).toArray();
        console.log(`📊 Found ${albums.length} albums`);
        
        if (albums.length === 0) {
            console.log('ℹ️  No albums found in the database');
            return;
        }
        
        // Process albums and identify which ones need cleaning
        const albumsToUpdate = [];
        let cleanedCount = 0;
        
        for (const album of albums) {
            const originalTitle = album.title;
            const cleanedTitle = cleanAlbumTitle(originalTitle);
            
            if (originalTitle !== cleanedTitle) {
                albumsToUpdate.push({
                    _id: album._id,
                    originalTitle: originalTitle,
                    cleanedTitle: cleanedTitle
                });
                cleanedCount++;
            }
        }
        
        console.log(`🧹 Found ${cleanedCount} albums that need cleaning`);
        
        if (albumsToUpdate.length === 0) {
            console.log('✅ All album titles are already clean!');
            return;
        }
        
        // Show what will be changed
        console.log('\n📝 Albums to be updated:');
        albumsToUpdate.forEach((album, index) => {
            console.log(`${index + 1}. "${album.originalTitle}" → "${album.cleanedTitle}"`);
        });
        
        // Update albums in batches
        console.log('\n🔄 Updating albums in database...');
        let updatedCount = 0;
        
        for (const album of albumsToUpdate) {
            try {
                const result = await albumsCollection.updateOne(
                    { _id: album._id },
                    { $set: { title: album.cleanedTitle } }
                );
                
                if (result.modifiedCount === 1) {
                    updatedCount++;
                    console.log(`✅ Updated: "${album.originalTitle}" → "${album.cleanedTitle}"`);
                } else {
                    console.log(`❌ Failed to update: "${album.originalTitle}"`);
                }
            } catch (error) {
                console.error(`❌ Error updating album "${album.originalTitle}":`, error.message);
            }
        }
        
        console.log(`\n🎉 Successfully updated ${updatedCount} out of ${albumsToUpdate.length} albums`);
        
        // Verify the changes
        console.log('\n🔍 Verifying changes...');
        const updatedAlbums = await albumsCollection.find({}).toArray();
        const stillNeedCleaning = updatedAlbums.filter(album => {
            const cleaned = cleanAlbumTitle(album.title);
            return album.title !== cleaned;
        });
        
        if (stillNeedCleaning.length === 0) {
            console.log('✅ All album titles are now clean!');
        } else {
            console.log(`⚠️  ${stillNeedCleaning.length} albums still need cleaning:`);
            stillNeedCleaning.forEach(album => {
                console.log(`   - "${album.title}"`);
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
console.log('📀 Starting album title cleaning process...');
console.log('This will remove .mp3, .wav, .flac, and other audio file extensions from album titles');
console.log('');

cleanAlbumTitles()
    .then(() => {
        console.log('\n✅ Album title cleaning completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });


