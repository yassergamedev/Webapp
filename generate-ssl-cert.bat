@echo off
REM Generate self-signed SSL certificate for testing
REM Note: This creates a self-signed certificate that browsers will warn about

echo 🔐 Generating self-signed SSL certificate for testing...
echo ⚠️  WARNING: This creates a self-signed certificate that browsers will warn about
echo    For production, use a real certificate from a trusted CA
echo.

REM Check if OpenSSL is available
openssl version >nul 2>&1
if errorlevel 1 (
    echo ❌ OpenSSL is not installed or not in PATH
    echo    Please install OpenSSL or use a different method to generate certificates
    echo.
    echo    Alternative: Download certificates from your domain provider
    echo    and place them in the ssl folder as:
    echo    - ssl\private.key
    echo    - ssl\certificate.crt
    pause
    exit /b 1
)

REM Create ssl directory if it doesn't exist
if not exist "ssl" (
    echo 📁 Creating ssl directory...
    mkdir ssl
)

REM Generate private key
echo 🔑 Generating private key...
openssl genrsa -out ssl\private.key 2048
if errorlevel 1 (
    echo ❌ Failed to generate private key
    pause
    exit /b 1
)

REM Generate certificate
echo 📜 Generating certificate...
openssl req -new -x509 -key ssl\private.key -out ssl\certificate.crt -days 365 -subj "/C=AU/ST=NSW/L=Sydney/O=8bitbar/OU=IT/CN=jukebox.8bitbar.com.au"
if errorlevel 1 (
    echo ❌ Failed to generate certificate
    pause
    exit /b 1
)

echo ✅ SSL certificate generated successfully!
echo.
echo 📁 Files created:
echo    - ssl\private.key (private key)
echo    - ssl\certificate.crt (certificate)
echo.
echo 🚀 You can now run: start-jukebox-https.bat
echo.
echo ⚠️  Note: Browsers will show a security warning for self-signed certificates
echo    Click "Advanced" and "Proceed to site" to continue
echo.
pause


