#!/usr/bin/env node

import { MongoClient } from 'mongodb';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

class DatabaseCleanup {
    constructor() {
        this.db = null;
        this.client = null;
    }

    async connect() {
        try {
            this.client = new MongoClient(MONGODB_URI);
            await this.client.connect();
            this.db = this.client.db('jukebox');
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            process.exit(1);
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('✅ Disconnected from MongoDB');
        }
    }

    // Clean up songs collection - remove entries with image file extensions
    async cleanupSongs() {
        console.log('\n🧹 Cleaning up songs collection...');
        
        try {
            const songsCollection = this.db.collection('songs');
            
            // Find songs with image file extensions in title
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i;
            const songsWithImages = await songsCollection.find({
                title: { $regex: imageExtensions }
            }).toArray();
            
            console.log(`📊 Found ${songsWithImages.length} songs with image file extensions`);
            
            if (songsWithImages.length > 0) {
                console.log('🗑️ Removing songs with image file extensions:');
                songsWithImages.forEach(song => {
                    console.log(`   - ${song.title} (${song.artist || 'Unknown Artist'})`);
                });
                
                // Delete songs with image extensions
                const deleteResult = await songsCollection.deleteMany({
                    title: { $regex: imageExtensions }
                });
                
                console.log(`✅ Removed ${deleteResult.deletedCount} songs with image file extensions`);
            } else {
                console.log('✅ No songs with image file extensions found');
            }
            
        } catch (error) {
            console.error('❌ Error cleaning up songs:', error);
        }
    }

    // Clean up albums collection - extract artist from album title and set as artist field
    async cleanupAlbums() {
        console.log('\n🧹 Cleaning up albums collection...');
        
        try {
            const albumsCollection = this.db.collection('albums');
            
            // Find albums with artist names in the title (format: "Artist - Album Title")
            const albumsWithArtistNames = await albumsCollection.find({
                title: { $regex: /^[^-]+ - / }
            }).toArray();
            
            // Also find AC-DC albums that need special handling
            const acdcAlbums = await albumsCollection.find({
                title: { $regex: /^AC-DC/i }
            }).toArray();
            
            console.log(`📊 Found ${albumsWithArtistNames.length} albums with artist names in title`);
            console.log(`📊 Found ${acdcAlbums.length} AC-DC albums that need special handling`);
            
            let totalUpdated = 0;
            
            if (albumsWithArtistNames.length > 0) {
                console.log('🔄 Updating album titles and extracting artists:');
                
                for (const album of albumsWithArtistNames) {
                    const originalTitle = album.title;
                    
                    // Extract artist name (part before the first "-")
                    const dashIndex = originalTitle.indexOf(' - ');
                    let artistName = 'Unknown Artist'; // Default fallback
                    let cleanedTitle = originalTitle;
                    
                    if (dashIndex !== -1) {
                        // Extract artist from the part before the first dash
                        artistName = originalTitle.substring(0, dashIndex).trim();
                        
                        // Clean up the title by removing the artist part
                        cleanedTitle = originalTitle.substring(dashIndex + 3).trim();
                        
                        // Clean up extra spaces
                        cleanedTitle = cleanedTitle
                            .replace(/\s+/g, ' ')
                            .trim();
                    }
                    
                    console.log(`   "${originalTitle}"`);
                    console.log(`     → Title: "${cleanedTitle}"`);
                    console.log(`     → Artist: "${artistName}"`);
                    
                    // Update the album with cleaned title and extracted artist
                    await albumsCollection.updateOne(
                        { _id: album._id },
                        { 
                            $set: { 
                                title: cleanedTitle,
                                artist: artistName
                            } 
                        }
                    );
                }
                
                totalUpdated += albumsWithArtistNames.length;
                console.log(`✅ Updated ${albumsWithArtistNames.length} album titles and artists`);
            }
            
            // Handle AC-DC albums separately
            if (acdcAlbums.length > 0) {
                console.log('🔄 Updating AC-DC albums:');
                
                for (const album of acdcAlbums) {
                    const originalTitle = album.title;
                    const artistName = 'AC/DC';
                    let cleanedTitle = originalTitle.replace(/^AC-DC\s*/i, '').trim();
                    
                    console.log(`   "${originalTitle}"`);
                    console.log(`     → Title: "${cleanedTitle}"`);
                    console.log(`     → Artist: "${artistName}"`);
                    
                    // Update the album with cleaned title and AC/DC as artist
                    await albumsCollection.updateOne(
                        { _id: album._id },
                        { 
                            $set: { 
                                title: cleanedTitle,
                                artist: artistName
                            } 
                        }
                    );
                }
                
                totalUpdated += acdcAlbums.length;
                console.log(`✅ Updated ${acdcAlbums.length} AC-DC albums`);
            }
            
            if (totalUpdated === 0) {
                console.log('✅ No albums found that need updating');
            }
            
        } catch (error) {
            console.error('❌ Error cleaning up albums:', error);
        }
    }

    // Update songs to match cleaned album names and artists
    async updateSongsWithCleanedAlbums() {
        console.log('\n🔄 Updating songs with cleaned album names and artists...');
        
        try {
            const songsCollection = this.db.collection('songs');
            const albumsCollection = this.db.collection('albums');
            
            // Get all albums to create a mapping
            const albums = await albumsCollection.find({}).toArray();
            const albumMapping = new Map();
            
            // Create mapping of old names to new names and artists
            for (const album of albums) {
                const currentName = album.title;
                const artistName = album.artist || 'Unknown Artist';
                
                // Check if this album was cleaned (has an artist field now)
                if (album.artist && album.artist !== 'Unknown Artist') {
                    // For AC-DC albums, we need to map the old format to new format
                    if (album.artist === 'AC/DC') {
                        // Map old AC-DC album names to new ones
                        const oldAcdcName = `AC-DC ${currentName}`;
                        albumMapping.set(oldAcdcName, {
                            newTitle: currentName,
                            artist: artistName
                        });
                        
                        // Also map variations like "AC - DC" format
                        const oldAcDcName = `AC - DC ${currentName}`;
                        albumMapping.set(oldAcDcName, {
                            newTitle: currentName,
                            artist: artistName
                        });
                        
                    } else {
                        // For other albums, map the old format with artist name
                        const oldNameWithArtist = `${album.artist} - ${currentName}`;
                        albumMapping.set(oldNameWithArtist, {
                            newTitle: currentName,
                            artist: artistName
                        });
                        
                    }
                }
            }
            
            console.log(`📊 Found ${albumMapping.size} album mappings for song updates`);
            
            if (albumMapping.size > 0) {
                let updatedSongs = 0;
                
                for (const [oldAlbumName, albumInfo] of albumMapping) {
                    const updateResult = await songsCollection.updateMany(
                        { album: oldAlbumName },
                        { 
                            $set: { 
                                album: albumInfo.newTitle,
                                artist: albumInfo.artist
                            } 
                        }
                    );
                    
                    if (updateResult.modifiedCount > 0) {
                        console.log(`   Updated ${updateResult.modifiedCount} songs: "${oldAlbumName}" → "${albumInfo.newTitle}" (Artist: "${albumInfo.artist}")`);
                        updatedSongs += updateResult.modifiedCount;
                    }
                }
                
                console.log(`✅ Updated ${updatedSongs} songs with cleaned album names and artists`);
            } else {
                console.log('✅ No songs need album name updates');
            }
            
        } catch (error) {
            console.error('❌ Error updating songs with cleaned albums:', error);
        }
    }

    // Show database statistics
    async showStats() {
        console.log('\n📊 Database Statistics:');
        
        try {
            const songsCount = await this.db.collection('songs').countDocuments();
            const albumsCount = await this.db.collection('albums').countDocuments();
            const tracklistCount = await this.db.collection('tracklist').countDocuments();
            
            console.log(`   Songs: ${songsCount}`);
            console.log(`   Albums: ${albumsCount}`);
            console.log(`   Tracklist entries: ${tracklistCount}`);
            
        } catch (error) {
            console.error('❌ Error getting database stats:', error);
        }
    }

    // Main cleanup process
    async run() {
        console.log('🚀 Starting database cleanup...');
        console.log('⚠️  This will modify your database. Make sure you have a backup!');
        
        // Ask for confirmation
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise((resolve) => {
            rl.question('Do you want to continue? (yes/no): ', resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('❌ Cleanup cancelled');
            return;
        }
        
        await this.connect();
        
        try {
            await this.showStats();
            await this.cleanupSongs();
            await this.cleanupAlbums();
            await this.updateSongsWithCleanedAlbums();
            await this.showStats();
            
            console.log('\n✅ Database cleanup completed successfully!');
            
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        } finally {
            await this.disconnect();
        }
    }
}

// Run the cleanup
const cleanup = new DatabaseCleanup();
cleanup.run().catch(console.error);
