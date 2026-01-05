#!/bin/bash

# Jukebox Server Startup Script
# For deployment on hub at 192.168.50.5

echo "🎵 Starting Jukebox Server..."
echo "📍 Hub IP: 192.168.50.5"
echo "🌐 Domain: jukebox.8bitbar.com.au"
echo "🔌 Port: 80"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set environment variables
export PORT=80
export MONGODB_URI="mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox"

# Start the server
echo "🚀 Starting server on port 80..."
echo "🌐 Access via: http://jukebox.8bitbar.com.au"
echo "🏠 Local access: http://192.168.50.5"
echo "📡 API endpoints: http://jukebox.8bitbar.com.au/api/*"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node api-server.js
