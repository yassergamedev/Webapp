// Simple test script to check if the server is working
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
};

console.log('🧪 Testing server connection...');
console.log('📍 Testing: http://localhost:3000/api/health');

const req = http.request(options, (res) => {
    console.log(`✅ Server responded with status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('📄 Response data:', data);
        if (res.statusCode === 200) {
            console.log('🎉 Server is working correctly!');
        } else {
            console.log('❌ Server returned an error');
        }
    });
});

req.on('error', (err) => {
    console.error('❌ Connection failed:', err.message);
    console.log('💡 Make sure the server is running on port 3000');
});

req.end();


