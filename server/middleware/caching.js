/**
 * ========================================
 * CACHING MIDDLEWARE - Performance Optimization
 * ========================================
 */

// In-memory cache for API responses
const responseCache = new Map();
const CACHE_DURATION = {
  SKILLS: 5 * 60 * 1000,        // 5 minutes
  LEARNING_PATHS: 5 * 60 * 1000, // 5 minutes
  USER: 10 * 60 * 1000,          // 10 minutes
  EXCHANGE: 3 * 60 * 1000,       // 3 minutes
  CONVERSATION: 2 * 60 * 1000,   // 2 minutes
  STATS: 10 * 60 * 1000          // 10 minutes
};

/**
 * Cache middleware for GET requests
 * @param {number} duration - Cache duration in milliseconds
 */
function cacheMiddleware(duration = CACHE_DURATION.SKILLS) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl}`;
    const cached = responseCache.get(key);

    // Return cached response if available and not expired
    if (cached && Date.now() - cached.timestamp < duration) {
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Age', Math.round((Date.now() - cached.timestamp) / 1000));
      return res.status(cached.status).json(cached.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (res.statusCode === 200) {
        responseCache.set(key, {
          data,
          status: 200,
          timestamp: Date.now()
        });
        res.set('X-Cache', 'MISS');
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Clear cache for specific pattern
 */
function clearCache(pattern) {
  for (const [key] of responseCache) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
function clearAllCache() {
  responseCache.clear();
}

/**
 * Set response headers for performance
 */
function setPerformanceHeaders(req, res, next) {
  // Enable compression
  res.set('Vary', 'Accept-Encoding');
  
  // Set cache headers based on endpoint
  if (req.path.includes('/admin/')) {
    res.set('Cache-Control', 'private, max-age=300');
  } else if (req.path.includes('/users')) {
    res.set('Cache-Control', 'private, max-age=600');
  } else if (req.path.includes('/skills')) {
    res.set('Cache-Control', 'public, max-age=3600');
  } else if (req.path.includes('/learning-paths')) {
    res.set('Cache-Control', 'public, max-age=1800');
  } else {
    res.set('Cache-Control', 'public, max-age=300');
  }

  // Disable unnecessary headers
  res.removeHeader('X-Powered-By');
  
  next();
}

/**
 * Pagination helper
 */
function paginate(query, page = 1, limit = 20) {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  const skip = (page - 1) * limit;
  
  return {
    skip,
    limit,
    page
  };
}

/**
 * Query optimization - select only needed fields
 */
function selectFields(fields = '') {
  return fields ? fields.split(',').join(' ') : '';
}

module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
  setPerformanceHeaders,
  paginate,
  selectFields,
  CACHE_DURATION
};
