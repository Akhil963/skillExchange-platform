/**
 * ===================================
 * SkillExchange - CENTRALIZED CONFIGURATION
 * ===================================
 * All environment variables and configuration in one place
 * Validates required variables and provides defaults
 */

require('dotenv').config();

// Helper to validate required environment variables
const requireEnv = (key, defaultValue = null) => {
  const value = process.env[key] || defaultValue;
  if (!value && !defaultValue) {
    console.warn(`⚠️  Warning: Environment variable ${key} is not set`);
  }
  return value;
};

// Helper to parse boolean environment variables
const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

// Helper to parse comma-separated list
const parseList = (value, defaultValue = []) => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

const config = {
  // ===================================
  // ENVIRONMENT
  // ===================================
  env: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // ===================================
  // SERVER
  // ===================================
  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    host: process.env.HOST || '0.0.0.0',
  },

  // ===================================
  // DATABASE
  // ===================================
  database: {
    uri: requireEnv('MONGODB_URI', 'mongodb://localhost:27017/SkillExchange'),
    options: {
      // Modern connection options (removes deprecation warnings)
      // No need for useNewUrlParser, useUnifiedTopology etc. in Mongoose 6+
    }
  },

  // ===================================
  // JWT CONFIGURATION
  // ===================================
  jwt: {
    secret: requireEnv('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
    expire: process.env.JWT_EXPIRE || '30d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30,
  },

  // ===================================
  // CLIENT
  // ===================================
  client: {
    url: requireEnv('CLIENT_URL', 'http://localhost:5000'),
    // Multiple origins for CORS
    corsOrigins: parseList(
      process.env.CORS_ORIGINS,
      [process.env.CLIENT_URL || 'http://localhost:5000', 'http://localhost:3000']
    ),
  },

  // ===================================
  // EMAIL CONFIGURATION
  // ===================================
  email: {
    enabled: parseBoolean(process.env.EMAIL_ENABLED, true),
    from: {
      email: process.env.FROM_EMAIL || 'noreply@sendgrid.net',
      name: process.env.FROM_NAME || 'SkillExchange Platform',
    },
    // Check if SendGrid is properly configured
    isConfigured: !!process.env.SENDGRID_API_KEY,
  },

  // ===================================
  // SECURITY
  // ===================================
  security: {
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      maxRequests: parseInt(
        process.env.RATE_LIMIT_MAX_REQUESTS,
        10
      ) || (process.env.NODE_ENV === 'production' ? 100 : 1000),
    },
    helmet: {
      enabled: parseBoolean(process.env.HELMET_ENABLED, true),
      contentSecurityPolicy: parseBoolean(process.env.CSP_ENABLED, false),
    },
  },

  // ===================================
  // FILE UPLOADS
  // ===================================
  uploads: {
    maxSize: parseInt(process.env.MAX_FILE_UPLOAD, 10) || 10 * 1024 * 1024, // 10MB
    path: process.env.FILE_UPLOAD_PATH || './uploads',
    allowedTypes: parseList(
      process.env.ALLOWED_FILE_TYPES,
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    ),
  },

  // ===================================
  // LOGGING
  // ===================================
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug'),
    enabled: parseBoolean(process.env.ENABLE_LOGGING, true),
  },

  // ===================================
  // ADMIN CONFIGURATION
  // ===================================
  admin: {
    // Admin uses separate .env file
    envPath: './admin/.env.admin',
  },

  // ===================================
  // PLATFORM FEATURES
  // ===================================
  features: {
    registration: parseBoolean(process.env.FEATURE_REGISTRATION, true),
    messaging: parseBoolean(process.env.FEATURE_MESSAGING, true),
    reviews: parseBoolean(process.env.FEATURE_REVIEWS, true),
    notifications: parseBoolean(process.env.FEATURE_NOTIFICATIONS, false),
  },
};

// ===================================
// VALIDATION
// ===================================
const validateConfig = () => {
  const errors = [];
  const warnings = [];

  // Critical checks for production
  if (config.isProduction) {
    if (config.jwt.secret === 'dev-jwt-secret-change-in-production') {
      errors.push('🔴 JWT_SECRET must be changed in production!');
    }

    if (!config.database.uri.includes('mongodb+srv://') && !config.database.uri.includes('mongodb://')) {
      warnings.push('⚠️  MONGODB_URI format may be incorrect');
    }

    if (!config.email.isConfigured) {
      warnings.push('⚠️  Email is not configured - password reset will not work');
    }

    if (config.client.url.includes('localhost')) {
      warnings.push('⚠️  CLIENT_URL still points to localhost in production');
    }
  }

  // Display errors and warnings
  if (errors.length > 0) {
    console.error('\n❌ CONFIGURATION ERRORS:');
    errors.forEach(error => console.error(error));
    console.error('');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  CONFIGURATION WARNINGS:');
    warnings.forEach(warning => console.warn(warning));
    console.warn('');
  }
};

// ===================================
// DISPLAY CONFIGURATION (DEV ONLY)
// ===================================
const displayConfig = () => {
  if (config.isDevelopment) {
    console.log('\n📋 Current Configuration:');
    console.log(`   Environment: ${config.env}`);
    console.log(`   Server: http://${config.server.host}:${config.server.port}`);
    console.log(`   Database: ${config.database.uri.replace(/\/\/.*:.*@/, '//***:***@')}`);
    console.log(`   Email: ${config.email.isConfigured ? '✅ Configured' : '❌ Not Configured'}`);
    console.log(`   Client URL: ${config.client.url}`);
    console.log('');
  }
};

// Run validation
validateConfig();

// Display config in development
if (config.isDevelopment) {
  displayConfig();
}

// ===================================
// HELPER METHODS
// ===================================
config.getConnectionString = () => {
  // Hide credentials in logs
  return config.database.uri.replace(/\/\/.*:.*@/, '//***:***@');
};

config.isEmailEnabled = () => {
  return config.email.enabled && config.email.isConfigured;
};

config.getClientUrl = (path = '') => {
  return `${config.client.url}${path}`;
};

module.exports = config;
