@echo off
REM Jukebox Server Startup Script for Windows (HTTPS)
REM For deployment on hub at 192.168.50.5

echo 🎵 Starting Jukebox Server (HTTPS Mode)...
echo 📍 Hub IP: 192.168.50.5
echo 🌐 Domain: jukebox.8bitbar.com.au
echo 🔌 HTTPS Port: 443
echo 🔌 HTTP Port: 80 (redirects to HTTPS)
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

REM Check for SSL certificates
if not exist "ssl" (
    echo 📁 Creating SSL directory...
    mkdir ssl
)

if not exist "ssl\private.key" (
    echo ⚠️  SSL certificates not found!
    echo    Please place your SSL certificates in the ssl folder:
    echo    - ssl\private.key (private key)
    echo    - ssl\certificate.crt (certificate)
    echo.
    echo    Or set environment variables:
    echo    - SSL_KEY_PATH=path\to\private.key
    echo    - SSL_CERT_PATH=path\to\certificate.crt
    echo.
    echo    The server will start in HTTP mode without SSL.
    echo.
)

REM Set environment variables
set HTTP_PORT=80
set HTTPS_PORT=443
set MONGODB_URI=mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox

REM Set SSL paths if certificates exist
if exist "ssl\private.key" (
    set SSL_KEY_PATH=ssl\private.key
)
if exist "ssl\certificate.crt" (
    set SSL_CERT_PATH=ssl\certificate.crt
)

REM Start the server
echo 🚀 Starting server...
echo 🌐 HTTPS access: https://jukebox.8bitbar.com.au
echo 🏠 Local HTTPS: https://192.168.50.5
echo 🔄 HTTP redirects: http://jukebox.8bitbar.com.au (redirects to HTTPS)
echo 📡 API endpoints: https://jukebox.8bitbar.com.au/api/*
echo.
echo Press Ctrl+C to stop the server
echo.

node api-server.js
if errorlevel 1 (
    echo ❌ Server failed to start. Check the error messages above.
    echo    Common issues:
    echo    - Port 80/443 already in use
    echo    - Not running as administrator
    echo    - MongoDB connection failed
    echo    - SSL certificate issues
    pause
)


