@echo off
REM Start Jukebox App with Location Verification

echo 🎵 Starting Jukebox App with Location Verification...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if API server is running
echo 🔍 Checking if API server is running...
curl -s http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️  API server not running. Starting API server...
    start "API Server" cmd /k "node api-server.js"
    echo ⏳ Waiting for API server to start...
    timeout /t 3 /nobreak >nul
) else (
    echo ✅ API server is already running
)

REM Start the app
echo 🚀 Opening Jukebox App...
echo.
echo 📍 Location verification is now enabled
echo    - Automatically checks location when app loads
echo    - Users must be within 50 meters of the venue
echo    - Configure venue location in admin.html
echo.

REM Open the main app
start "" "index.html"

echo ✅ Jukebox App opened in browser
echo.
echo 💡 Admin Configuration:
echo    - Open admin.html to configure venue location
echo    - Set latitude, longitude, and allowed distance
echo    - Test location settings before going live
echo.
pause
