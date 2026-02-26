// Load environment variables from parent directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// ===== SENTRY SETUP (ADD AT VERY TOP) =====
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

// Initialize express app
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

// Security middleware
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
  xssFilter: true
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Rate limiting - Different limits for dev vs production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 for dev, 100 for prod
  message: JSON.stringify({
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV !== 'production', // Skip rate limiting in development
  validate: { xForwardedForHeader: process.env.NODE_ENV === 'production' }, // Only validate X-Forwarded-For in production
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware to check database status for API requests
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

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Live reload for development
if (process.env.NODE_ENV === 'development') {
  try {
    const livereload = require('livereload');
    const connectLivereload = require('connect-livereload');
    
    const liveReloadServer = livereload.createServer({
      exts: ['html', 'css', 'js'],
      debug: false
    });
    
    liveReloadServer.watch([
      path.join(__dirname, '../client'),
    ]);
    
    app.use(connectLivereload());
    
    console.log('🔄 Live reload enabled');
  } catch (err) {
    console.log('⚠️  Live reload not available (install: npm i livereload connect-livereload -D)');
  }
}

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Add cache headers for static assets
app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.url.endsWith('.html')) {
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  } else if (req.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

// Serve admin static files (now inside client folder)
app.use('/admin', express.static(path.join(__dirname, '../client/admin')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/learning-paths', learningPathRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Platform stats route
app.get('/api/stats', async (req, res) => {
  try {
    const User = require('./models/User');
    const Exchange = require('./models/Exchange');

    const totalUsers = await User.countDocuments({ isActive: true });
    const totalExchanges = await Exchange.countDocuments();
    const completedExchanges = await Exchange.countDocuments({ status: 'completed' });
    const activeExchanges = await Exchange.countDocuments({ status: 'active' });

    const successRate = totalExchanges > 0
      ? Math.round((completedExchanges / totalExchanges) * 100)
      : 0;

    const avgRatingResult = await User.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    const avgRating = avgRatingResult.length > 0
      ? Math.round(avgRatingResult[0].avgRating * 10) / 10
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        total_users: totalUsers,
        total_exchanges: totalExchanges,
        active_exchanges: activeExchanges,
        completed_exchanges: completedExchanges,
        success_rate: successRate,
        average_rating: avgRating
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching stats'
    });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

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

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// === HTTPS SETUP ===
const fs = require('fs');
const https = require('https');

const PORT = process.env.PORT || 5000;

let server;

// Check if SSL certificates exist before trying to use them
const hasSSLCerts = process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH && 
                    fs.existsSync(process.env.SSL_KEY_PATH) && 
                    fs.existsSync(process.env.SSL_CERT_PATH);

if (process.env.NODE_ENV === 'production' && hasSSLCerts) {
  // Production with local SSL certificates (self-hosted)
  try {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    
    server = https.createServer(options, app);
    server.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🔒 SkillExchange HTTPS Server Running`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Server: https://0.0.0.0:${PORT}`);
      console.log(`🔗 API: https://0.0.0.0:${PORT}/api`);
      console.log(`💾 Database: ${process.env.MONGODB_URI}`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
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
    console.error('❌ SSL certificate error:', err.message);
    console.error('Falling back to HTTP server...');
    // Fall back to HTTP
    server = app.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🚀 SkillExchange Server Running (HTTP Fallback)`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
      console.log(`🔗 API: http://0.0.0.0:${PORT}/api`);
      console.log(`💾 Database: ${process.env.MONGODB_URI}`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    });
  }
} else {
  // Development or production without local SSL (e.g., Render handles HTTPS automatically)
  server = app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🚀 SkillExchange Server Running`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`🔗 API: http://0.0.0.0:${PORT}/api`);
    console.log(`💾 Database: ${process.env.MONGODB_URI}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

module.exports = app;
