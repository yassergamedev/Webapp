# Railway Deployment Guide - Jukebox Webapp

## 🚀 Deploy to Railway (Recommended)

Railway is much more reliable than Vercel for full-stack Node.js apps!

### Step 1: Prepare Your Code
Your code is already ready! Railway will use:
- `api-server.js` - Main server (serves both frontend and API)
- `package.json` - Dependencies
- `railway.json` - Railway configuration

### Step 2: Deploy to Railway

**Option A: Using Railway CLI (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy
railway deploy

# Set environment variable
railway variables set MONGODB_URI="your_mongodb_connection_string"
```

**Option B: Using Railway Dashboard (Easier)**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js and deploy
6. Go to "Variables" tab
7. Add: `MONGODB_URI` = `your_mongodb_connection_string`
8. Deploy!

### Step 3: Set Environment Variables
In Railway dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add: `MONGODB_URI` = `mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox`

### Step 4: Test Your App
Your app will be available at:
- **Railway URL:** `https://your-project-name.railway.app`

## 🎯 Why Railway is Better

✅ **No API routing issues** - Handles Node.js servers perfectly
✅ **No authentication required** - Apps are public by default
✅ **Better for full-stack apps** - Designed for backend + frontend
✅ **Simpler deployment** - Just push to GitHub
✅ **Real MongoDB connection** - No serverless function limitations

## 🔧 How It Works

**Railway will:**
1. **Detect Node.js** automatically
2. **Install dependencies** from package.json
3. **Start api-server.js** as the main process
4. **Serve your app** at the Railway URL
5. **Connect to MongoDB** using environment variables

## 📁 Files Railway Uses

```
jukebox-webapp/
├── api-server.js          # Main server (frontend + API)
├── package.json           # Dependencies
├── railway.json           # Railway configuration
├── index.html             # Frontend
├── script.js              # Frontend logic
├── styles.css             # Frontend styling
└── .gitignore             # Git ignore
```

## 🧪 Testing After Deployment

1. **Open your Railway URL**
2. **Allow location access**
3. **Test features:**
   - View albums (should load from MongoDB)
   - Search songs (should work with real data)
   - Add songs to queue (should save to MongoDB)
   - Check playlist status

## 🐛 Troubleshooting

**Common Issues:**
- **MongoDB connection:** Check MONGODB_URI variable
- **App not loading:** Check Railway logs
- **API errors:** Check that api-server.js is running

**Check Logs:**
- Go to Railway dashboard → "Deployments" → "View Logs"

Your jukebox webapp will work perfectly on Railway! 🎉
