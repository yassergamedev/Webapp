# Jukebox API Server Deployment

This is the **API-only** version of the jukebox server, designed to be deployed separately from the frontend.

## Files for API Deployment

- `api-only-server.js` - Clean API server (no static file serving)
- `package-api.json` - Dependencies for API server only
- `API_DEPLOYMENT.md` - This deployment guide

## Deploy to Render

### Option 1: Deploy from GitHub (Recommended)

1. **Create a new repository** for the API server:
   ```bash
   mkdir jukebox-api
   cd jukebox-api
   git init
   ```

2. **Copy the API files**:
   - Copy `api-only-server.js` to the new repo
   - Copy `package-api.json` and rename it to `package.json`

3. **Commit and push**:
   ```bash
   git add .
   git commit -m "Initial API server"
   git branch -M main
   git remote add origin https://github.com/yourusername/jukebox-api.git
   git push -u origin main
   ```

4. **Deploy on Render**:
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the `jukebox-api` repository
   - Configure:
     - **Name**: `jukebox-api`
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment Variables**:
       - `MONGODB_URI`: Your MongoDB connection string

### Option 2: Deploy from Current Repository

1. **Create a new branch** for API-only:
   ```bash
   git checkout -b api-only
   ```

2. **Replace package.json**:
   ```bash
   cp package-api.json package.json
   ```

3. **Commit the changes**:
   ```bash
   git add .
   git commit -m "Create API-only deployment branch"
   git push origin api-only
   ```

4. **Deploy on Render**:
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the `api-only` branch
   - Configure the same settings as above

## Environment Variables

Set these in your Render dashboard:

- `MONGODB_URI`: Your MongoDB Atlas connection string
- `PORT`: (Optional) Render will set this automatically

## API Endpoints

Once deployed, your API will be available at:
- `https://your-api-name.onrender.com/api/albums`
- `https://your-api-name.onrender.com/api/songs`
- `https://your-api-name.onrender.com/api/tracklist`
- `https://your-api-name.onrender.com/api/search?q=query`
- `https://your-api-name.onrender.com/api/health`

## Update Frontend

After deploying the API, update your frontend's `script.js`:

```javascript
this.apiBaseUrl = 'https://your-api-name.onrender.com/api';
```

## Testing

Test your deployed API:
- Visit `https://your-api-name.onrender.com` for API info
- Visit `https://your-api-name.onrender.com/api/health` for health check
- Visit `https://your-api-name.onrender.com/api/test` for basic test
