@echo off
REM Jukebox Server Startup Script for Windows (Development/Testing)
REM For deployment on hub at 192.168.50.5

echo 🎵 Starting Jukebox Server (Development Mode)...
echo 📍 Hub IP: 192.168.50.5
echo 🌐 Domain: jukebox.8bitbar.com.au
echo 🔌 Port: 3000 (Development - no admin required)
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Set environment variables
set PORT=3000
set MONGODB_URI=mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox

REM Start the server
echo 🚀 Starting server on port 3000...
echo 🌐 Access via: http://jukebox.8bitbar.com.au:3000
echo 🏠 Local access: http://192.168.50.5:3000
echo 📡 API endpoints: http://jukebox.8bitbar.com.au:3000/api/*
echo.
echo Press Ctrl+C to stop the server
echo.

node api-server.js
if errorlevel 1 (
    echo ❌ Server failed to start. Check the error messages above.
    pause
)

