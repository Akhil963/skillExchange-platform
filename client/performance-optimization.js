/**
 * ==========================================
 * FRONTEND OPTIMIZATION TIPS
 * ==========================================
 * Apply these techniques to improve performance
 */

// 1. LAZY LOADING FOR IMAGES
// =============================================

function lazyLoadImages() {
  // Get all images with data-src attribute
  const images = document.querySelectorAll('img[data-src]');
  
  // Use Intersection Observer for performance
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px' // Start loading 50px before visible
  });
  
  images.forEach(img => imageObserver.observe(img));
}

// 2. DEBOUNCE FUNCTION FOR SEARCH & FILTERS
// =============================================

function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Usage:
// const debouncedSearch = debounce((query) => {
//   apiRequest(`/search?q=${query}`);
// }, 300);

// 3. REQUEST DEDUPLICATION
// =============================================

const pendingRequests = new Map();

function deduplicatedFetch(url) {
  // Return cached pending promise if exists
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }
  
  // Create new promise and cache it
  const promise = fetch(url)
    .then(res => res.json())
    .finally(() => pendingRequests.delete(url)); // Clean up
  
  pendingRequests.set(url, promise);
  return promise;
}

// 4. BATCH API REQUESTS
// =============================================

class RequestBatcher {
  constructor(batchSize = 10, delayMs = 100) {
    this.batchSize = batchSize;
    this.delayMs = delayMs;
    this.batch = [];
    this.timer = null;
  }
  
  add(request) {
    return new Promise((resolve, reject) => {
      this.batch.push({ request, resolve, reject });
      
      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }
  
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    
    const batch = this.batch.splice(0);
    if (batch.length === 0) return;
    
    try {
      // Process all requests in batch
      const results = await Promise.all(
        batch.map(b => Promise.resolve(b.request()).catch(e => ({ error: e })))
      );
      
      batch.forEach((item, i) => {
        if (results[i].error) {
          item.reject(results[i].error);
        } else {
          item.resolve(results[i]);
        }
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
    
    this.timer = null;
  }
}

// 5. CACHE MANAGER
// =============================================

class CacheManager {
  constructor(defaultTTL = 5 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }
  
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  clear() {
    this.cache.clear();
  }
  
  has(key) {
    return this.get(key) !== null;
  }
}

// 6. PERFORMANCE MONITORING
// =============================================

function measurePerformance(label, asyncFunction) {
  return async function(...args) {
    const start = performance.now();
    try {
      const result = await asyncFunction(...args);
      const duration = performance.now() - start;
      
      // Log if slow (> 1 second)
      if (duration > 1000) {
        console.warn(`⚠️  Slow operation: ${label} took ${duration.toFixed(2)}ms`);
      } else {
        console.log(`✓ ${label} completed in ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ ${label} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  };
}

// Usage:
// const optimizedApiRequest = measurePerformance('API Call', apiRequest);
// await optimizedApiRequest('/users');

// 7. DOM OPTIMIZATION
// =============================================

// Batch DOM updates
function batchDOMUpdates(updates) {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

// Virtual scrolling for long lists
class VirtualScroller {
  constructor(container, itemHeight, totalItems) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.totalItems = totalItems;
    this.visibleItems = [];
    
    this.container.addEventListener('scroll', () => this.updateVisibleItems());
    this.updateVisibleItems();
  }
  
  updateVisibleItems() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + viewportHeight) / this.itemHeight);
    
    this.visibleItems = Array.from(
      { length: endIndex - startIndex },
      (_, i) => startIndex + i
    );
  }
  
  getVisibleItems() {
    return this.visibleItems;
  }
}

// 8. NETWORK OPTIMIZATION
// =============================================

// Check network speed
function getNetworkInfo() {
  if (navigator.connection) {
    const { effectiveType, downlink, rtt, saveData } = navigator.connection;
    return {
      connectionType: effectiveType, // 'slow-2g', '2g', '3g', '4g'
      downlink, // Mbps
      roundTripTime: rtt, // ms
      saveDataEnabled: saveData
    };
  }
  return null;
}

// Adjust quality based on network
function getImageQuality() {
  const info = getNetworkInfo();
  if (!info) return 'high';
  
  if (info.connectionType === '4g') return 'high';
  if (info.connectionType === '3g') return 'medium';
  return 'low';
}

// ==========================================
// USAGE EXAMPLES
// ==========================================

// Example 1: Lazy load images
// lazyLoadImages();

// Example 2: Debounced search
// const debouncedSearch = debounce((query) => {
//   apiRequest(`/search?q=${query}`);
// }, 300);
// searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

// Example 3: Request batching
// const batcher = new RequestBatcher(10, 100);
// for (let i = 0; i < 100; i++) {
//   batcher.add(() => apiRequest(`/users/${i}`));
// }

// Example 4: Cache management
// const cache = new CacheManager(5 * 60 * 1000);
// cache.set('user_data', userData);
// const cachedData = cache.get('user_data');

// Example 5: Performance monitoring
// const monitoredApiRequest = measurePerformance('User API', apiRequest);
// await monitoredApiRequest('/users');

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize performance optimizations
  console.log('🚀 Performance optimizations enabled');
  
  // Apply lazy loading
  if ('IntersectionObserver' in window) {
    lazyLoadImages();
  }
  
  // Check network
  const networkInfo = getNetworkInfo();
  if (networkInfo) {
    console.log('📊 Network:', networkInfo);
  }
  
  // Monitor Core Web Vitals
  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('📈 Web Vital:', entry.name, entry.value);
        }
      }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (e) {
      // Web Vitals not supported
    }
  }
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    lazyLoadImages,
    debounce,
    deduplicatedFetch,
    RequestBatcher,
    CacheManager,
    measurePerformance,
    batchDOMUpdates,
    VirtualScroller,
    getNetworkInfo,
    getImageQuality
  };
}
