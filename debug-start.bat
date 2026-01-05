@echo on
REM Debug version to see exactly what's happening

echo 🎵 Starting Jukebox Server (Debug Mode)...
echo 📍 Hub IP: 192.168.50.5
echo 🌐 Domain: jukebox.8bitbar.com.au
echo 🔌 Port: 3000
echo.

echo [DEBUG] Checking Node.js installation...
node --version
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    pause
    exit /b 1
) else (
    echo ✅ Node.js found
)

echo [DEBUG] Checking npm installation...
npm --version
if errorlevel 1 (
    echo ❌ npm is not installed or not in PATH
    pause
    exit /b 1
) else (
    echo ✅ npm found
)

echo [DEBUG] Checking if node_modules exists...
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo ✅ Dependencies already installed
)

echo [DEBUG] Setting environment variables...
set PORT=3000
set MONGODB_URI=mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox

echo [DEBUG] Environment variables set:
echo   PORT=%PORT%
echo   MONGODB_URI=%MONGODB_URI%

echo [DEBUG] Checking if api-server.js exists...
if not exist "api-server.js" (
    echo ❌ api-server.js not found in current directory
    echo [DEBUG] Current directory contents:
    dir
    pause
    exit /b 1
) else (
    echo ✅ api-server.js found
)

echo [DEBUG] Starting server...
echo 🚀 Starting server on port 3000...
echo 🌐 Access via: http://jukebox.8bitbar.com.au:3000
echo 🏠 Local access: http://192.168.50.5:3000
echo 📡 API endpoints: http://jukebox.8bitbar.com.au:3000/api/*
echo.
echo Press Ctrl+C to stop the server
echo.

node api-server.js
echo [DEBUG] Server exited with code: %errorlevel%
if errorlevel 1 (
    echo ❌ Server failed to start. Error code: %errorlevel%
    pause
)

