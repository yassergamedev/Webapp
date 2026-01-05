#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox';

class AlbumNameReverter {
    constructor() {
        this.db = null;
        this.client = null;
        this.albumsList = [];
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

    // Load the albums_list.txt file
    loadAlbumsList() {
        try {
            const content = readFileSync('./albums_list.txt', 'utf8');
            const lines = content.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('Album:')) {
                    const albumName = line.replace('Album:', '').trim();
                    this.albumsList.push(albumName);
                }
            }
            
            console.log(`📋 Loaded ${this.albumsList.length} albums from albums_list.txt`);
        } catch (error) {
            console.error('❌ Error loading albums_list.txt:', error);
            process.exit(1);
        }
    }

    // Revert album names in the database
    async revertAlbumNames() {
        console.log('\n🔄 Reverting album names to original format...');
        
        try {
            const albumsCollection = this.db.collection('albums');
            
            // Get all albums from database
            const dbAlbums = await albumsCollection.find({}).toArray();
            
            console.log(`📊 Found ${dbAlbums.length} albums in database`);
            
            let revertedCount = 0;
            
            for (const dbAlbum of dbAlbums) {
                // Find a matching album from the list
                const matchingAlbum = this.albumsList.find(listAlbum => {
                    // Try to match by cleaning both names
                    const dbTitle = dbAlbum.title.toLowerCase();
                    const listTitle = listAlbum.toLowerCase();
                    
                    // Check if they match after removing common prefixes
                    const dbClean = dbTitle.replace(/^(ac\/dc|ac-dc|ac\s*d\s*c)\s*/i, '').trim();
                    const listClean = listTitle.replace(/^(ac\/dc|ac-dc|ac\s*d\s*c)\s*/i, '').trim();
                    
                    // Check if the list album starts with or contains the db title
                    return dbTitle === listTitle || 
                           listTitle.includes(dbTitle) || 
                           dbClean === listClean ||
                           dbTitle.includes(listClean) ||
                           listClean.includes(dbTitle);
                });
                
                if (matchingAlbum && matchingAlbum !== dbAlbum.title) {
                    console.log(`   "${dbAlbum.title}" → "${matchingAlbum}"`);
                    
                    await albumsCollection.updateOne(
                        { _id: dbAlbum._id },
                        { $set: { title: matchingAlbum } }
                    );
                    
                    revertedCount++;
                } else {
                    // Keep the original title if no match found
                    console.log(`   ✓ "${dbAlbum.title}" (no change needed)`);
                }
            }
            
            console.log(`✅ Reverted ${revertedCount} album names`);
            
        } catch (error) {
            console.error('❌ Error reverting album names:', error);
        }
    }

    // Update songs to match reverted album names
    async updateSongsWithRevertedAlbums() {
        console.log('\n🔄 Updating songs with reverted album names...');
        
        try {
            const songsCollection = this.db.collection('songs');
            const albumsCollection = this.db.collection('albums');
            
            // Get all albums
            const albums = await albumsCollection.find({}).toArray();
            
            // Create a mapping of old names to new names
            const albumMapping = new Map();
            
            // First, create mappings from the original albums_list
            // For each album in the list, find matching songs
            for (const listAlbum of this.albumsList) {
                // Try to find the corresponding album in database
                const matchingAlbum = albums.find(dbAlbum => {
                    const dbTitle = dbAlbum.title.toLowerCase();
                    const listTitle = listAlbum.toLowerCase();
                    
                    // Check various matching patterns
                    if (dbTitle === listTitle) return true;
                    
                    // Remove artist prefixes for comparison
                    const dbClean = dbTitle.replace(/^(ac\/dc - |ac-dc |ac\s*d\s*c - |ac-dc|ac\/dc)\s*/i, '').trim();
                    const listClean = listTitle.replace(/^(ac\/dc - |ac-dc |ac\s*d\s*c - |ac-dc|ac\/dc)\s*/i, '').trim();
                    
                    return dbClean === listClean;
                });
                
                if (matchingAlbum) {
                    albumMapping.set(listAlbum, matchingAlbum.title);
                    
                    // Also map common variations
                    albumMapping.set(matchingAlbum.title, listAlbum);
                    
                    // Map with/without AC-DC variations
                    if (listAlbum.includes('AC-DC') || listAlbum.includes('AC/DC')) {
                        const withoutPrefix = listAlbum.replace(/^(AC[-/]DC|AC\s*D\s*C)\s*/i, '').trim();
                        albumMapping.set(withoutPrefix, listAlbum);
                        albumMapping.set(listAlbum, listAlbum);
                        
                        const withDash = listAlbum.replace(/^AC-DC /i, 'AC/DC - ');
                        albumMapping.set(withDash, listAlbum);
                        
                        const withSlash = listAlbum.replace(/^AC\/DC - /i, 'AC-DC ');
                        albumMapping.set(withSlash, listAlbum);
                    }
                }
            }
            
            console.log(`📊 Created ${albumMapping.size} album name mappings`);
            
            let updatedCount = 0;
            
            // Update songs with the mappings
            for (const [oldName, newName] of albumMapping) {
                const updateResult = await songsCollection.updateMany(
                    { album: oldName },
                    { $set: { album: newName } }
                );
                
                if (updateResult.modifiedCount > 0) {
                    console.log(`   Updated ${updateResult.modifiedCount} songs: "${oldName}" → "${newName}"`);
                    updatedCount += updateResult.modifiedCount;
                }
            }
            
            console.log(`✅ Updated ${updatedCount} songs with reverted album names`);
            
        } catch (error) {
            console.error('❌ Error updating songs:', error);
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

    // Main revert process
    async run() {
        console.log('🔄 Starting album name reversion...');
        console.log('⚠️  This will revert album names to match the folder structure');
        
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
            console.log('❌ Reversion cancelled');
            return;
        }
        
        this.loadAlbumsList();
        await this.connect();
        
        try {
            await this.showStats();
            await this.revertAlbumNames();
            await this.updateSongsWithRevertedAlbums();
            await this.showStats();
            
            console.log('\n✅ Album name reversion completed successfully!');
            
        } catch (error) {
            console.error('❌ Error during reversion:', error);
        } finally {
            await this.disconnect();
        }
    }
}

// Run the reversion
const reverter = new AlbumNameReverter();
reverter.run().catch(console.error);

