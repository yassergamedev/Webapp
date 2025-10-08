# Local Jukebox Deployment Guide

## Network Configuration

### Your Setup:
- **Hub IP:** `192.168.50.100`
- **Port Forward:** Port 80 → Hub (192.168.50.100:80)
- **Domain:** `jukebox.8bitbar.com.au` → Your WAN IP
- **Public Access:** `http://jukebox.8bitbar.com.au`

## Deployment Steps

### 1. Copy Files to Hub
Copy these files to your hub at `192.168.50.100`:
- `api-server.js` (main server file)
- `index.html` (frontend)
- `styles.css` (frontend styles)
- `script.js` (frontend logic)
- `package.json` (dependencies)
- `start-jukebox.sh` (Linux startup script)
- `start-jukebox.bat` (Windows startup script)

### 2. Install Dependencies
On your hub, run:
```bash
npm install
```

### 3. Start the Server

#### Linux/Mac:
```bash
chmod +x start-jukebox.sh
./start-jukebox.sh
```

#### Windows:
```cmd
start-jukebox.bat
```

#### Manual Start:
```bash
PORT=80 node api-server.js
```

### 4. Test Access
- **Local:** `http://192.168.50.100`
- **Public:** `http://jukebox.8bitbar.com.au`
- **API Health:** `http://jukebox.8bitbar.com.au/api/health`

## Configuration

### Environment Variables
- `PORT=80` (default port for web traffic)
- `MONGODB_URI` (your MongoDB connection string)

### Firewall Rules
Make sure port 80 is open on your router and hub:
- **Router:** Port forward 80 → 192.168.50.100:80
- **Hub:** Allow incoming connections on port 80

## Features Available

### Frontend (Web Interface):
- ✅ Location check
- ✅ Album browsing
- ✅ Song search
- ✅ Add songs to queue
- ✅ View current playlist
- ✅ Real-time updates

### API Endpoints:
- `GET /api/albums` - Get all albums
- `GET /api/songs` - Get all songs
- `GET /api/songs/album/:title` - Get songs by album
- `GET /api/tracklist` - Get current playlist
- `POST /api/tracklist` - Add song to playlist
- `GET /api/search?q=query` - Search songs/albums
- `GET /api/health` - Health check

## Troubleshooting

### Server Won't Start:
1. Check if port 80 is available: `netstat -tulpn | grep :80`
2. Try running as root: `sudo node api-server.js`
3. Check Node.js version: `node --version`

### Can't Access from Internet:
1. Verify port forwarding on router
2. Check domain DNS settings
3. Test local access first: `http://192.168.50.100`

### MongoDB Connection Issues:
1. Check internet connection on hub
2. Verify MongoDB URI in environment variables
3. Test connection: `http://jukebox.8bitbar.com.au/api/health`

## Security Notes

- The server runs on port 80 (HTTP) - consider HTTPS for production
- MongoDB connection is secured with authentication
- CORS is enabled for cross-origin requests
- No authentication required for the jukebox interface

## Maintenance

### Restart Server:
```bash
# Find process
ps aux | grep node

# Kill process
kill <PID>

# Restart
./start-jukebox.sh
```

### Update Code:
1. Copy new files to hub
2. Restart server
3. Test functionality

### Logs:
Server logs are displayed in the console. For production, consider redirecting to a log file:
```bash
node api-server.js > jukebox.log 2>&1 &
```
