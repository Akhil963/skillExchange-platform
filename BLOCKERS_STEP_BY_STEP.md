# 🚀 CRITICAL BLOCKERS: STEP-BY-STEP GUIDE
## Get These 4 Things Done Before Production Launch

---

## BLOCKER #1: CREDENTIAL ROTATION (1 HOUR)
### Current Risk: Your real credentials are exposed

### Step 1: Generate New JWT Secrets (2 min)
Run these commands in PowerShell:

```powershell
# Generate JWT_SECRET (copy the entire output)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Example output:
# JWT_SECRET=a3f8c2e9b1d4f7a0e5b9c3f2d8e1a4b7c9f2e5d8a1b4c7f0e3d6a9c2f5b8e

# Generate ADMIN_JWT_SECRET (different, copy it too)
node -e "console.log('ADMIN_JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Example output:
# ADMIN_JWT_SECRET=f7e4b1c8a3d0f9e2c5b8a1d4e7f0c3a6d9f2c5e8a1d4b7c0f3e6a9d2c5f8
```

**What to do:**
- [ ] Copy both outputs to a secure place (password manager, secure note)
- [ ] Do NOT share or commit to git

---

### Step 2: Change MongoDB Password (10 min)

**Go to MongoDB Atlas:**
1. Open https://cloud.mongodb.com
2. Login with your account
3. Click your cluster name
4. Go to **Security** → **Database Access**
5. Find user "akhileshbhandakkar9637" and click **EDIT**
6. Click **Edit Password**
7. Choose **"Autogenerate secure password"**
8. Click **Generate Password**
9. **Copy the new password** (you'll see it once)
10. Click **Update User**

**Result example:**
```
Old: mongodb+srv://xxxxxxxxxxxxxxxxxxxxxxxxx:asdadadadadadad@skillexchange.d9otv1g.mongodb.net/
New: mongodb+srv://xxxxxxxxxxxxxxxxxxxxxxxxx:xxxxxxxxxxxxxxxxxx@skillexchange.d9otv1g.mongodb.net/
```

**Test new connection:**
```powershell
# Use the NEW connection string from Atlas
# If you have mongosh installed:
mongosh "mongodb+srv://akghfyhfujkkar9637:NEWPASSWORD@skillexchange.d9otv1g.mongodb.net/skillExchange"

# If it connects without error: ✅ Success
```

---

### Step 3: Change Gmail App Password (10 min)

**Go to Google Account:**
1. Open https://myaccount.google.com
2. Login with: akhileshbhandakkar9637@gmail.com
3. Go to **Security** (left sidebar)
4. Find **App passwords** (may require 2FA verification)
5. Select: **Mail** and **Windows Computer**
6. Click **Generate**
7. Google will show: `abcd efgh ijkl mnop` (usually 16 chars)
8. **Copy this password** (ignore spaces)
9. You won't see it again

**Result example:**
```
Old: mpqjkzjyuurcwmnp
New: xyzabcdefghijklm
```

---

### Step 4: Update Your .env File (10 min)

Open `.env` in VS Code (NOT `.env.example`):

```bash
# Copy these EXACT lines from your earlier commands:

JWT_SECRET=a3f8c2e9b1d4f7a0e5b9c3f2d8e1a4b7c9f2e5d8a1b4c7f0e3d6a9c2f5b8e
ADMIN_JWT_SECRET=f7e4b1c8a3d0f9e2c5b8a1d4e7f0c3a6d9f2c5e8a1d4b7c0f3e6a9d2c5f8

# Replace with MongoDB's new connection string:
MONGODB_URI=mongodb+srv://xxxxxxxxxxxxxxxxxxxxx:xxxxxxxxxxxxxxxxx@skillexchange.d9otv1g.mongodb.net/skillExchange?retryWrites=true&w=majority

# Replace with Gmail's new app password (remove spaces):
SMTP_PASSWORD=xyzabcdefghijklm
```

**IMPORTANT:**
- [ ] .env should NEVER be committed to git
- [ ] Verify .env is in `.gitignore`
- [ ] Save the file

---

### Step 5: Verify Everything Works (5 min)

```powershell
# Terminal 1: Start the app
npm start

# Wait 10 seconds, then in Terminal 2: Test the API
curl http://localhost:5000/api/health

# Should see:
# {"status":"ok","uptime":XXX}

# If error, run this to see what's wrong:
npm start 2>&1 | Select-Object -First 50
```

**✅ Blocker #1 Complete** if:
- App starts without errors
- Health check returns success
- No JWT/database errors in logs

---

## BLOCKER #2: HTTPS/TLS (2-3 HOURS)
### Current Risk: All data sent in plaintext (user passwords, auth tokens)

### Option A: Let's Encrypt (FREE, Recommended for Linux/Mac)

**If you're on Windows/local machine**, SKIP to **Option B**

#### For Linux Server Only:
```bash
# SSH into your server
ssh root@your-server-ip

# Install certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Get certificate for your domain
certbot certonly --standalone -d skillexchange.com -d www.skillexchange.com

# Certificate files created at:
# /etc/letsencrypt/live/skillexchange.com/privkey.pem
# /etc/letsencrypt/live/skillexchange.com/fullchain.pem
```

---

### Option B: Self-Signed Certificate (For Development/Testing)

**Good for local testing before production:**

```powershell
# Generate self-signed certificate (valid 365 days)
openssl req -x509 -newkey rsa:4096 -keyout private.key -out certificate.crt -days 365 -nodes

# When prompted, enter:
# Country: US
# State: (your state)
# City: (your city)
# Company: SkillExchange
# Common Name: skillexchange.com
# Leave other fields blank, press Enter

# Result: Two files created
# - private.key (keep SECRET)
# - certificate.crt (can be public)
```

---

### Option C: AWS Certificate Manager (FREE with AWS)

**If using AWS:**
1. Go to AWS Console → Certificate Manager
2. Click "Request certificate"
3. Enter domain: skillexchange.com
4. Choose "DNS validation" 
5. Follow DNS setup instructions
6. Certificate auto-renews

---

### Step 2: Update Your Application (30 min)

**File: `server/server.js`**

Find the part where server starts (usually near the end). Replace it with:

```javascript
// === HTTPS SETUP ===
const fs = require('fs');
const https = require('https');

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production' && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  // Production: Use HTTPS
  try {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    
    const server = https.createServer(options, app);
    server.listen(PORT, () => {
      console.log(`🔒 HTTPS Server running on https://0.0.0.0:${PORT}`);
    });
    
    // Redirect HTTP to HTTPS
    const http = require('http');
    const httpApp = require('express')();
    httpApp.use((req, res) => {
      res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
    httpApp.listen(80, () => {
      console.log('HTTP → HTTPS redirect running on port 80');
    });
  } catch (err) {
    console.error('SSL certificate error:', err.message);
    process.exit(1);
  }
} else {
  // Development: Use HTTP only
  app.listen(PORT, () => {
    console.log(`🚀 HTTP Server running on http://0.0.0.0:${PORT}`);
  });
}
```

---

### Step 3: Update .env File (5 min)

Add these lines to your `.env`:

```env
# For development (testing)
NODE_ENV=development
# SSL_KEY_PATH=/path/to/private.key
# SSL_CERT_PATH=/path/to/certificate.crt

# For production (uncomment these):
# NODE_ENV=production
# SSL_KEY_PATH=/etc/letsencrypt/live/skillexchange.com/privkey.pem
# SSL_CERT_PATH=/etc/letsencrypt/live/skillexchange.com/fullchain.pem
```

---

### Step 4: Test HTTPS Works (10 min)

```powershell
# If using self-signed certificate, copy it to project first:
cp certificate.crt .\
cp private.key .\

# Update .env:
# NODE_ENV=production
# SSL_KEY_PATH=./private.key
# SSL_CERT_PATH=./certificate.crt

# Start app
npm start

# In another terminal, test:
curl -k https://localhost:5000/api/health

# Should return successfully (ignore certificate warning)
```

**✅ Blocker #2 Complete** if:
- HTTPS works (no connection refused errors)
- HTTP redirects to HTTPS
- Browser shows padlock icon

---

## BLOCKER #3: DATABASE BACKUPS (15 MIN)
### Current Risk: If database deleted/corrupted, all data is gone forever

### For MongoDB Atlas (Most Common):

**Step 1: Enable Automated Backups (5 min)**

1. Go to https://cloud.mongodb.com
2. Select your cluster
3. Go to **Backup** tab
4. Click **Enable Backup** (if not already enabled)
5. Click **Backup Settings**
6. Set:
   - **Backup Frequency**: Daily
   - **Time of Day**: 2:00 AM (your timezone)
   - **Retention**: 30 days
7. Click **Save**

**That's it!** MongoDB now:
- ✅ Backs up automatically every day at 2 AM
- ✅ Keeps 30 days of backups
- ✅ Can restore to any point-in-time

---

### Step 2: Test Backup Restoration (10 min)

**Just verify the backup option works:**

1. Go back to **Backup** tab
2. Find latest backup (should say "Today" or recent date)
3. Click the **...** menu next to it
4. Click **Restore** (don't actually restore unless needed)
5. You'll see: "You can restore to a new cluster"
6. **Don't click**, just verified the option exists ✅

**If you ever need to restore:**
```
1. Go to Backup tab
2. Click the backup you want
3. Click Restore
4. Choose "New Cluster" or "Existing Cluster"
5. Follow prompts
(Usually takes 30 min - 2 hours depending on data size)
```

---

### Update .env for Backup Info (Add only if needed):

```env
# Backup configuration (informational only)
# MongoDB handles backups automatically
# Restore process: MongoDB Atlas console → Backup → Restore
```

**✅ Blocker #3 Complete** if:
- MongoDB Atlas Backup tab shows "Enabled"
- You can see backup restore option

---

## BLOCKER #4: ERROR MONITORING (30 MIN)
### Current Risk: If app crashes in production, you won't know until users complain

### Step 1: Create Sentry Account (5 min)

1. Go to https://sentry.io/signup/
2. Sign up with your email
3. Create account (free tier is fine)
4. Create organization (any name, e.g., "SkillExchange")
5. Confirm email

---

### Step 2: Create Project (3 min)

1. After signup, you'll see "Select a Sentry Team"
2. Click **Create Project**
3. Select platform: **Node.js**
4. Name: "skillexchange" or similar
5. Click **Create Project**
6. You'll get a **DSN** (looks like): `https://abc123@sentry.io/9999999`
7. **Copy this DSN** (you'll need it)

---

### Step 3: Install Sentry in Your App (10 min)

```powershell
# Install Sentry packages
npm install @sentry/node @sentry/tracing
```

**File: `server/server.js`** - Add at the VERY TOP (before other imports):

```javascript
// ===== SENTRY SETUP (ADD AT VERY TOP) =====
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true, request: true })
    ]
  });
  
  global.Sentry = Sentry;
}
// ===== END SENTRY SETUP =====

// Rest of your imports below
const express = require('express');
const app = express();
// ... rest of code
```

---

### Step 4: Add Error Handling Middleware (5 min)

**File: `server/server.js`** - After all routes, add:

```javascript
// Error handler with Sentry integration
app.use((err, req, res, next) => {
  // Capture error in Sentry (production only)
  if (process.env.NODE_ENV === 'production' && global.Sentry) {
    global.Sentry.captureException(err);
  }

  // Log error
  console.error('ERROR:', err.message || err);

  // Send response
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { error: err })
  });
});
```

---

### Step 5: Update .env File (2 min)

Add your Sentry DSN:

```env
# From Sentry dashboard:
SENTRY_DSN=https://abc123@sentry.io/9999999
```

(Replace with your actual DSN from Sentry)

---

### Step 6: Test It Works (3 min)

```powershell
# Set to production mode
$env:NODE_ENV = "production"
$env:SENTRY_DSN = "https://your-dsn@sentry.io/project"

npm start

# In another terminal, trigger an error:
curl http://localhost:5000/api/invalid-endpoint

# Go to Sentry dashboard (in your browser)
# https://sentry.io
# Click your project
# You should see the error appear in real-time! ✅
```

**✅ Blocker #4 Complete** if:
- Sentry is showing errors from your app
- You can see error details in dashboard
- Timestamps match when you triggered errors

---

## ✅ ALL BLOCKERS COMPLETE CHECKLIST

```powershell
# BLOCKER #1: Credentials Rotated
[ ] JWT_SECRET and ADMIN_JWT_SECRET are new (not defaults)
[ ] MongoDB password is new (changed in Atlas)
[ ] SMTP password is new (new Gmail app password)
[ ] .env file has all new values
[ ] App starts without credential-related errors

# BLOCKER #2: HTTPS/TLS
[ ] Certificate exists (self-signed or Let's Encrypt)
[ ] server.js updated to use HTTPS
[ ] .env has SSL_KEY_PATH and SSL_CERT_PATH (production)
[ ] HTTPS works: curl -k https://localhost:5000/api/health
[ ] HTTP redirects to HTTPS

# BLOCKER #3: Database Backups
[ ] MongoDB Atlas Backups enabled
[ ] Frequency: Daily
[ ] Retention: 30 days
[ ] Tested restore option exists

# BLOCKER #4: Error Monitoring
[ ] Sentry account created
[ ] Sentry DSN in .env
[ ] @sentry/node installed
[ ] server.js has Sentry setup code
[ ] Errors appearing in Sentry dashboard
```

---

## 🚀 Next: You're Ready for Staging!

Once all 4 blockers are done:

```powershell
# Commit all changes (except .env!)
git add -A
git commit -m "Add HTTPS, Sentry, update credentials"

# Deploy to staging server
# (Follow DEPLOYMENT_ACTION_PLAN.md from here)
```

---

## 📞 QUICK HELP

**Issue: "Can't connect to MongoDB"**
- Check .env MONGODB_URI is correct from Atlas
- Check Atlas Network Access has your IP whitelisted
- Run: `mongosh "your-uri"` to test connection

**Issue: "HTTPS certificate error"**
- For self-signed, use: `curl -k https://...` (skip verification)
- For production, ensure paths in SSL_KEY_PATH/SSL_CERT_PATH are correct
- Check file permissions: should be readable by app user

**Issue: "Sentry errors not showing"**
- Verify DSN is correct (check Sentry dashboard)
- Ensure NODE_ENV=production for Sentry to activate
- Check error occurs after deployment

**Issue: "Forgot ADMIN_JWT_SECRET earlier"**
- Generate a new one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Update .env
- Restart app
- All existing admin tokens invalidated (users must re-login)

