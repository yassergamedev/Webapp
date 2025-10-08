#!/usr/bin/env node

// Simple script to help deploy API-only server
console.log('🚀 Jukebox API Server Deployment Helper');
console.log('');
console.log('📁 Files needed for API deployment:');
console.log('   ✅ api-only-server.js');
console.log('   ✅ package-api.json (rename to package.json)');
console.log('');
console.log('🌐 Deploy to Render:');
console.log('   1. Go to https://render.com');
console.log('   2. Click "New" → "Web Service"');
console.log('   3. Connect GitHub repository');
console.log('   4. Select your repository and branch');
console.log('   5. Configure:');
console.log('      - Name: jukebox-api');
console.log('      - Runtime: Node');
console.log('      - Build Command: npm install');
console.log('      - Start Command: npm start');
console.log('      - Environment Variables:');
console.log('        - MONGODB_URI: your-mongodb-connection-string');
console.log('');
console.log('🔗 After deployment, update your frontend:');
console.log('   Change apiBaseUrl in script.js to:');
console.log('   https://your-api-name.onrender.com/api');
console.log('');
console.log('✅ Your API will be available at:');
console.log('   https://your-api-name.onrender.com/api/albums');
console.log('   https://your-api-name.onrender.com/api/songs');
console.log('   https://your-api-name.onrender.com/api/tracklist');
console.log('   https://your-api-name.onrender.com/api/search');
console.log('   https://your-api-name.onrender.com/api/health');
