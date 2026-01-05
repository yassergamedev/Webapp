// Fix Location Configuration Script
// This script clears any incorrect location configuration and sets the correct Seattle coordinates

console.log('🔧 Fixing location configuration...');

// Clear any existing configuration
localStorage.removeItem('jukeboxLocationConfig');

// Set the correct configuration for Seattle, WA
const correctConfig = {
    venueName: "8-Bit Bar",
    address: "Seattle, WA, USA",
    latitude: 47.4798,
    longitude: -122.2049,
    allowedDistance: 50
};

// Save the correct configuration
localStorage.setItem('jukeboxLocationConfig', JSON.stringify(correctConfig));

console.log('✅ Location configuration fixed!');
console.log('📍 New coordinates: 47.4798° N, 122.2049° W (Seattle, WA)');
console.log('📏 Allowed distance: 50 meters');

// Verify the configuration was saved
const savedConfig = localStorage.getItem('jukeboxLocationConfig');
if (savedConfig) {
    const config = JSON.parse(savedConfig);
    console.log('🔍 Saved configuration:', config);
} else {
    console.error('❌ Failed to save configuration');
}

console.log('🎵 You can now test the jukebox app - it should work correctly from the bar!');
