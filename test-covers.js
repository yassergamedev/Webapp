#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load current config
let config = {
    albumsFolderPath: '/home/arcade/Webapp/albums',
    coverFileName: 'cover'
};

try {
    const configPath = join(__dirname, 'albums-config.json');
    if (existsSync(configPath)) {
        const configData = readFileSync(configPath, 'utf8');
        config = { ...config, ...JSON.parse(configData) };
    }
} catch (error) {
    console.log('No config file found, using defaults');
}

console.log('🔍 Current Albums Configuration:');
console.log(`📁 Albums folder: ${config.albumsFolderPath}`);
console.log(`🖼️ Cover file name: ${config.coverFileName}`);
console.log('');

// Check if folder exists
if (!existsSync(config.albumsFolderPath)) {
    console.log(`❌ Albums folder does not exist: ${config.albumsFolderPath}`);
    console.log('');
    console.log('Please set the correct albums folder path using:');
    console.log(`node set-albums-config.js "your/albums/folder/path"`);
    process.exit(1);
}

console.log(`✅ Albums folder exists: ${config.albumsFolderPath}`);
console.log('');

// List folder contents
try {
    const contents = readdirSync(config.albumsFolderPath);
    console.log(`📂 Found ${contents.length} items in albums folder:`);
    contents.slice(0, 10).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item}`);
    });
    if (contents.length > 10) {
        console.log(`  ... and ${contents.length - 10} more items`);
    }
    console.log('');

    // Test a few album folders for covers
    console.log('🔍 Testing for cover files in first few albums:');
    let foundCovers = 0;
    let totalChecked = 0;
    
    for (const albumFolder of contents.slice(0, 5)) {
        const albumPath = join(config.albumsFolderPath, albumFolder);
        if (existsSync(albumPath)) {
            totalChecked++;
            const albumContents = readdirSync(albumPath);
            const coverFiles = albumContents.filter(file => 
                file.toLowerCase().startsWith(config.coverFileName.toLowerCase()) &&
                (file.toLowerCase().endsWith('.jpg') || 
                 file.toLowerCase().endsWith('.jpeg') || 
                 file.toLowerCase().endsWith('.png') ||
                 file.toLowerCase().endsWith('.gif') ||
                 file.toLowerCase().endsWith('.webp'))
            );
            
            if (coverFiles.length > 0) {
                console.log(`  ✅ ${albumFolder}: Found ${coverFiles.join(', ')}`);
                foundCovers++;
            } else {
                console.log(`  ❌ ${albumFolder}: No cover files found`);
                console.log(`     Available files: ${albumContents.slice(0, 3).join(', ')}${albumContents.length > 3 ? '...' : ''}`);
            }
        }
    }
    
    console.log('');
    console.log(`📊 Summary: Found covers in ${foundCovers}/${totalChecked} checked albums`);
    
    if (foundCovers === 0) {
        console.log('');
        console.log('💡 Tips:');
        console.log('1. Make sure each album folder contains a cover image');
        console.log('2. Cover files should be named "cover.jpg", "cover.png", etc.');
        console.log('3. You can change the cover file name using:');
        console.log(`   node set-albums-config.js "${config.albumsFolderPath}" "your-cover-name"`);
    }
    
} catch (error) {
    console.error('Error reading albums folder:', error);
}


