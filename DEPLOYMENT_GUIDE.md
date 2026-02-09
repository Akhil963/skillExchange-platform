# SkillSwap Platform - Deployment Guide

## Problem Summary
The Learning Dashboard was failing with CORS errors when deployed on Netlify because:
1. **Frontend** is deployed on `https://skillexchang.netlify.app`
2. **Backend** was running locally on `http://localhost:5000`
3. Browsers block cross-origin requests to loopback addresses for security

## Solutions

### For Local Development (Default - Already Fixed ✅)
The frontend now **automatically detects local development** and uses:
- API URL: `http://localhost:5000/api`
- Backend: Running locally with `npm run dev`
- **No changes needed!**

**To test locally:**
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Open frontend locally
http://localhost:5000 or http://localhost:3000
```

---

## Production Deployment Options

### **Option 1: Deploy Backend to External Server (RECOMMENDED)**
Best for Netlify + Separate Backend deployment

**Steps:**
1. **Deploy your Express backend** to a service like:
   - **Railway** (easiest, free tier available)
   - **Render** 
   - **Heroku**
   - **AWS, DigitalOcean, Linode, etc.**

2. **Update netlify.toml** - Uncomment and modify the redirect rule:
   ```toml
   # In netlify.toml, uncomment and replace with your backend URL:
   [[redirects]]
     from = "/api/*"
     to = "https://your-backend-url.com/api/:splat"
     status = 200
     force = true
   ```

3. **Update .env files** on your backend server with production URLs:
   ```env
   PORT=5000
   NODE_ENV=production
   CLIENT_URL=https://skillexchang.netlify.app
   MONGODB_URI=<your-production-mongodb-url>
   # ... other env variables
   ```

4. **Ensure CORS is configured** in `server/config/config.js`:
   ```javascript
   allowedOrigins: [
     'https://skillexchang.netlify.app',
     'https://your-backend-url.com',
     'http://localhost:5000' // Keep for local dev
   ]
   ```

5. **Deploy updated netlify.toml** to Netlify

**Frontend will automatically use:**
- Local dev: `http://localhost:5000/api`
- Production: `/api` (which redirects via Netlify to your backend)

---

### **Option 2: Use Netlify Functions (Alternative)**
Deploy backend as serverless functions on Netlify

**Current Status:**
- `netlify/functions/api.js` file already exists
- netlify.toml is configured for this
- But Express server is not migrated to functions yet

**To implement:**
1. Migrate Express routes to Netlify Functions format
2. Keep `server/` directory as reference
3. All API requests automatically route to `/.netlify/functions/api/:splat`

**Pros:** Single deployment, no separate backend server
**Cons:** Serverless cold starts, potential latency issues

---

### **Option 3: Docker Deployment**
Deploy both frontend and backend together

**Services:**
- Docker Compose available: `docker-compose.yml`
- Deploy to any Docker-compatible platform (AWS ECS, Railway, etc.)

---

## Current Netlify Configuration

### netlify.toml Details

**For local/test environment:**
```toml
# When testing locally, API_BASE in LearningDashboard.html is:
# http://localhost:5000/api
# The netlify.toml redirect doesn't affect local testing
```

**For production (after uncommenting):**
```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-backend-url.com/api/:splat"
  status = 200
  force = true
```

This redirect:
- Captures all requests to `/api/*` on your Netlify domain
- Forwards them to your backend server
- Returns response as if it came from your Netlify domain
- **Bypasses CORS issues** because the request originates from Netlify's servers, not the browser

---

## Frontend Configuration

### LearningDashboard.html - API URL Logic

The frontend now intelligently detects its environment:

```javascript
function getAPIBase() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isLocalhost) {
    // Local dev: use localhost backend
    return 'http://localhost:5000/api';
  } else if (window.location.protocol === 'https:') {
    // Production HTTPS: use relative path (netlify redirect)
    return '/api';
  } else {
    return '/api';
  }
}
```

**Result:**
- ✅ Local: `http://localhost:5000/api`
- ✅ Production: `/api` (redirects via netlify.toml to your backend)
- ✅ No hardcoded URLs
- ✅ Easy to switch backends

---

## Environment Variables to Set

### Local Development (.env)
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5000
MONGODB_URI=mongodb+srv://...
```

### Production (Backend Server)
```env
PORT=5000 (or whatever your host provides)
NODE_ENV=production
CLIENT_URL=https://skillexchang.netlify.app
MONGODB_URI=mongodb+srv://... (strong password, restricted IP)
# Email config
SMTP_HOST=...
SMTP_PORT=587
# Admin URLs
ADMIN_FRONTEND_URL=https://skillexchang.netlify.app/admin
```

### Production (Netlify)
*No backend env vars needed - they're only for redirect*
```env
# Optional - can be injected via Netlify UI if needed
```

---

## Error Handling Improvements

The dashboard now provides helpful error messages for different scenarios:

1. **No Backend Server**: Clear message with retry button
2. **CORS Error**: Detects and logs CORS issues
3. **Auth Error**: Redirects to login if session expired
4. **Network Error**: Suggests checking internet connection

---

## Testing Your Setup

### Step 1: Test Locally
```bash
npm run dev
# Navigate to http://localhost:5000/LearningDashboard.html
# Should load modules successfully
# Check console: "API Base URL: http://localhost:5000/api"
```

### Step 2: Deploy to Netlify
```bash
git push heroku main  # or use Netlify UI
# Deploy will build client and deploy to Netlify
```

### Step 3: Verify Frontend (Only)
```
https://skillexchang.netlify.app/LearningDashboard.html
# Check console: "API Base URL: /api"
# Should see: "Backend server not responding" (until you deploy backend)
```

### Step 4: Deploy Backend
Deploy your Express server to your chosen platform (Railway, Render, etc.)

### Step 5: Update netlify.toml
Uncomment the redirect rule and point to your backend URL

### Step 6: Final Test
```
https://skillexchang.netlify.app/LearningDashboard.html
# Should now load modules successfully!
```

---

## Quick Deploy to Railway (Recommended)

Railway makes it easy to deploy Node.js apps:

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init

# 4. Set environment variables
railway variables set NODE_ENV=production
railway variables set MONGODB_URI=<your-url>
railway variables set CLIENT_URL=https://skillexchang.netlify.app

# 5. Deploy
railway up

# Your backend will be at: https://your-project-*.railway.app
```

Then update netlify.toml:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-project-*.railway.app/api/:splat"
  status = 200
  force = true
```

---

## Troubleshooting

### Still getting CORS errors?
1. ✅ Verify netlify.toml redirect is correct
2. ✅ Check browser DevTools → Network → check `/api/*` requests
3. ✅ Verify backend server is running
4. ✅ Check backend CORS configuration allows your Netlify domain

### Getting "Backend not responding"?
1. ✅ Verify backend is deployed and running
2. ✅ Check netlify.toml redirect URL is correct
3. ✅ Test API directly: https://your-backend-url.com/api/auth/me
4. ✅ Check backend logs for errors

### Production API calls failing?
1. ✅ Check `API_BASE` is `/api` (not hardcoded localhost)
2. ✅ Verify netlify.toml has the correct redirect
3. ✅ Check backend environment variables are correct
4. ✅ Verify database connection in production

---

## Summary

| Scenario | API URL | Backend Location |
|----------|---------|-----------------|
| **Local Dev** | `http://localhost:5000/api` | Your machine |
| **Netlify + External Backend** | `/api` (redirects to backend) | Railway/Render/etc |
| **Netlify Functions** | `/api` (calls function) | Netlify |
| **Docker** | Same as deployment platform | Docker container |

**Next Steps:**
1. Pick your deployment option (recommend Option 1: External backend on Railway)
2. Deploy your Express backend
3. Update netlify.toml with your backend URL
4. Push changes to Netlify
5. Test and confirm it works!

