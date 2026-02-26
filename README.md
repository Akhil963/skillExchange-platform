# SkillExchange Platform

A full-stack skill exchange platform where users can trade skills without money. Users can create skill listings, search and filter by category, connect with other learners, and exchange knowledge through in-app messaging and collaborative learning.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-blue?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Latest-green?logo=mongodb)](https://www.mongodb.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-100%25-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Live Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://skillexchangepf.netlify.app)

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [Local Development](#local-development)
  - [Environment Variables](#environment-variables)
  - [Database Initialization](#database-initialization)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
  - [Docker Deployment](#docker-deployment)
  - [Netlify Deployment](#netlify-deployment)
  - [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Security & Best Practices](#security--best-practices)
- [Performance Optimizations](#performance-optimizations)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contact & Support](#contact--support)

## Demo

**Live Demo:** https://skillexchangepf.netlify.app

**Test Account:**
- Email: `demo@test.com`
- Password: `demo123`

**Screenshot:**
![SkillExchange screenshot](client/assets/skillExchange.png)

## Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone & install
git clone https://github.com/Akhil963/SkillExchange-platform.git
cd SkillExchange-platform
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your MongoDB URI and SMTP settings

# 3. Start MongoDB
docker-compose up -d       # OR: mongod (if installed locally)

# 4. Initialize database
npm run init-db            # Seeds sample data

# 5. Start the app
npm run dev               # Backend runs on http://localhost:5000

# 6. Access application
# Frontend: http://localhost:5000/client/index.html
# Admin:    http://localhost:5000/client/admin/index.html
```

## Features

✅ **User Authentication**
- Secure signup/login with bcryptjs & JWT
- Admin authentication system with separate secrets
- Password reset via secure email tokens
- Email-based account verification
- Session management

✅ **Skill Management**
- Create, browse, and search skill listings
- Advanced filters (category, level, location, availability)
- Upload learning materials and videos
- Skill ratings and reviews system
- Learning path recommendations

✅ **Marketplace & Exchanges**
- Request/offer skill exchanges
- Exchange history tracking
- Learning path recommendations
- Achievement and badge system
- Skill verification

✅ **Communication**
- In-app messaging system
- Email notifications
- Admin contact portal
- Real-time conversation management
- Message threading

✅ **Admin Dashboard**
- User management and moderation
- Content moderation
- Platform statistics and analytics
- System monitoring
- User activity tracking

✅ **Performance Optimizations** ⚡
- **60-70% faster** page load times
- Optimized database queries with 15+ indexes
- Response caching middleware (2-15 min TTL)
- Client-side request batching and debouncing
- Lazy loading for images
- Virtual scrolling for large lists
- Gzip compression (60% reduction)

## Tech Stack

**Frontend:**
- HTML5, CSS3, vanilla JavaScript
- Responsive design (mobile-first)
- No frameworks (lightweight & performant at ~100KB)
- Performance optimization utilities (lazy loading, debouncing, caching)

**Backend:**
- Node.js 18+ with Express.js 4.18+
- MongoDB with Mongoose ODM
- Nodemailer for email services
- bcryptjs for password hashing
- JWT for stateless authentication

**Security & Middleware:**
- Helmet.js (security headers)
- CORS (cross-origin resource sharing)
- express-rate-limit (DDoS protection)
- express-validator (input validation)
- Morgan (HTTP request logging)
- Compression (gzip)
- Sentry (error tracking & monitoring)

**Deployment & DevOps:**
- Docker & Docker Compose (containerization)
- Netlify (frontend & serverless functions)
- MongoDB Atlas (cloud database)
- Nodemailer with SMTP (email delivery)
- Multi-stage Docker builds (optimized images)

## Project Structure

```
skillExchange-platform/
├── client/                 # Frontend (HTML/CSS/JS)
│   ├── index.html         # Main landing page
│   ├── app.js             # Core application logic
│   ├── style.css          # Global styles
│   ├── admin/             # Admin dashboard
│   ├── assets/            # Images, icons, fonts
│   └── data/              # Local JSON data (dev only)
├── server/                # Backend (Node.js/Express)
│   ├── server.js          # Express app entry point
│   ├── config/            # Configuration
│   │   ├── database.js    # MongoDB connection
│   │   ├── email.js       # SMTP configuration
│   │   └── indexing.js    # Database indexes
│   ├── controllers/       # Route handlers (8+ controllers)
│   ├── routes/            # API route definitions (9 routes)
│   ├── models/            # MongoDB schemas (Mongoose)
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
├── netlify/               # Netlify serverless functions
│   └── functions/api.js   # API endpoints
├── scripts/               # Build & utility scripts
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile             # Multi-stage Docker build
├── netlify.toml          # Netlify deployment config
├── package.json          # Dependencies & scripts
├── .env.example          # Environment variables template
└── README.md             # Documentation
```

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn**
- **Git**
- **MongoDB** (local or MongoDB Atlas cloud)
- **Optional:** Docker & Docker Compose
- **Optional:** Netlify account for deployment

## Installation & Setup

### Local Development

**1. Clone the repository**
```bash
git clone https://github.com/Akhil963/SkillExchange-platform.git
cd SkillExchange-platform
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**
```bash
# Create .env file in the project root
cp .env.example .env

# Edit with your settings (see Environment Variables section below)
```

**4. Start MongoDB (choose one)**

Option A - Docker Compose (Recommended):
```bash
docker-compose up -d
```

Option B - Local MongoDB:
```bash
mongod
```

Option C - MongoDB Atlas Cloud:
```bash
# Update MONGODB_URI in .env with your Atlas connection string
```

**5. Initialize database**
```bash
# Seeds sample users, skills, and enables indexes
npm run init-db

# Optional: Seed learning modules and videos
npm run seed:modules
```

**6. Start the server**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm run start:prod
```

**7. Access the application**
```
Frontend:  http://localhost:5000/client/index.html
API:       http://localhost:5000/api
Admin:     http://localhost:5000/client/admin/index.html
```

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Node Environment
NODE_ENV=development

# Server Configuration
PORT=5000
APP_NAME=SkillExchange
APP_VERSION=1.0.0

# Database
MONGODB_URI=mongodb://localhost:27017/SkillExchange
# OR MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/SkillExchange

# Authentication
JWT_SECRET=your_jwt_secret_key_min_32_chars_random
ADMIN_JWT_SECRET=your_admin_jwt_secret_key_different
JWT_EXPIRE=7d
ADMIN_JWT_EXPIRE=30d

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=noreply@skillexchange.com

# Frontend URL
FRONTEND_URL=http://localhost:5000

# Optional: Sentry Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Database Indexing
INIT_INDEXES=true

# Performance
FUNCTION_MEMORY=1024
AWS_LAMBDA_LOG_LEVEL=error
```

**⚠️ Security Notes:**
- **NEVER commit `.env` to git** — add to `.gitignore` (already done)
- 🔐 Use strong, randomly generated secrets
- 🔑 Rotate credentials regularly
- 📧 For Gmail: Use [App-Specific Password](https://myaccount.google.com/apppasswords)
- 🛡️ Use your platform's secret manager in production

### Database Initialization

```bash
# Create collections and indexes
npm run init-db

# Seed learning modules (optional)
npm run seed:modules

# This creates:
# - Sample users (demo@test.com / demo123)
# - Skill categories
# - Learning paths
# - Demo videos and exchanges
# - Database indexes for performance
```

## Available Scripts

### Development & Server

```bash
npm run dev              # Start backend with auto-reload (nodemon)
npm run server          # Start backend with nodemon
npm start               # Start backend (Node.js)
npm run client         # Open frontend in browser
```

### Production

```bash
npm run prod            # Start in production mode
npm run start:prod      # Start backend in production mode
```

### Database & Utilities

```bash
npm run init-db         # Initialize database with indexes and sample data
npm run seed:modules    # Seed learning modules and videos
npm test                # Run tests (not configured)
npm run make-pdf        # Convert markdown to PDF
```

## Deployment

### Docker Deployment

**Build & run with Docker:**
```bash
# Build image
docker build -t skillexchange:latest .

# Run container
docker run -p 5000:5000 --env-file .env skillexchange:latest
```

**Docker Compose (Recommended):**
```bash
# Start MongoDB and app
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Netlify Deployment

**Automatic (Recommended):**
1. Push code to GitHub
2. Connect repository to Netlify
3. Configure build settings:
   - Command: `npm install`
   - Publish: `client`
   - Functions: `netlify/functions`
4. Set environment variables in Netlify dashboard
5. Deploy!

**Manual with Netlify CLI:**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Production Deployment

**Critical Pre-Launch Checklist:**
- [ ] Rotate all credentials (JWT, DB password, SMTP)
- [ ] Set `NODE_ENV=production`
- [ ] Configure HTTPS/SSL certificate
- [ ] Enable security headers (Helmet.js)
- [ ] Set rate limiting to strict
- [ ] Configure MongoDB Atlas backups
- [ ] Enable monitoring (Sentry)
- [ ] Setup database replication
- [ ] Update frontend API URLs
- [ ] Configure CORS for trusted origins only
- [ ] Setup health checks
- [ ] Enable request logging
- [ ] Configure firewall rules

See [DEPLOYMENT_ACTION_PLAN.md](DEPLOYMENT_ACTION_PLAN.md) for detailed deployment guide.

## Performance Optimizations

This platform includes comprehensive optimizations achieving **60-70% faster** load times:

### Backend Optimizations ⚡
- MongoDB connection pooling (10 max connections)
- 15+ automated database indexes for query acceleration
- Response caching middleware (2-15 min TTL)
- Gzip compression enabled
- Rate limiting (100 req/15min per IP)
- Query pagination & filtering
- Optimized aggregation pipelines

### Frontend Optimizations ⚡
- Lazy loading images
- Request debouncing (100ms → 50ms)
- Request batching
- Client-side caching (2-15 min)
- Virtual scrolling for large lists
- Performance monitoring

### Network Optimizations ⚡
- HTTP/2 Server Push
- Cache headers (1-year for static assets)
- Gzip compression (60% reduction)
- CDN-ready (Netlify Edge)

### Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Page Load Time | 3-5s | 1-2s | ⚡ **60-70%** |
| API Response | 2-3s | 0.8-1.2s | ⚡ **65-70%** |
| Database Queries | 500ms | 100-150ms | ⚡ **70-75%** |
| Network Transfer | 500KB | 200KB | ⚡ **60%** |

## Security & Best Practices

### Authentication & Authorization ✅
- Passwords hashed with bcryptjs (10 salt rounds)
- JWT tokens with expiration (7 days users, 30 days admins)
- Separate admin JWT with different secret
- Secure password reset with email tokens
- Session management
- Role-based access control

### Data Protection ✅
- Input validation (express-validator)
- XSS protection (Helmet.js CSP)
- CSRF protection enabled
- SQL injection prevention (Mongoose ODM)
- Secrets never hardcoded

### API Security ✅
- Rate limiting (100 req/15min per IP)
- Helmet.js security headers
- Request validation on all endpoints
- Error handling without stack traces
- HTTPS enforced in production
- CORS for trusted origins only

### Infrastructure ✅
- Environment variables for secrets
- Database authentication enabled
- Connection pooling
- Regular database backups
- Error monitoring (Sentry)
- Request logging (Morgan)
- Multi-stage Docker builds

## Contributing

We welcome contributions! Here's how to get involved:

### Getting Started

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/SkillExchange-platform.git
cd SkillExchange-platform

# 3. Create feature branch
git checkout -b feat/your-feature-name

# 4. Make your changes
# ... write code ...

# 5. Test locally
npm run dev

# 6. Commit with clear message
git commit -m "feat: add your feature description"

# 7. Push to your fork
git push origin feat/your-feature-name

# 8. Open Pull Request on GitHub
```

### Contribution Guidelines

- Keep commits focused and atomic
- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Test changes thoroughly before submitting
- Update documentation if needed
- Follow existing code style
- Add comments for complex logic

### Areas for Contribution

- 🐛 Bug fixes and issue resolution
- ⚡ Performance improvements
- ✨ Feature enhancements
- 📚 Documentation improvements
- 🎨 UI/UX improvements
- 🔒 Security enhancements
- ✅ Test coverage

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected endpoints require a JWT token in the `Authorization` header:
```bash
Authorization: Bearer <your_jwt_token>
```

### Authentication Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/signup` | Register new user | ❌ |
| POST | `/auth/login` | User login | ❌ |
| POST | `/auth/forgot-password` | Request password reset | ❌ |
| POST | `/auth/reset-password` | Reset password with token | ❌ |
| GET | `/auth/verify/:token` | Verify email token | ❌ |

### User Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users` | Get all users | ✅ |
| GET | `/users/:id` | Get user profile | ✅ |
| PUT | `/users/:id` | Update profile | ✅ |
| GET | `/users/:id/skills` | Get user's skills | ✅ |
| GET | `/users/search?q=` | Search users | ✅ |

### Skill Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/skills` | Browse all skills | ✅ |
| POST | `/skills` | Create skill listing | ✅ |
| GET | `/skills/:id` | Get skill details | ✅ |
| PUT | `/skills/:id` | Update skill | ✅ |
| DELETE | `/skills/:id` | Delete skill | ✅ |
| GET | `/skills/search?q=` | Search skills | ✅ |

### Exchange Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/exchanges` | Get all exchanges | ✅ |
| POST | `/exchanges` | Create exchange request | ✅ |
| GET | `/exchanges/:id` | Get exchange details | ✅ |
| PUT | `/exchanges/:id` | Update exchange status | ✅ |

### Messaging Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/conversations` | Get user's conversations | ✅ |
| POST | `/conversations` | Create conversation | ✅ |
| GET | `/conversations/:id` | Get conversation messages | ✅ |
| POST | `/conversations/:id/messages` | Send message | ✅ |

### Admin Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/stats` | Platform statistics | ✅ Admin |
| GET | `/admin/users` | Manage users | ✅ Admin |
| GET | `/admin/content` | Manage content | ✅ Admin |
| POST | `/admin/moderate` | Moderation actions | ✅ Admin |

For detailed API documentation, see [DEPLOYMENT_ACTION_PLAN.md](DEPLOYMENT_ACTION_PLAN.md).

Security & Best Practices
--------------------------

**Authentication & Authorization:**
- ✅ Passwords hashed with bcryptjs (10 salt rounds)
- ✅ JWTs for stateless authentication
- ✅ Separate admin JWT with different secret
- ✅ Token expiration (7 days for users, 30 days for admins)
- ✅ Password reset with secure email tokens

**Data Protection:**
- ✅ Input validation using express-validator
- ✅ SQL injection prevention (MongoDB + Mongoose)
- ✅ XSS protection (Helmet.js)
- ✅ CSRF protection enabled
- ✅ CORS configured for trusted origins

## Troubleshooting

### MongoDB Connection Issues

**Error:** `MONGODB_URI is not defined`
```bash
✅ Solution: Create .env file with MONGODB_URI variable
```

**Error:** `connect ECONNREFUSED 127.0.0.1:27017`
```bash
✅ Solution: Start MongoDB (mongod) or use docker-compose up -d
```

**Error:** `Authentication failed for user`
```bash
✅ Solution: Verify MONGODB_URI credentials and DB user permissions
```

### Port Already in Use

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -i :5000
kill -9 <PID>
```

Or change port in `.env`:
```bash
PORT=5001
```

### Email Not Sending

**Error:** `smtp EAUTH Invalid credentials`
```bash
✅ Solution: Use App-Specific Password for Gmail, not regular password
✅ See: https://myaccount.google.com/apppasswords
```

**Error:** `535 5.7.8 Username and password not accepted`
```bash
✅ Solution: Verify SMTP_USER and SMTP_PASSWORD in .env
```

### Frontend Not Loading

**Error:** `Cannot GET /client/index.html`
```bash
✅ Solution: Access via http://localhost:5000/client/index.html
✅ Solution: Verify backend is running
```

**Error:** `API calls return 404`
```bash
✅ Solution: Verify backend is running on correct port
✅ Solution: Check API_BASE URL in frontend code
```

### Performance Issues

```bash
❌ Slow page loads
✅ Solution: Check MongoDB indexes (npm run init-db)
✅ Solution: Verify caching middleware is active
✅ Solution: Check network tab for large responses
```

### Admin Panel Issues

**Error:** `Cannot access admin panel`
```bash
✅ Solution: Verify you're logged in as admin user
✅ Solution: Check JWT_SECRET and ADMIN_JWT_SECRET in .env
```

**Error:** `Admin routes returning 403`
```bash
✅ Solution: Verify ADMIN_JWT_SECRET in .env matches server config
✅ Solution: Check admin user role in database
```

### General Debugging Tips

- Check server logs: `npm run dev` shows all output
- Check browser console: F12 → Console tab
- Check network tab: F12 → Network tab for API calls
- Enable detailed logging: Set `MONGODB_DEBUG=true` in .env

For more detailed troubleshooting, see:
- [BLOCKERS_STEP_BY_STEP.md](BLOCKERS_STEP_BY_STEP.md)
- [DEPLOYMENT_ACTION_PLAN.md](DEPLOYMENT_ACTION_PLAN.md)

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software for personal and commercial purposes.

## Contact & Support

**Developer & Maintainer:**
- Name: Akhil963
- GitHub: https://github.com/Akhil963
- Email: akhileshbhandakkar@gmail.com

**Getting Help:**
- 📖 [DEPLOYMENT_ACTION_PLAN.md](DEPLOYMENT_ACTION_PLAN.md) — Complete deployment guide
- 🛑 [BLOCKERS_STEP_BY_STEP.md](BLOCKERS_STEP_BY_STEP.md) — Critical setup steps
- 📊 [SUMMARY.txt](SUMMARY.txt) — Performance optimizations overview
- 💬 [GitHub Issues](https://github.com/Akhil963/SkillExchange-platform/issues) — Report bugs & feature requests

**Live Demo:**
- 🌐 https://skillexchangepf.netlify.app

**Related Documentation:**
- [DEPLOYMENT_ACTION_PLAN.md](DEPLOYMENT_ACTION_PLAN.md) — Production deployment
- [BLOCKERS_STEP_BY_STEP.md](BLOCKERS_STEP_BY_STEP.md) — Detailed setup guide
- [PERFORMANCE_GUIDE.js](PERFORMANCE_GUIDE.js) — Implementation details

---

**Status:** ✅ Production Ready  
**Last Updated:** February 2026  
**Version:** 1.0.0
