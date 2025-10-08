#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🚀 Railway Deployment Helper for Jukebox Webapp\n');

// Check if required files exist
const requiredFiles = ['api-server.js', 'package.json', 'index.html', 'script.js', 'styles.css'];
const missingFiles = requiredFiles.filter(file => !existsSync(file));

if (missingFiles.length > 0) {
    console.error('❌ Missing required files:', missingFiles.join(', '));
    process.exit(1);
}

console.log('✅ All required files found');

// Check if Railway CLI is installed
try {
    execSync('railway --version', { stdio: 'pipe' });
    console.log('✅ Railway CLI is installed');
} catch (error) {
    console.log('📦 Installing Railway CLI...');
    try {
        execSync('npm install -g @railway/cli', { stdio: 'inherit' });
        console.log('✅ Railway CLI installed');
    } catch (installError) {
        console.error('❌ Failed to install Railway CLI:', installError.message);
        console.log('\n💡 Alternative: Use Railway dashboard at railway.app');
        process.exit(1);
    }
}

console.log('\n🎯 Ready for Railway deployment!');
console.log('\nNext steps:');
console.log('1. Run: railway login');
console.log('2. Run: railway deploy');
console.log('3. Set environment variable: railway variables set MONGODB_URI="your_connection_string"');
console.log('4. Your app will be live at: https://your-project.railway.app');

console.log('\n📋 Or use Railway dashboard:');
console.log('1. Go to railway.app');
console.log('2. Connect your GitHub repo');
console.log('3. Add MONGODB_URI environment variable');
console.log('4. Deploy!');

console.log('\n🌐 After deployment:');
console.log('- Your app will be publicly accessible');
console.log('- No authentication required');
console.log('- Real MongoDB connection');
console.log('- All features working: albums, songs, tracklist');
