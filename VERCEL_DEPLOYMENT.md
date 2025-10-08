# Vercel Deployment Guide for Jukebox Webapp

## 🚀 Quick Deploy to Vercel

### Step 1: Prepare Your Code
Your code is already ready! The following files are set up for Vercel:
- ✅ `api-server.js` - Main server file
- ✅ `vercel.json` - Vercel configuration
- ✅ `package.json` - Dependencies
- ✅ `index.html`, `script.js`, `styles.css` - Frontend files

### Step 2: Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variable
vercel env add MONGODB_URI
# Enter your MongoDB connection string when prompted
```

**Option B: Using Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the configuration
5. Add environment variable: `MONGODB_URI=your_connection_string`
6. Click "Deploy"

### Step 3: Set Environment Variables
In your Vercel dashboard:
1. Go to your project
2. Click "Settings" → "Environment Variables"
3. Add: `MONGODB_URI` = `your_mongodb_connection_string`
4. Redeploy if needed

## 🔧 How It Works

**Vercel Configuration (`vercel.json`):**
- Routes `/api/*` requests to `api-server.js`
- Routes static files (HTML, CSS, JS) to `api-server.js`
- Routes root `/` to `api-server.js`

**Your App Structure:**
- **Frontend:** Served by `api-server.js` at root URL
- **Backend API:** Available at `/api/*` endpoints
- **MongoDB:** Connected via environment variable

## 🌐 After Deployment

Your app will be available at:
- **Production:** `https://your-project-name.vercel.app`
- **Preview:** `https://your-project-name-git-branch.vercel.app`

## 🧪 Testing Your Deployment

1. **Open your Vercel URL**
2. **Test the app:**
   - Allow location access
   - Login with any credentials
   - View albums
   - Search songs
   - Add songs to queue

## 🐛 Troubleshooting

**Common Issues:**

1. **"No Output Directory" Error:**
   - ✅ Fixed with `vercel.json` configuration
   - Make sure `vercel.json` is in your project root

2. **MongoDB Connection Issues:**
   - Check `MONGODB_URI` environment variable
   - Ensure MongoDB Atlas allows connections from Vercel IPs

3. **Static Files Not Loading:**
   - Check that all files are in the same directory as `api-server.js`
   - Verify `vercel.json` routes are correct

4. **API Endpoints Not Working:**
   - Check that routes in `vercel.json` include `/api/*`
   - Verify `api-server.js` is the main file

**Debug Steps:**
1. Check Vercel function logs in dashboard
2. Use `console.log()` in your code for debugging
3. Test API endpoints directly: `https://your-app.vercel.app/api/health`

## 📁 Required Files for Vercel

```
jukebox-webapp/
├── api-server.js          # Main server file
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
├── index.html             # Frontend HTML
├── script.js              # Frontend JavaScript
├── styles.css             # Frontend CSS
└── .gitignore             # Git ignore file
```

## 🎯 Next Steps

After successful deployment:
1. **Test all features** on the live URL
2. **Set up custom domain** (optional)
3. **Configure MongoDB Atlas** for production
4. **Monitor logs** in Vercel dashboard

Your jukebox webapp is now live! 🎉
