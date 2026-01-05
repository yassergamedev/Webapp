# Jukebox Server Troubleshooting Guide

## Common Issues and Solutions

### 1. Server Stops Immediately

**Problem:** The server starts but stops right away without any error message.

**Solutions:**
- **Port 80 requires admin privileges:** Run Command Prompt as Administrator
- **Port already in use:** Use `start-jukebox-dev.bat` for testing on port 3000
- **Missing dependencies:** Run `npm install` first

### 2. "Port 80 is already in use" Error

**Problem:** Another service is using port 80.

**Solutions:**
- **Use development mode:** Run `start-jukebox-dev.bat` (uses port 3000)
- **Stop conflicting service:** 
  ```cmd
  net stop http
  ```
- **Find what's using port 80:**
  ```cmd
  netstat -ano | findstr :80
  ```

### 3. "Not running as administrator" Warning

**Problem:** Port 80 requires administrator privileges.

**Solutions:**
- **Run as admin:** Right-click Command Prompt → "Run as administrator"
- **Use development mode:** Run `start-jukebox-dev.bat` instead
- **Change port:** Modify `PORT=3000` in the script

### 4. MongoDB Connection Failed

**Problem:** Can't connect to MongoDB Atlas.

**Solutions:**
- **Check internet connection**
- **Verify MongoDB URI** in environment variables
- **Check MongoDB Atlas IP whitelist** (add your IP)
- **Test connection:** Visit `/api/health` endpoint

### 5. "Node.js is not installed" Error

**Problem:** Node.js is not installed or not in PATH.

**Solutions:**
- **Install Node.js:** Download from [nodejs.org](https://nodejs.org)
- **Restart Command Prompt** after installation
- **Check installation:** Run `node --version`

### 6. "npm is not installed" Error

**Problem:** npm is not available.

**Solutions:**
- **Reinstall Node.js** (npm comes with Node.js)
- **Check PATH environment variable**
- **Restart Command Prompt**

## Quick Fixes

### For Testing (No Admin Required):
```cmd
start-jukebox-dev.bat
```
- Uses port 3000
- No administrator privileges needed
- Access via: `http://192.168.50.5:3000`

### For Production (Admin Required):
```cmd
start-jukebox.bat
```
- Uses port 80
- Requires administrator privileges
- Access via: `http://jukebox.8bitbar.com.au`

### Manual Start:
```cmd
set PORT=3000
set MONGODB_URI=your-mongodb-uri
node api-server.js
```

## Testing Your Setup

1. **Check if server is running:**
   - Visit: `http://192.168.50.5:3000` (dev) or `http://192.168.50.5` (prod)
   - Should see the jukebox interface

2. **Test API endpoints:**
   - Health: `http://192.168.50.5:3000/api/health`
   - Albums: `http://192.168.50.5:3000/api/albums`
   - Tracklist: `http://192.168.50.5:3000/api/tracklist`

3. **Check console output:**
   - Look for "✅ Connected to MongoDB"
   - Look for "🚀 API Server running on..."

## Still Having Issues?

1. **Check the console output** for specific error messages
2. **Try the development version** first: `start-jukebox-dev.bat`
3. **Verify your network setup:**
   - Hub IP: `192.168.50.5`
   - Port forwarding: 80 → 192.168.50.5:80
   - Domain: `jukebox.8bitbar.com.au`


