#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🚀 Jukebox Webapp Deployment Helper\n');

// Check if required files exist
const requiredFiles = ['index.html', 'script.js', 'styles.css', 'api-server.js', 'package.json'];
const missingFiles = requiredFiles.filter(file => !existsSync(file));

if (missingFiles.length > 0) {
    console.error('❌ Missing required files:', missingFiles.join(', '));
    process.exit(1);
}

console.log('✅ All required files found');

// Check if dependencies are installed
if (!existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencies installed');
    } catch (error) {
        console.error('❌ Failed to install dependencies:', error.message);
        process.exit(1);
    }
}

console.log('\n🎯 Ready for deployment!');
console.log('\nChoose your deployment method:');
console.log('1. Railway (Recommended) - Push to GitHub and connect at railway.app');
console.log('2. Heroku - Run: heroku create && git push heroku main');
console.log('3. Render - Connect GitHub repo at render.com');
console.log('4. Vercel - Run: vercel --prod');
console.log('5. Local test - Run: npm start');

console.log('\n📋 Don\'t forget to set environment variables:');
console.log('   MONGODB_URI=your_mongodb_connection_string');
console.log('   PORT=3001');

console.log('\n📁 Files to deploy:');
requiredFiles.forEach(file => console.log(`   ✅ ${file}`));

console.log('\n🌐 After deployment, your app will serve:');
console.log('   - Frontend: index.html, script.js, styles.css');
console.log('   - Backend API: /api/* endpoints');
console.log('   - MongoDB integration: albums, songs, tracklist');
