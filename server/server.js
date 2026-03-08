// Load environment variables from parent directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// ===== SENTRY SETUP (must be very first) =====
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  try {
    const Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV
    });
    global.Sentry = Sentry;
  } catch (err) {
    console.error('⚠️  Sentry initialization failed:', err.message);
  }
}
// ===== END SENTRY SETUP =====

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');

const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const skillRoutes = require('./routes/skillRoutes');
const learningPathRoutes = require('./routes/learningPathRoutes');

const app = express();

// Trust proxy (Render and other reverse proxies set X-Forwarded-For)
app.set('trust proxy', 1);

// Connect to MongoDB (async, doesn't block server startup)
let dbConnected = false;
connectDB().then(() => {
  dbConnected = true;
  console.log('✅ Database ready - API routes active');
}).catch(err => {
  console.error('⚠️  Database connection error:', err.message);
  dbConnected = false;
});

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://kit.fontawesome.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      // This app still uses inline event handlers (onclick, onchange, etc.).
      // Use explicit CSP key for compatibility across Helmet versions.
      'script-src-attr': ["'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://fonts.cdnfonts.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com', 'https://ka-f.fontawesome.com', 'https://cdnjs.cloudflare.com'],
      imgSrc:         ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: function(origin, callback) {
    const allowedBaseUrl = process.env.CLIENT_URL || 'http://localhost:5000';
    const allowedPort   = allowedBaseUrl.split(':').pop();

    // Build the whitelist from both env var names (CORS_WHITELIST and CORS_ORIGINS)
    const whitelist = [
      ...(process.env.CORS_WHITELIST ? process.env.CORS_WHITELIST.split(',') : []),
      ...(process.env.CORS_ORIGINS   ? process.env.CORS_ORIGINS.split(',')   : [])
    ].map(s => s.trim()).filter(Boolean);

    if (!origin ||
        origin === `http://localhost:${allowedPort}` ||
        origin === `http://127.0.0.1:${allowedPort}` ||
        origin === `https://localhost:${allowedPort}` ||
        origin === `https://127.0.0.1:${allowedPort}` ||
        origin === allowedBaseUrl ||
        whitelist.includes(origin) ||
        process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// ── Global rate limit ────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: JSON.stringify({ success: false, message: 'Too many requests from this IP, please try again later.' }),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production',
  validate: { xForwardedForHeader: process.env.NODE_ENV === 'production' },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
app.use('/api/', limiter);

// ── Stricter rate limits for sensitive auth endpoints ─────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: JSON.stringify({ success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' }),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production'
});
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/register',        authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/verify-otp',      authLimiter);
app.use('/api/admin-auth/login',     authLimiter);

// ── Body parsers (keep limit reasonable for JSON APIs) ───────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Input sanitization ────────────────────────────────────────────────────────
app.use(mongoSanitize({ replaceWith: '_' }));  // NoSQL injection prevention
app.use(xss());                                 // XSS payload stripping
app.use(hpp());                                 // HTTP parameter pollution prevention

// ── DB gate for API routes ────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  if (!dbConnected && !req.path.includes('health')) {
    return res.status(503).json({
      success: false,
      message: 'Database is initializing. Please try again in a few moments.',
      code: 'DB_INITIALIZING'
    });
  }
  next();
});

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Request logging ───────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Live reload (dev only) ────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  try {
    const livereload      = require('livereload');
    const connectLivereload = require('connect-livereload');
    const liveReloadServer  = livereload.createServer({ exts: ['html', 'css', 'js'], debug: false });
    liveReloadServer.watch([path.join(__dirname, '../client')]);
    app.use(connectLivereload());
    console.log('🔄 Live reload enabled');
  } catch (err) {
    console.log('⚠️  Live reload not available (install: npm i livereload connect-livereload -D)');
  }
}

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// Cache headers for static assets
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css)$/))                    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  else if (req.url.endsWith('.html'))                  res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  else if (req.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

// Block .env* and private key files before serving admin static directory
app.use('/admin', (req, res, next) => {
  if (/\.env/i.test(req.path) || /\.(key|pem|crt)$/i.test(req.path)) {
    return res.status(403).end();
  }
  next();
});
app.use('/admin', express.static(path.join(__dirname, '../client/admin')));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/users',          userRoutes);
app.use('/api/exchanges',      exchangeRoutes);
app.use('/api/conversations',  conversationRoutes);
app.use('/api/contact',        contactRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/admin-auth',     adminAuthRoutes);
app.use('/api/skills',         skillRoutes);
app.use('/api/learning-paths', learningPathRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const mongoose  = require('mongoose');
  const dbStatus  = mongoose.connection.readyState; // 0=disc, 1=conn, 2=connecting, 3=disc
  const dbReady   = dbStatus === 1;
  res.status(dbReady ? 200 : 503).json({
    success:   dbReady,
    status:    dbReady ? 'healthy' : 'degraded',
    db:        dbReady ? 'connected' : ['disconnected','connected','connecting','disconnecting'][dbStatus] || 'unknown',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ── Platform stats ────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const User     = require('./models/User');
    const Exchange = require('./models/Exchange');

    const [totalUsers, totalExchanges, completedExchanges, activeExchanges, avgRatingResult] =
      await Promise.all([
        User.countDocuments({ isActive: true }),
        Exchange.countDocuments(),
        Exchange.countDocuments({ status: 'completed' }),
        Exchange.countDocuments({ status: 'active' }),
        User.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }])
      ]);

    res.status(200).json({
      success: true,
      stats: {
        total_users:          totalUsers,
        total_exchanges:      totalExchanges,
        active_exchanges:     activeExchanges,
        completed_exchanges:  completedExchanges,
        success_rate:         totalExchanges > 0 ? Math.round((completedExchanges / totalExchanges) * 100) : 0,
        average_rating:       avgRatingResult.length > 0 ? Math.round(avgRatingResult[0].avg * 10) / 10 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// Redirect email-based password reset links to SPA
app.get('/reset-password/:token', (req, res) => {
  res.redirect(`/?reset=${req.params.token}`);
});

// Serve SPA for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.use(notFound);
app.use(errorHandler);

// ── Server startup ────────────────────────────────────────────────────────────
const fs    = require('fs');
const https = require('https');
const PORT  = process.env.PORT || 5000;

let server;

const hasSSLCerts = process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH &&
                    fs.existsSync(process.env.SSL_KEY_PATH) &&
                    fs.existsSync(process.env.SSL_CERT_PATH);

// Sanitize DB URI for logging (hide credentials)
const safeDbUri = () => (process.env.MONGODB_URI || '').replace(/\/\/[^:]+:[^@]+@/, '//***:***@') || 'configured';

const logStartup = (proto, port) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🚀 SkillExchange Server Running`);
  console.log(`📡 Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server      : ${proto}://0.0.0.0:${port}`);
  console.log(`🔗 API         : ${proto}://0.0.0.0:${port}/api`);
  console.log(`💾 Database    : ${safeDbUri()}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
};

if (process.env.NODE_ENV === 'production' && hasSSLCerts) {
  try {
    const options = {
      key:  fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    server = https.createServer(options, app);
    server.listen(PORT, () => logStartup('https', PORT));

    // HTTP → HTTPS redirect
    const http    = require('http');
    const httpApp = require('express')();
    httpApp.use((req, res) => res.redirect(301, `https://${req.headers.host}${req.url}`));
    httpApp.listen(80, () => console.log('HTTP → HTTPS redirect on port 80'));
  } catch (err) {
    console.error('❌ SSL certificate error:', err.message, '— falling back to HTTP');
    server = app.listen(PORT, () => logStartup('http', PORT));
  }
} else {
  server = app.listen(PORT, () => logStartup('http', PORT));
}

// ── Process signal handling & graceful shutdown ────────────────────────────────
const gracefulShutdown = (signal) => {
  console.log(`\n👋 ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      console.log('✅ MongoDB connection closed');
    } catch (err) {
      console.error('Error closing MongoDB:', err.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Unhandled promise rejections — log + alert; only exit in truly critical scenarios
process.on('unhandledRejection', (err) => {
  const msg = err?.message || String(err);
  console.error('❌ Unhandled Promise Rejection:', msg);
  if (global.Sentry) global.Sentry.captureException(err);
  // Exit only if the HTTP server failed to start (catastrophic)
  if (!server?.listening) process.exit(1);
});

// Synchronous exceptions that were never caught — always fatal
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  if (global.Sentry) global.Sentry.captureException(err);
  process.exit(1);
});

module.exports = app;
