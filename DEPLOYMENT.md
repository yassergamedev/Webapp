# Jukebox Webapp Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Railway (Recommended - Free)
1. **Connect GitHub:**
   - Push your code to GitHub
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repo

2. **Deploy:**
   - Railway auto-detects Node.js
   - Sets up environment variables
   - Deploys automatically

3. **Environment Variables:**
   ```
   MONGODB_URI=your_mongodb_connection_string
   PORT=3001
   ```

### Option 2: Heroku (Free tier available)
1. **Install Heroku CLI:**
   ```bash
   npm install -g heroku
   ```

2. **Deploy:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   heroku create your-jukebox-app
   heroku config:set MONGODB_URI=your_mongodb_connection_string
   git push heroku main
   ```

3. **Open app:**
   ```bash
   heroku open
   ```

### Option 3: Render (Free tier available)
1. **Connect GitHub:**
   - Go to [render.com](https://render.com)
   - Connect your GitHub repo

2. **Configure:**
   - Service Type: Web Service
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Environment Variables:**
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

### Option 4: Vercel (Frontend + Serverless)
1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Environment Variables:**
   - Add `MONGODB_URI` in Vercel dashboard

## 📁 Files to Deploy

**Required files:**
- `index.html` - Main webapp
- `script.js` - Frontend logic
- `styles.css` - Styling
- `api-server.js` - Backend API + Static file server
- `package.json` - Dependencies

**Optional files:**
- `websocket-server.js` - If you want WebSocket functionality
- `server-static.js` - Not needed (api-server.js serves static files)

## 🔧 Environment Setup

**Required Environment Variables:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
PORT=3001
```

**MongoDB Atlas Setup:**
1. Create cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Get connection string
3. Add to environment variables

## 🌐 After Deployment

Your app will be available at:
- **Railway:** `https://your-app-name.railway.app`
- **Heroku:** `https://your-app-name.herokuapp.com`
- **Render:** `https://your-app-name.onrender.com`
- **Vercel:** `https://your-app-name.vercel.app`

## 🔍 Testing

1. **Open your deployed URL**
2. **Allow location access**
3. **Login with any credentials**
4. **Test features:**
   - View albums
   - Search songs
   - Add songs to queue
   - Check playlist status

## 🐛 Troubleshooting

**Common Issues:**
- **CORS errors:** Make sure CORS is enabled in api-server.js
- **MongoDB connection:** Check MONGODB_URI environment variable
- **Static files not loading:** Check file paths in api-server.js
- **Port issues:** Use process.env.PORT || 3001

**Logs:**
- Check deployment platform logs for errors
- Use `console.log()` for debugging
