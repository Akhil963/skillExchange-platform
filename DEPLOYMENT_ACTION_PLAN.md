# 🚀 PRODUCTION DEPLOYMENT ACTION PLAN
## SkillExchange Platform - Week-by-Week Implementation Guide

---

## WEEK 1: CRITICAL SECURITY HARDENING

### Day 1-2: Credential Management

#### Task 1.1: Generate New Secure Credentials
```bash
# Generate new JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate new ADMIN_JWT_SECRET
node -e "console.log('ADMIN_JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Output:
# JWT_SECRET=a3f8c2e9b1d4f7a0e5b9c3f2d8e1a4b7c9f2e5d8a1b4c7f0e3d6a9c2f5b8e
# ADMIN_JWT_SECRET=f7e4b1c8a3d0f9e2c5b8a1d4e7f0c3a6d9f2c5e8a1d4b7c0f3e6a9d2c5f8
```

#### Task 1.2: Create Secure Configuration Files
```bash
# 1. Backup original .env (if needed)
cp .env .env.backup

# 2. Create .env.example (template)
# Already done - rename to .env and fill in values

# 3. Create .env with new credentials
# DO NOT commit this file!

# 4. Update .gitignore (verify .env is listed)
# CHECK: .env should already be in .gitignore
```

#### Task 1.3: Secure MongoDB Credentials
```bash
# 1. Generate new MongoDB password (strong, 25+ chars)
# 2. Update MongoDB Atlas password
# 3. Update connection string in .env

# Format:
MONGODB_URI=mongodb+srv://newuser:newpassword@cluster.mongodb.net/skillExchange?retryWrites=true&w=majority
```

#### Task 1.4: Secure SMTP Credentials
```bash
# 1. For Gmail:
# - Go to https://myaccount.google.com/apppasswords
# - Select Mail and Windows Computer
# - Generate new app password (NOT your regular Gmail password)
# - Use this in SMTP_PASSWORD

# 2. For other providers:
# - Generate new API key/password
# - Store in environment variables only
```

### Day 3-4: HTTPS Implementation

#### Task 1.5: Obtain SSL/TLS Certificate
**For Development:**
```bash
# Generate self-signed certificate for testing
openssl req -x509 -newkey rsa:4096 -keyout private.key -out certificate.crt -days 365 -nodes
```

**For Production:**
```bash
# Option 1: Let's Encrypt (Free)
# Using Certbot on EC2/server
sudo certbot certonly --standalone -d skillexchange.com -d www.skillexchange.com

# Option 2: AWS Certificate Manager (Free with AWS)
# Go to ACM console and create certificate

# Option 3: Commercial: Digicert, GlobalSign, etc.

# Certificate paths for environment:
SSL_KEY_PATH=/etc/ssl/private/private.key
SSL_CERT_PATH=/etc/ssl/certs/certificate.crt
```

#### Task 1.6: Configure HTTPS in Express
**File: `server/server.js` - Add at top:**
```javascript
const fs = require('fs');
const https = require('https');

// ... existing code ...

// Start server with HTTPS in production
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production' && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  const options = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH)
  };
  
  const server = https.createServer(options, app);
  server.listen(PORT, () => {
    console.log(`🔒 HTTPS Server running on port ${PORT}`);
  });
  
  // Redirect HTTP to HTTPS
  const httpApp = express();
  httpApp.use((req, res) => {
    res.redirect(`https://${req.headers.host}${req.url}`);
  });
  httpApp.listen(80);
} else {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}
```

#### Task 1.7: Configure HSTS Headers
**File: `server/server.js` - Update Helmet:**
```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### Day 5: Remove Debug Endpoints

#### Task 1.8: Disable Debug Endpoints in Production
**File: `server/routes/learningPathRoutes.js` - Around line 39:**
```javascript
// Only enable debug endpoint in development
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/exchange/:exchangeId', protect, learningPathController.debugExchangeLearningPaths);
}
```

#### Task 1.9: Audit for More Debug Code
```bash
# Search for debug-related code
grep -r "console\.log" server/ --include="*.js" | grep -v "error\|warn\|info" | head -20
grep -r "console\.error" server/ --include="*.js" | head -10
grep -r "DEBUG\|debug" server/ --include="*.js" | head -10
```

---

## WEEK 2: MONITORING, LOGGING & TESTING

### Day 1-2: Structured Logging Implementation

#### Task 2.1: Install Logging Package
```bash
npm install winston winston-daily-rotate-file
```

#### Task 2.2: Create Logger Configuration
**File: `server/config/logger.js` (NEW):**
```javascript
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const transport = new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error'
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'skillexchange-api' },
  transports: [
    transport,
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/combined.log') }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

#### Task 2.3: Integrate Logger into App
**File: `server/server.js` - Add after imports:**
```javascript
const logger = require('./config/logger');

// Use logger instead of console.log
logger.info(`Server started in ${process.env.NODE_ENV} mode`);
```

### Day 3: Error Tracking with Sentry

#### Task 2.4: Set Up Sentry
```bash
# 1. Create account at https://sentry.io
# 2. Create new project (Node.js)
# 3. Get Sentry DSN

npm install @sentry/node @sentry/tracing

# Add to .env:
SENTRY_DSN=https://your-key@sentry.io/YOUR-PROJECT-ID
```

#### Task 2.5: Integrate Sentry
**File: `server/server.js` - At very top (before other code):**
```javascript
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  const Tracing = require("@sentry/tracing");

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
  
  // Error handling at the end
  app.use(Sentry.Handlers.errorHandler());
}
```

### Day 4-5: Test Suite Implementation

#### Task 2.6: Install Testing Framework
```bash
npm install --save-dev jest supertest @types/jest
```

#### Task 2.7: Create Jest Configuration
**File: `jest.config.js` (NEW):**
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/server.js',
    '!server/config/**',
    '!server/utils/seedDatabase.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

#### Task 2.8: Create Basic Tests
**File: `server/__tests__/models/User.test.js` (NEW):**
```javascript
const mongoose = require('mongoose');
const User = require('../../models/User');

describe('User Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('should create a user and hash password', async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    expect(user.name).toBe('Test User');
    expect(user.password).not.toBe('password123'); // Password should be hashed
  });

  test('should validate email format', async () => {
    try {
      await User.create({
        name: 'Test',
        email: 'invalid-email',
        password: 'password123'
      });
      fail('Should have thrown validation error');
    } catch (err) {
      expect(err.name).toBe('ValidationError');
    }
  });
});
```

#### Task 2.9: Update package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

---

## WEEK 3: DATABASE & CACHING

### Day 1-2: Automated Backups

#### Task 3.1: Enable MongoDB Atlas Backups
```
1. Go to MongoDB Atlas console
2. Select your cluster
3. Go to "Backup" tab
4. Enable "Automatic Daily Backups"
5. Set retention to 30 days
6. Test restore procedure
```

#### Task 3.2: Create Backup Script
**File: `server/utils/backup.js` (NEW):**
```javascript
const { exec } = require('child_process');
const schedule = require('node-schedule');
const logger = require('../config/logger');

const backupDatabase = async () => {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = `./backups/backup-${timestamp}.gz`;

  exec(`mongodump --uri="${process.env.MONGODB_URI}" --gzip --archive=${backupPath}`, (err) => {
    if (err) {
      logger.error('Backup failed:', err);
    } else {
      logger.info(`Backup created: ${backupPath}`);
    }
  });
};

// Schedule daily backup at 2 AM
schedule.scheduleJob('0 2 * * *', backupDatabase);

module.exports = backupDatabase;
```

### Day 3-5: Redis Caching Implementation

#### Task 3.3: Set Up Redis
```bash
# Option 1: Local Redis
# Mac: brew install redis
# Linux: apt-get install redis-server

# Option 2: Redis Cloud (Production)
# Go to https://redis.com/try-free/
# Create free tier instance
```

#### Task 3.4: Configure Redis Connection
```bash
npm install redis connect-redis
```

#### Task 3.5: Implement Session Store with Redis
**File: `server/config/session.js` (NEW):**
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

let redisClient = null;
let store = null;

const initRedis = async () => {
  if (process.env.NODE_ENV === 'production') {
    redisClient = createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    });

    await redisClient.connect();

    store = new RedisStore({ client: redisClient });
  }
};

const sessionMiddleware = session({
  store: store,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
});

module.exports = { initRedis, sessionMiddleware };
```

---

## WEEK 4: INFRASTRUCTURE & STAGING

### Day 1-2: Docker Production Build

#### Task 4.1: Update docker-compose.yml for Production
```yaml
# Already has good structure, just ensure environment variables are set
version: '3.8'

services:
  app:
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: ${MONGODB_URI}  # Use .env file
      JWT_SECRET: ${JWT_SECRET}     # Use .env file
      CLIENT_URL: https://skillexchange.com
```

#### Task 4.2: Create Production Environment File
**File: `.env.production`:**
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/skillExchange
JWT_SECRET=YOUR_PRODUCTION_JWT_SECRET
# ... other production variables
```

### Day 3-4: Nginx Reverse Proxy

#### Task 4.3: Create Nginx Configuration
**File: `nginx.conf` (NEW):**
```nginx
upstream skillexchange_app {
    server app:5000;
}

server {
    listen 80;
    server_name _;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name skillexchange.com www.skillexchange.com;

    ssl_certificate /etc/ssl/certs/certificate.crt;
    ssl_certificate_key /etc/ssl/private/private.key;

    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to app
    location / {
        proxy_pass http://skillexchange_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Task 4.4: Update docker-compose with Nginx
**Update: `docker-compose.yml`:**
```yaml
  nginx:
    image: nginx:alpine
    container_name: skillexchange-nginx
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/ssl/certs:/etc/ssl/certs:ro
      - /etc/ssl/private:/etc/ssl/private:ro
    networks:
      - skillexchange-network
```

### Day 5: Performance Optimization

#### Task 4.5: Add Database Indexes
**File: `server/config/indexing.js` (REVIEW):**
```javascript
const Schema = mongoose.Schema;

// Ensure these indexes exist
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
exchangeSchema.index({ requester_id: 1, provider_id: 1 });
exchangeSchema.index({ status: 1, created_date: -1 });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ exchange_id: 1 });
```

#### Task 4.6: Optimize API Response Times
- [ ] Implement response caching with Redis
- [ ] Add pagination to large result sets (already done)
- [ ] Optimize N+1 queries with proper population
- [ ] Monitor query performance

---

## WEEK 5: DEPLOYMENT

### Pre-Deployment Checklist (Do Once)

```bash
# 1. Verify all tests pass
npm test

# 2. Check test coverage
npm run test:coverage

# 3. Verify Docker build
docker build -t skillexchange:latest .

# 4. Test Docker compose
docker-compose up -d
# Test app at http://localhost
docker-compose down

# 5. Security scan
npm audit

# 6. Environment variables verified
# Verify .env.production has all required variables

# 7. Database migration ready
# Verify database is initialized with correct schema

# 8. Backups tested
# Verify backup and restore process works

# 9. Health checks
# Verify /api/health endpoint works
curl https://localhost:5000/api/health
```

### Day 1: Staging Deployment

```bash
# 1. Deploy to staging environment
# 2. Run smoke tests
# 3. Test all user workflows
# 4. Monitor logs for errors
# 5. Check performance metrics
# 6. Verify email notifications work
# 7. Test error handling
```

### Day 2-3: Production Deployment (Blue-Green)

```bash
# Blue-Green Deployment Strategy:

# 1. Set up GREEN environment (new version)
docker-compose -f docker-compose.prod.yml up -d

# 2. Run health checks
curl https://skillexchange.com/api/health

# 3. Monitor for 30 minutes
# Check logs, error tracking, performance

# 4. Switch traffic to GREEN
# Update load balancer or DNS

# 5. Keep BLUE running for 24 hours for quick rollback
```

### Day 4-5: Post-Deployment

```bash
# 1. Monitor all metrics
# Error rates, response times, database performance

# 2. Check user reports
# Browser console for errors, functionality issues

# 3. Run performance tests
# Load testing, stress testing

# 4. Document issues found
# Create tickets for improvements

# 5. Plan optimization iteration
```

---

## 📊 QUICK REFERENCE - File Summary

| File | Purpose | Status |
|------|---------|--------|
| `.env.example` | Template for environment variables | ✅ CREATED |
| `.env` | Actual environment variables | ⏳ CREATE (from example) |
| `server/config/logger.js` | Structured logging | ⏳ CREATE |
| `server/config/session.js` | Redis session store | ⏳ CREATE |
| `nginx.conf` | Reverse proxy config | ⏳ CREATE |
| `jest.config.js` | Testing configuration | ⏳ CREATE |
| `docker-compose.prod.yml` | Production deployment | ⏳ CREATE |

---

## 🚀 DEPLOYMENT COMMANDS CHECKLIST

```bash
# Initial setup
git clone <repo>
cd skillExchange-platform
cp .env.example .env
# Edit .env with all values
npm install

# Testing
npm test
npm run test:coverage

# Build
docker build -t skillexchange:latest .
docker tag skillexchange:latest skillexchange:v1.0.0

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Monitor
docker logs -f skillexchange-app
docker stats

# Rollback (if needed)
docker-compose down
docker-compose -f docker-compose.old.yml up -d
```

---

**Status**: Implementation Guide Ready  
**Estimated Completion**: 5 Weeks  
**Start Date**: After Critical Security Review

