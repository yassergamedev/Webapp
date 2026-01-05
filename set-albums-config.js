#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('Usage: node set-albums-config.js <albums-folder-path> [cover-file-name]');
    console.log('');
    console.log('Examples:');
    console.log('  node set-albums-config.js "C:\\Music\\Albums"');
    console.log('  node set-albums-config.js "/home/user/music/albums" "cover"');
    console.log('  node set-albums-config.js "D:\\Jukebox\\Albums" "album-art"');
    process.exit(1);
}

const albumsFolderPath = args[0];
const coverFileName = args[1] || 'cover';

// Create config object
const config = {
    albumsFolderPath: albumsFolderPath,
    coverFileName: coverFileName,
    updatedAt: new Date().toISOString()
};

// Save to config file
const configPath = join(__dirname, 'albums-config.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ Albums configuration saved successfully!');
console.log(`📁 Albums folder: ${albumsFolderPath}`);
console.log(`🖼️ Cover file name: ${coverFileName}`);
console.log(`💾 Config file: ${configPath}`);
console.log('');
console.log('🔄 Please restart the server to apply the new configuration.');


