// Load environment variables from parent directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
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

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🚀 SkillExchange Server Running`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`💾 Database: ${process.env.MONGODB_URI}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
});

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
