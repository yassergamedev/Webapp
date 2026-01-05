#!/usr/bin/env node

import { MongoClient } from 'mongodb';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

class DatabasePreview {
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

    // Preview songs that would be removed
    async previewSongsCleanup() {
        console.log('\n🔍 Preview: Songs that would be removed...');
        
        try {
            const songsCollection = this.db.collection('songs');
            
            // Find songs with image file extensions in title
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i;
            const songsWithImages = await songsCollection.find({
                title: { $regex: imageExtensions }
            }).toArray();
            
            console.log(`📊 Found ${songsWithImages.length} songs with image file extensions:`);
            
            if (songsWithImages.length > 0) {
                songsWithImages.forEach((song, index) => {
                    console.log(`   ${index + 1}. "${song.title}" (${song.artist || 'Unknown Artist'})`);
                });
            } else {
                console.log('✅ No songs with image file extensions found');
            }
            
        } catch (error) {
            console.error('❌ Error previewing songs cleanup:', error);
        }
    }

    // Preview albums that would be cleaned
    async previewAlbumsCleanup() {
        console.log('\n🔍 Preview: Albums that would be cleaned...');
        
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
            
            console.log(`📊 Found ${albumsWithArtistNames.length} albums with artist names in title:`);
            console.log(`📊 Found ${acdcAlbums.length} AC-DC albums that need special handling:`);
            
            let totalPreview = 0;
            
            if (albumsWithArtistNames.length > 0) {
                albumsWithArtistNames.forEach((album, index) => {
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
                    
                    console.log(`   ${index + 1}. "${originalTitle}"`);
                    console.log(`      → Title: "${cleanedTitle}"`);
                    console.log(`      → Artist: "${artistName}"`);
                });
                totalPreview += albumsWithArtistNames.length;
            }
            
            // Handle AC-DC albums separately
            if (acdcAlbums.length > 0) {
                acdcAlbums.forEach((album, index) => {
                    const originalTitle = album.title;
                    const artistName = 'AC/DC';
                    let cleanedTitle = originalTitle.replace(/^AC-DC\s*/i, '').trim();
                    
                    console.log(`   ${albumsWithArtistNames.length + index + 1}. "${originalTitle}"`);
                    console.log(`      → Title: "${cleanedTitle}"`);
                    console.log(`      → Artist: "${artistName}"`);
                });
                totalPreview += acdcAlbums.length;
            }
            
            if (totalPreview === 0) {
                console.log('✅ No albums found that need updating');
            }
            
        } catch (error) {
            console.error('❌ Error previewing albums cleanup:', error);
        }
    }

    // Preview songs that would be updated with cleaned album names and artists
    async previewSongsAlbumUpdate() {
        console.log('\n🔍 Preview: Songs that would be updated with cleaned album names and artists...');
        
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
            
            console.log(`📊 Found ${albumMapping.size} albums that would affect songs:`);
            
            if (albumMapping.size > 0) {
                for (const [oldAlbumName, albumInfo] of albumMapping) {
                    const songsCount = await songsCollection.countDocuments({ album: oldAlbumName });
                    if (songsCount > 0) {
                        console.log(`   "${oldAlbumName}" → "${albumInfo.newTitle}" (Artist: "${albumInfo.artist}") - ${songsCount} songs`);
                    }
                }
            } else {
                console.log('✅ No songs would need album name updates');
            }
            
        } catch (error) {
            console.error('❌ Error previewing songs album update:', error);
        }
    }

    // Show database statistics
    async showStats() {
        console.log('\n📊 Current Database Statistics:');
        
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

    // Main preview process
    async run() {
        console.log('🔍 Database cleanup preview (no changes will be made)...');
        
        await this.connect();
        
        try {
            await this.showStats();
            await this.previewSongsCleanup();
            await this.previewAlbumsCleanup();
            await this.previewSongsAlbumUpdate();
            
            console.log('\n✅ Preview completed! Use cleanup-database.js to make actual changes.');
            
        } catch (error) {
            console.error('❌ Error during preview:', error);
        } finally {
            await this.disconnect();
        }
    }
}

// Run the preview
const preview = new DatabasePreview();
preview.run().catch(console.error);
