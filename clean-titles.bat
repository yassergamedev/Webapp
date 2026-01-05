@echo off
REM Clean song and album titles in MongoDB

echo 🧹 Cleaning song and album titles in MongoDB...
echo This will remove .mp3, .wav, .flac extensions and track numbers
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Run the cleaning script
echo 🚀 Starting title cleaning...
node clean-all-titles.js

echo.
echo ✅ Title cleaning completed!
pause


