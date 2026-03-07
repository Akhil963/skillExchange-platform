// SkillExchange Application - Frontend with API Integration & Performance Optimization

// API Base URL
const API_URL = window.location.origin + '/api';

// Generate a dynamic avatar URL using ui-avatars.com
function getDefaultAvatar(name) {
  const encoded = encodeURIComponent((name || 'User').trim());
  return `https://ui-avatars.com/api/?name=${encoded}&size=150&background=random&color=fff&rounded=true&bold=true`;
}

// ========================================
// PERFORMANCE OPTIMIZATION SETTINGS
// ========================================

// Enable localStorage-based session storage for faster page loads
const useSessionStorage = true;

// Disable automatic polling - only fetch on demand
const autoPollingDisabled = true;

// Reduce cache expiry times for freshness
const CACHE_EXPIRY_TIMES = {
  SHORT: 2 * 60 * 1000,    // 2 minutes for frequently changing data
  MEDIUM: 5 * 60 * 1000,   // 5 minutes
  LONG: 15 * 60 * 1000,    // 15 minutes for static data
  USER: 10 * 60 * 1000     // 10 minutes for user data
};

// Application State
const AppState = {
  currentUser: null,
  token: localStorage.getItem('token') || null,
  currentPage: 'home',
  users: [],
  exchanges: [],
  skillCategories: [],
  experienceLevels: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  featuredSkills: [],
  platformStats: {},
  conversations: [],
  activeConversation: null,
  requestQueue: [],
  isProcessingQueue: false,
  rateLimitDelay: 50, // Reduced from 100ms for faster requests
  cache: {}, // Cache for API responses
  cacheExpiry: CACHE_EXPIRY_TIMES.MEDIUM,
  pendingRequests: {}, // Track pending requests to avoid duplicates
  requestTimings: {}, // Track request timings for optimization
  batchRequests: [], // Batch multiple requests
  batchTimeout: null,
  notifiedExchanges: new Set(JSON.parse(localStorage.getItem('_notifiedExchanges') || '[]')), // Persisted across reloads
  useBatching: true, // Enable request batching
  pollingIntervals: { messages: null, conversations: null, dashboard: null }
};

// ======================
// API HELPER FUNCTIONS
// ======================

// Request queue to prevent rate limiting
async function processRequestQueue() {
  if (AppState.isProcessingQueue || AppState.requestQueue.length === 0) {
    return;
  }

  AppState.isProcessingQueue = true;

  while (AppState.requestQueue.length > 0) {
    const request = AppState.requestQueue.shift();
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, AppState.rateLimitDelay));
  }

  AppState.isProcessingQueue = false;
}

// Queue API requests
function queueRequest(executeFunction) {
  return new Promise((resolve, reject) => {
    AppState.requestQueue.push({
      execute: executeFunction,
      resolve,
      reject
    });
    processRequestQueue();
  });
}

// Make API request with authentication, caching, and retry logic
async function apiRequest(endpoint, options = {}) {
  // Create cache key
  const cacheKey = `${options.method || 'GET'}_${endpoint}_${JSON.stringify(options.body || '')}`;
  
  // Check if request is already pending
  if (AppState.pendingRequests[cacheKey]) {
    return AppState.pendingRequests[cacheKey];
  }
  
  // Check cache for GET requests
  if ((!options.method || options.method === 'GET') && AppState.cache[cacheKey]) {
    const cached = AppState.cache[cacheKey];
    if (Date.now() - cached.timestamp < AppState.cacheExpiry) {
      return cached.data;
    }
    // Clear expired cache
    delete AppState.cache[cacheKey];
  }

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(AppState.token && { 'Authorization': `Bearer ${AppState.token}` })
    },
    ...options
  };

  // Create the request promise
  const requestPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      
      // Handle rate limiting with retry
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        
        // If retry time is reasonable (less than 5 minutes), wait and retry
        if (retryAfter <= 300) {
          showNotification(`Rate limit reached. Retrying in ${retryAfter} seconds...`, 'warning');
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          
          // Retry the request
          delete AppState.pendingRequests[cacheKey];
          return apiRequest(endpoint, options);
        } else {
          throw new Error(`Too many requests. Please wait ${retryAfter} seconds and try again.`);
        }
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      const data = await response.json();

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.join(', '));
        }
        throw new Error(data.message || 'API request failed');
      }

      // Cache successful GET requests
      if (!options.method || options.method === 'GET') {
        AppState.cache[cacheKey] = {
          data: data,
          timestamp: Date.now()
        };
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      
      if (error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    } finally {
      // Clear pending request
      delete AppState.pendingRequests[cacheKey];
    }
  })();

  // Store pending request
  AppState.pendingRequests[cacheKey] = requestPromise;

  return requestPromise;
}

// Clear cache function
function clearCache(pattern = null) {
  if (pattern) {
    // Clear specific cache entries matching pattern
    Object.keys(AppState.cache).forEach(key => {
      if (key.includes(pattern)) {
        delete AppState.cache[key];
      }
    });
  } else {
    // Clear all cache
    AppState.cache = {};
  }
}

// Check authentication status
async function checkAuth() {
  if (AppState.token) {
    try {
      const data = await apiRequest('/auth/me');
      AppState.currentUser = data.user;
      updateNavigation();
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      AppState.token = null;
      AppState.currentUser = null;
      return false;
    }
  }
  return false;
}

// ======================
// INITIALIZE APP
// ======================

async function initializeApp() {
  try {
    // Check for password reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    
    if (resetToken) {
      // Show reset password page if reset token present
      navigateToPage('resetPassword');
      return;
    }

    // Check if user is logged in
    await checkAuth();

    // Load critical data in parallel with graceful error handling
    await Promise.allSettled([
      loadPlatformStats(),
      loadCategories()
    ]);

    // Set up event listeners
    setupEventListeners();

    // Get last active page from localStorage or default to home
    const lastPage = localStorage.getItem('currentPage');
    
    // If user is logged in and there's a saved page, navigate to it
    if (lastPage && AppState.currentUser) {
      // Check if the saved page requires authentication
      const protectedPages = ['dashboard', 'exchanges', 'messages', 'settings', 'profile'];
      if (protectedPages.includes(lastPage)) {
        navigateToPage(lastPage);
      } else {
        renderPage();
      }
    } else {
      // Render initial page (home or current page)
      renderPage();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showNotification('Error initializing app', 'error');
  }
}

// Load platform statistics
async function loadPlatformStats() {
  try {
    const data = await apiRequest('/stats');
    AppState.platformStats = data.stats;
  } catch (error) {
    console.error('Error loading stats:', error);
    // Set default stats if loading fails
    AppState.platformStats = {
      total_users: 0,
      total_exchanges: 0,
      active_exchanges: 0,
      success_rate: 0,
      average_rating: 0
    };
  }
}

// Load skill categories
async function loadCategories() {
  try {
    const data = await apiRequest('/users/categories');
    AppState.skillCategories = data.categories;

    // Populate category filter dropdown
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="">All Categories</option>' +
        AppState.skillCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    // Fallback categories — must match server/models/Skill.js category enum exactly
    AppState.skillCategories = [
      'Programming & Development',
      'Design & Creative',
      'Business & Finance',
      'Marketing & Sales',
      'Writing & Translation',
      'Music & Audio',
      'Video & Animation',
      'Photography',
      'Health & Fitness',
      'Teaching & Academics',
      'Lifestyle',
      'Data & Analytics',
      'AI & Machine Learning',
      'Other'
    ];

    // Populate with defaults
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="">All Categories</option>' +
        AppState.skillCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
  }
}

// ======================
// EVENT LISTENERS
// ======================

function setupEventListeners() {
  // Navigation links
  document.addEventListener('click', (e) => {
    if (e.target.dataset.page) {
      e.preventDefault();
      navigateToPage(e.target.dataset.page);
    }
  });

  // Mobile navigation toggle
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  // Forms
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetPasswordForm = document.getElementById('resetPasswordForm');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', handleForgotPasswordSubmit);
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', handleResetPasswordSubmit);
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Search and filters
  const skillSearch = document.getElementById('skillSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const levelFilter = document.getElementById('levelFilter');

  if (skillSearch) {
    skillSearch.addEventListener('input', debounce(filterSkills, 500));
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', filterSkills);
  }

  if (levelFilter) {
    levelFilter.addEventListener('change', filterSkills);
  }

  // Modal close
  const closeModal = document.getElementById('closeModal');
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      document.getElementById('exchangeModal').classList.remove('show');
    });
  }

  // Chat input
  const messageInput = document.getElementById('messageInput');
  const sendMessageBtn = document.getElementById('sendMessageBtn');

  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendMessage);
  }
}

// Debounce function for search
function debounce(func, wait) {
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

// ======================
// AUTHENTICATION
// ======================

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value; // Don't trim password - spaces can be valid
  const rememberMe = document.getElementById('rememberMe').checked;

  // Frontend validation
  if (!email || !email.includes('@')) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  if (!password) {
    showNotification('Please enter your password', 'error');
    return;
  }

  if (password.length < 6) {
    showNotification('Password must be at least 6 characters', 'error');
    return;
  }

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    AppState.token = data.token;
    AppState.currentUser = data.user;
    localStorage.setItem('token', data.token);
    
    // Remember email if checkbox is checked
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    updateNavigation();
    showNotification('Welcome back, ' + data.user.name + '!', 'success');
    navigateToPage('dashboard');
  } catch (error) {
    showNotification(error.message || 'Login failed', 'error');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const location = document.getElementById('signupLocation').value.trim();

  // Frontend validation
  if (!name || name.length < 2) {
    showNotification('Name must be at least 2 characters long', 'error');
    return;
  }

  if (!email || !email.includes('@')) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  if (!password || password.length < 6) {
    showNotification('Password must be at least 6 characters long', 'error');
    return;
  }

  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, location })
    });

    AppState.token = data.token;
    AppState.currentUser = data.user;
    localStorage.setItem('token', data.token);

    updateNavigation();
    
    showNotification('Welcome to SkillExchange, ' + name + '! 🎉', 'success');
    navigateToPage('dashboard');
  } catch (error) {
    showNotification(error.message || 'Signup failed', 'error');
  }
}

function handleLogout() {
  AppState.currentUser = null;
  AppState.token = null;
  localStorage.removeItem('token');
  localStorage.removeItem('currentPage'); // Clear saved page on logout
  updateNavigation();
  showNotification('Logged out successfully!', 'success');
  navigateToPage('home');
}

// ======================
// NAVIGATION
// ======================

function navigateToPage(page, userId = null) {
  AppState.currentPage = page;
  
  // Save current page to localStorage for reload persistence
  localStorage.setItem('currentPage', page);

  // Push browser history state so back button works
  history.pushState({ page }, '', '#' + page);

  // Stop all existing polling before starting fresh
  stopAllPolling();

  // Update active nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === page) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Close mobile menu
  const navMenu = document.getElementById('navMenu');
  if (navMenu) {
    navMenu.classList.remove('active');
  }

  // Scroll to top of page
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Start auto-refresh for exchanges tab to detect completion
  startExchangeAutoRefresh(page);

  renderPage(userId);

  // Start page-appropriate polling
  if (page === 'messages') {
    startConversationPolling();
  } else if (page === 'dashboard') {
    startDashboardPolling();
  }
}

// Auto-refresh exchanges to detect when both complete
let exchangeRefreshInterval = null;
function startExchangeAutoRefresh(page) {
  // Clear existing interval if switching away
  if (page !== 'exchanges' && exchangeRefreshInterval) {
    clearInterval(exchangeRefreshInterval);
    exchangeRefreshInterval = null;
    return;
  }
  
  // Start auto-refresh only on exchanges page
  if (page === 'exchanges' && !exchangeRefreshInterval) {
    console.log('🔄 Starting auto-refresh for exchanges (only for active exchanges)');
    exchangeRefreshInterval = setInterval(() => {
      // Only refresh if exchanges are visible
      const exchangesList = document.getElementById('exchangesList');
      if (exchangesList && AppState.currentPage === 'exchanges') {
        // Check if there are any active (non-completed) exchanges
        const hasActiveExchanges = AppState.exchanges.some(ex => ex.status !== 'completed');
        
        if (hasActiveExchanges) {
          // Only refresh active exchanges, not completed ones with ratings
          console.log('🔄 Refreshing active exchanges...');
          renderExchanges();
        } else {
          // Stop auto-refresh if all exchanges are completed
          console.log('✅ All exchanges completed - stopping auto-refresh');
          clearInterval(exchangeRefreshInterval);
          exchangeRefreshInterval = null;
        }
      }
    }, 5000); // Refresh every 5 seconds (only for active exchanges)
  }
}

// ======================
// POLLING HELPERS
// ======================

function stopAllPolling() {
  Object.keys(AppState.pollingIntervals).forEach(key => {
    if (AppState.pollingIntervals[key]) {
      clearInterval(AppState.pollingIntervals[key]);
      AppState.pollingIntervals[key] = null;
    }
  });
}

function startMessagePolling(conversationId) {
  stopMessagePolling();
  AppState.pollingIntervals.messages = setInterval(async () => {
    if (document.hidden || AppState.currentPage !== 'messages' || !AppState.activeConversation) return;
    if (!AppState.activeConversation.exchange_id || !AppState.activeConversation.exchange_id._id) return;
    try {
      const chatMessages = document.getElementById('chatMessages');
      if (!chatMessages) return;
      const atBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;

      const exchangeData = await apiRequest(`/conversations/exchange/${AppState.activeConversation.exchange_id._id}`);
      const messages = exchangeData.messages || [];
      if (!messages.length) return;

      const getStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
      const today = getStartOfDay(new Date());
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const getDateLabel = (d) => {
        const day = getStartOfDay(d).getTime();
        if (day === today.getTime()) return 'Today';
        if (day === yesterday.getTime()) return 'Yesterday';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      let prevLabel = '';
      let html = '';
      messages.forEach(msg => {
        const isOwnMessage = msg.user_id._id === AppState.currentUser._id;
        const userName = msg.user_id.name || 'Unknown';
        const userAvatar = msg.user_id.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
        const timeInline = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateLabel = getDateLabel(msg.timestamp);
        if (dateLabel !== prevLabel) {
          html += `<div class="chat-date-separator"><span>${dateLabel}</span></div>`;
          prevLabel = dateLabel;
        }
        const status = msg.read === true ? 'read' : 'delivered';
        const escapedMessage = (msg.message || '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/\n/g, '<br>');
        html += `
          <div class="message ${isOwnMessage ? 'own' : ''}" data-message-id="${msg._id || ''}">
            <img src="${userAvatar}" alt="${userName}" class="message-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}'">
            <div class="message-content">
              <div class="message-bubble">
                ${escapedMessage}
                <span class="message-meta">
                  <span class="message-time-inline">${timeInline}</span>
                  ${isOwnMessage ? `<span class="msg-status" data-status="${status}">${status === 'read' ? '✓✓' : '✓✓'}</span>` : ''}
                </span>
              </div>
              <div class="message-time">${timeInline}</div>
            </div>
          </div>`;
      });

      chatMessages.innerHTML = html;
      if (atBottom) chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (e) {
      // silently ignore polling errors to avoid console noise
    }
  }, 4000);
}

function stopMessagePolling() {
  if (AppState.pollingIntervals.messages) {
    clearInterval(AppState.pollingIntervals.messages);
    AppState.pollingIntervals.messages = null;
  }
}

function startConversationPolling() {
  stopConversationPolling();
  AppState.pollingIntervals.conversations = setInterval(async () => {
    if (document.hidden || AppState.currentPage !== 'messages') return;
    try {
      await renderConversationsList();
    } catch (e) {}
  }, 10000);
}

function stopConversationPolling() {
  if (AppState.pollingIntervals.conversations) {
    clearInterval(AppState.pollingIntervals.conversations);
    AppState.pollingIntervals.conversations = null;
  }
}

function startDashboardPolling() {
  stopDashboardPolling();
  AppState.pollingIntervals.dashboard = setInterval(async () => {
    if (document.hidden || AppState.currentPage !== 'dashboard') return;
    try {
      const data = await apiRequest('/auth/me');
      if (data && data.user) AppState.currentUser = data.user;
    } catch (e) {}
  }, 30000);
}

function stopDashboardPolling() {
  if (AppState.pollingIntervals.dashboard) {
    clearInterval(AppState.pollingIntervals.dashboard);
    AppState.pollingIntervals.dashboard = null;
  }
}

function navigateToLearningDashboard(learningPathId, exchangeId) {
  // Handle case where learningPathId might be an object (from populated field)
  if (typeof learningPathId === 'object' && learningPathId !== null && learningPathId._id) {
    learningPathId = learningPathId._id;
  }

  console.log('🔗 Navigating to Learning Dashboard');
  console.log('   - Learning Path ID:', learningPathId);
  console.log('   - Exchange ID:', exchangeId);

  if (!learningPathId || learningPathId === 'undefined') {
    console.error('❌ Error: learningPathId is missing or undefined!');
    
    // Try to load from exchange if exchangeId is provided
    if (exchangeId && exchangeId !== 'undefined') {
      console.log('📡 Attempting to fetch learning path via exchange endpoint...');
      loadLearningPathFromExchange(exchangeId);
      return;
    }
    
    alert('Error: Learning path not found. Please try again.');
    return;
  }

  // Store learning path ID in localStorage for dashboard to access
  localStorage.setItem('currentLearningPathId', learningPathId);
  
  if (exchangeId && exchangeId !== 'undefined') {
    localStorage.setItem('currentExchangeId', exchangeId);
  }

  // Navigate to learning dashboard (server serves /client as root, so use /LearningDashboard.html)
  window.location.href = '/LearningDashboard.html?learningPath=' + learningPathId;
}

async function loadLearningPathFromExchange(exchangeId) {
  try {
    console.log('📡 Fetching learning path for exchange:', exchangeId);
    showNotification('Loading your learning path...', 'info');
    
    const response = await apiRequest(`/learning-paths/exchange/${exchangeId}`);
    
    console.log('📡 Server response received:', {
      success: response.success,
      has_learning_path: !!response.learningPath,
      message: response.message
    });
    
    if (response.success && response.learningPath) {
      const lpId = response.learningPath._id;
      const info = response.exchangeInfo;
      
      console.log('✅ Learning path loaded successfully');
      console.log('   Path ID:', lpId);
      console.log('   Role:', info.user_role);
      
      // Store info in localStorage
      localStorage.setItem('currentLearningPathId', lpId);
      localStorage.setItem('currentExchangeId', exchangeId);
      localStorage.setItem('exchangeInfo', JSON.stringify(info));
      
      console.log('🚀 Navigating to Learning Dashboard...');
      showNotification('Opening your learning path...', 'success');
      
      // Navigate to dashboard
      window.location.href = '/LearningDashboard.html?learningPath=' + lpId;
    } else {
      const errorMsg = response.message || 'Learning path not found';
      console.error('❌ Failed to load learning path:', errorMsg);
      if (response.debug) {
        console.error('   Debug info:', response.debug);
      }
      showNotification('Error: ' + errorMsg, 'error');
    }
  } catch (error) {
    console.error('❌ Error loading learning path from exchange:', error);
    console.error('   Stack:', error.stack);
    showNotification('Error loading learning path. Please try again.', 'error');
  }
}

// Mark the current user's learning as complete from the exchanges list
async function markLearningComplete(learningPathId, exchangeId) {
  if (!confirm('Are you sure you want to mark your learning as complete? This cannot be undone.')) return;
  try {
    showNotification('Marking learning as complete…', 'info');
    const res = await apiRequest(`/learning-paths/${learningPathId}/complete`, { method: 'PUT' });
    if (res.success) {
      showNotification('🎉 Learning marked complete!', 'success');
      // Refresh exchanges so the progress card updates immediately
      await renderExchanges();
    } else {
      showNotification(res.message || 'Could not mark complete. Try again.', 'error');
    }
  } catch (err) {
    console.error('markLearningComplete error:', err);
    showNotification('Error: ' + (err.message || 'Try again'), 'error');
  }
}



function renderPage(userId = null) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });

  // Show current page
  const currentPageElement = document.getElementById(AppState.currentPage + 'Page');
  if (currentPageElement) {
    currentPageElement.style.display = 'block';
  }

  // Render page content
  switch (AppState.currentPage) {
    case 'home':
      renderHomePage();
      break;
    case 'login':
      loadRememberedEmail();
      break;
    case 'resetPassword':
      // Password reset form is displayed, no additional rendering needed
      break;
    case 'forgotPassword':
      renderForgotPassword();
      break;
    case 'dashboard':
      if (AppState.currentUser) {
        renderDashboard();
      } else {
        navigateToPage('login');
      }
      break;
    case 'marketplace':
      renderMarketplace();
      break;
    case 'profile':
      renderProfile(userId);
      break;
    case 'exchanges':
      if (AppState.currentUser) {
        renderExchanges();
      } else {
        navigateToPage('login');
      }
      break;
    case 'messages':
      if (AppState.currentUser) {
        renderMessages();
      } else {
        navigateToPage('login');
      }
      break;
    case 'settings':
      if (AppState.currentUser) {
        renderSettings();
      } else {
        navigateToPage('login');
      }
      break;
  }
}

function updateNavigation() {
  const navAuth = document.getElementById('navAuth');
  const navUser = document.getElementById('navUser');
  const dashboardLink = document.getElementById('dashboardLink');
  const exchangesLink = document.getElementById('exchangesLink');
  const messagesLink = document.getElementById('messagesLink');
  const profileLink = document.getElementById('profileLink');
  const settingsLink = document.getElementById('settingsLink');
  const userTokens = document.getElementById('userTokens');
  const userAvatar = document.getElementById('userAvatar');

  if (AppState.currentUser) {
    navAuth.style.display = 'none';
    navUser.style.display = 'flex';
    dashboardLink.style.display = 'block';
    exchangesLink.style.display = 'block';
    messagesLink.style.display = 'block';
    profileLink.style.display = 'block';
    settingsLink.style.display = 'block';
    userTokens.textContent = `${AppState.currentUser.tokens_earned} tokens`;
    const navAvatarUrl = AppState.currentUser.profilePicture || AppState.currentUser.avatar || getDefaultAvatar(AppState.currentUser.name);
    userAvatar.style.backgroundImage = `url(${navAvatarUrl})`;
    userAvatar.style.backgroundSize = 'cover';
    userAvatar.style.backgroundPosition = 'center';
  } else {
    navAuth.style.display = 'flex';
    navUser.style.display = 'none';
    dashboardLink.style.display = 'none';
    exchangesLink.style.display = 'none';
    messagesLink.style.display = 'none';
    profileLink.style.display = 'none';
    settingsLink.style.display = 'none';
  }
}

// ======================
// SKILL IMAGE & UTILITY FUNCTIONS
// ======================

// Category colors mapping for gradient backgrounds (keys match Skill model enum)
const CATEGORY_COLORS = {
  'Programming & Development': { primary: '#667eea', secondary: '#764ba2' },
  'Design & Creative':         { primary: '#f093fb', secondary: '#f5576c' },
  'Business & Finance':        { primary: '#30cfd0', secondary: '#330867' },
  'Marketing & Sales':         { primary: '#a8edea', secondary: '#fed6e3' },
  'Writing & Translation':     { primary: '#ff9a9e', secondary: '#fecfef' },
  'Music & Audio':             { primary: '#fa709a', secondary: '#fee140' },
  'Video & Animation':         { primary: '#ff6e7f', secondary: '#bfe9ff' },
  'Photography':               { primary: '#ffecd2', secondary: '#fcb69f' },
  'Health & Fitness':          { primary: '#56ab2f', secondary: '#a8e063' },
  'Teaching & Academics':      { primary: '#a1c4fd', secondary: '#c2e9fb' },
  'Lifestyle':                 { primary: '#ffd89b', secondary: '#19547b' },
  'Data & Analytics':          { primary: '#30cfd0', secondary: '#330867' },
  'AI & Machine Learning':     { primary: '#667eea', secondary: '#764ba2' },
  'Other':                     { primary: '#667eea', secondary: '#764ba2' }
};

// Category emojis (match Skill model enum)
const CATEGORY_EMOJIS = {
  'Programming & Development': '💻',
  'Design & Creative':         '🎨',
  'Business & Finance':        '💼',
  'Marketing & Sales':         '📢',
  'Writing & Translation':     '✍️',
  'Music & Audio':             '🎵',
  'Video & Animation':         '🎬',
  'Photography':               '📷',
  'Health & Fitness':          '💪',
  'Teaching & Academics':      '📚',
  'Lifestyle':                 '🌿',
  'Data & Analytics':          '📊',
  'AI & Machine Learning':     '🤖',
  'Other':                     '⭐'
};

// =============================================
// SKILL-SPECIFIC DYNAMIC BACKGROUNDS
// Keys are lowercase keywords matched against skill name
// =============================================
const SKILL_BACKGROUNDS = {
  // --- Programming Languages ---
  'javascript':     { grad: 'linear-gradient(135deg, #f7df1e 0%, #c8a400 100%)', emoji: '⚡', dark: true },
  ' js ':           { grad: 'linear-gradient(135deg, #f7df1e 0%, #c8a400 100%)', emoji: '⚡', dark: true },
  'typescript':     { grad: 'linear-gradient(135deg, #3178c6 0%, #235a97 100%)', emoji: '🔷' },
  'python':         { grad: 'linear-gradient(135deg, #3776ab 0%, #ffd43b 100%)', emoji: '🐍' },
  'java ':          { grad: 'linear-gradient(135deg, #ed8b00 0%, #005891 100%)', emoji: '☕' },
  'c++':            { grad: 'linear-gradient(135deg, #00599c 0%, #004482 100%)', emoji: '⚙️' },
  'c#':             { grad: 'linear-gradient(135deg, #239120 0%, #68217a 100%)', emoji: '🎯' },
  'ruby':           { grad: 'linear-gradient(135deg, #cc342d 0%, #a02020 100%)', emoji: '💎' },
  'php':            { grad: 'linear-gradient(135deg, #8892bf 0%, #4f5b93 100%)', emoji: '🐘' },
  'swift':          { grad: 'linear-gradient(135deg, #f05138 0%, #d44f29 100%)', emoji: '🦅' },
  'kotlin':         { grad: 'linear-gradient(135deg, #7f52ff 0%, #c811e1 100%)', emoji: '📱' },
  'rust':           { grad: 'linear-gradient(135deg, #dea584 0%, #a86b3c 100%)', emoji: '⚙️' },
  'golang':         { grad: 'linear-gradient(135deg, #00add8 0%, #007d9c 100%)', emoji: '🐹' },
  ' go ':           { grad: 'linear-gradient(135deg, #00add8 0%, #007d9c 100%)', emoji: '🐹' },
  'scala':          { grad: 'linear-gradient(135deg, #dc322f 0%, #a8291f 100%)', emoji: '🔴' },
  'perl':           { grad: 'linear-gradient(135deg, #39457e 0%, #2d3561 100%)', emoji: '🐪' },
  'r programming':  { grad: 'linear-gradient(135deg, #2165b6 0%, #75aadb 100%)', emoji: '📊' },
  'dart':           { grad: 'linear-gradient(135deg, #0175c2 0%, #01579b 100%)', emoji: '🎯' },
  'flutter':        { grad: 'linear-gradient(135deg, #54c5f8 0%, #0175c2 100%)', emoji: '📱' },
  // --- Frontend Frameworks ---
  'react':          { grad: 'linear-gradient(135deg, #61dafb 0%, #20232a 100%)', emoji: '⚛️' },
  'vue':            { grad: 'linear-gradient(135deg, #42b883 0%, #35495e 100%)', emoji: '💚' },
  'angular':        { grad: 'linear-gradient(135deg, #dd0031 0%, #c3002f 100%)', emoji: '🔴' },
  'svelte':         { grad: 'linear-gradient(135deg, #ff3e00 0%, #c7310a 100%)', emoji: '🔥' },
  'next.js':        { grad: 'linear-gradient(135deg, #000000 0%, #444444 100%)', emoji: '▲' },
  'tailwind':       { grad: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', emoji: '💨' },
  'bootstrap':      { grad: 'linear-gradient(135deg, #7952b3 0%, #553c8f 100%)', emoji: '🎛️' },
  // --- Web Basics ---
  'html':           { grad: 'linear-gradient(135deg, #e44d26 0%, #f16529 100%)', emoji: '🌐' },
  'css':            { grad: 'linear-gradient(135deg, #264de4 0%, #2965f1 100%)', emoji: '🎨' },
  'sass':           { grad: 'linear-gradient(135deg, #cd6799 0%, #a14771 100%)', emoji: '💅' },
  'web development':{ grad: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', emoji: '🌐' },
  'web design':     { grad: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '🎨' },
  // --- Backend ---
  'node':           { grad: 'linear-gradient(135deg, #339933 0%, #1a1a1a 100%)', emoji: '🟢' },
  'express':        { grad: 'linear-gradient(135deg, #404040 0%, #1a1a1a 100%)', emoji: '🚂' },
  'django':         { grad: 'linear-gradient(135deg, #0c4b33 0%, #092b1d 100%)', emoji: '🎸' },
  'flask':          { grad: 'linear-gradient(135deg, #444444 0%, #222222 100%)', emoji: '🧪' },
  'spring':         { grad: 'linear-gradient(135deg, #6db33f 0%, #4a7c2f 100%)', emoji: '🍃' },
  'laravel':        { grad: 'linear-gradient(135deg, #ff2d20 0%, #c41c14 100%)', emoji: '🔥' },
  'fastapi':        { grad: 'linear-gradient(135deg, #009688 0%, #00796b 100%)', emoji: '⚡' },
  // --- Databases ---
  'mysql':          { grad: 'linear-gradient(135deg, #4479a1 0%, #e38c00 100%)', emoji: '🐬' },
  'postgresql':     { grad: 'linear-gradient(135deg, #336791 0%, #1e4566 100%)', emoji: '🐘' },
  'mongodb':        { grad: 'linear-gradient(135deg, #47a248 0%, #1a7a3a 100%)', emoji: '🍃' },
  'redis':          { grad: 'linear-gradient(135deg, #dc382d 0%, #a0281f 100%)', emoji: '🔴' },
  'firebase':       { grad: 'linear-gradient(135deg, #ffca28 0%, #f57c00 100%)', emoji: '🔥', dark: true },
  'graphql':        { grad: 'linear-gradient(135deg, #e10098 0%, #85005b 100%)', emoji: '◉' },
  ' sql':           { grad: 'linear-gradient(135deg, #4479a1 0%, #2d5b7e 100%)', emoji: '🗄️' },
  // --- DevOps & Cloud ---
  'docker':         { grad: 'linear-gradient(135deg, #2496ed 0%, #1d7dc4 100%)', emoji: '🐳' },
  'kubernetes':     { grad: 'linear-gradient(135deg, #326ce5 0%, #1b52c7 100%)', emoji: '☸️' },
  'aws':            { grad: 'linear-gradient(135deg, #ff9900 0%, #232f3e 100%)', emoji: '☁️' },
  'azure':          { grad: 'linear-gradient(135deg, #0078d4 0%, #005a9e 100%)', emoji: '🔷' },
  'google cloud':   { grad: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)', emoji: '☁️' },
  'devops':         { grad: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)', emoji: '⚙️' },
  ' git':           { grad: 'linear-gradient(135deg, #f05032 0%, #de4c36 100%)', emoji: '🌿' },
  'linux':          { grad: 'linear-gradient(135deg, #fcc624 0%, #2c2c2c 100%)', emoji: '🐧', dark: true },
  'terraform':      { grad: 'linear-gradient(135deg, #7b42bc 0%, #5e3392 100%)', emoji: '🏗️' },
  'jenkins':        { grad: 'linear-gradient(135deg, #d33833 0%, #a82a26 100%)', emoji: '🔧' },
  // --- Design Tools ---
  'figma':          { grad: 'linear-gradient(135deg, #f24e1e 0%, #a259ff 100%)', emoji: '🎭' },
  'photoshop':      { grad: 'linear-gradient(135deg, #001d34 0%, #31a8ff 100%)', emoji: '🖼️' },
  'illustrator':    { grad: 'linear-gradient(135deg, #330000 0%, #ff7c00 100%)', emoji: '✏️' },
  'blender':        { grad: 'linear-gradient(135deg, #e87d0d 0%, #265787 100%)', emoji: '🎮' },
  'sketch':         { grad: 'linear-gradient(135deg, #f7b500 0%, #e69700 100%)', emoji: '💎', dark: true },
  'canva':          { grad: 'linear-gradient(135deg, #00c4cc 0%, #0093d0 100%)', emoji: '🖌️' },
  'after effects':  { grad: 'linear-gradient(135deg, #9999ff 0%, #6666cc 100%)', emoji: '🎬' },
  'premiere':       { grad: 'linear-gradient(135deg, #9999ff 0%, #2a0a3e 100%)', emoji: '🎬' },
  // --- Data & ML ---
  'machine learning': { grad: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '🧠' },
  'deep learning':  { grad: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)', emoji: '🧠' },
  'tensorflow':     { grad: 'linear-gradient(135deg, #ff6f00 0%, #ffa000 100%)', emoji: '🤖' },
  'pytorch':        { grad: 'linear-gradient(135deg, #ee4c2c 0%, #c0392b 100%)', emoji: '🔥' },
  'data science':   { grad: 'linear-gradient(135deg, #0f3460 0%, #e94560 100%)', emoji: '📊' },
  'excel':          { grad: 'linear-gradient(135deg, #217346 0%, #107c10 100%)', emoji: '📊' },
  'tableau':        { grad: 'linear-gradient(135deg, #e97627 0%, #005073 100%)', emoji: '📈' },
  'pandas':         { grad: 'linear-gradient(135deg, #150458 0%, #e70488 100%)', emoji: '🐼' },
  'power bi':       { grad: 'linear-gradient(135deg, #f2c811 0%, #d4a00f 100%)', emoji: '📊', dark: true },
  // --- Music Instruments ---
  'guitar':         { grad: 'linear-gradient(135deg, #b5651d 0%, #8b4513 100%)', emoji: '🎸' },
  'piano':          { grad: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', emoji: '🎹' },
  'drums':          { grad: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)', emoji: '🥁' },
  'violin':         { grad: 'linear-gradient(135deg, #8b4513 0%, #5d2e0c 100%)', emoji: '🎻' },
  'singing':        { grad: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)', emoji: '🎤' },
  'ukulele':        { grad: 'linear-gradient(135deg, #f9ca24 0%, #f0932b 100%)', emoji: '🎵', dark: true },
  'bass':           { grad: 'linear-gradient(135deg, #6c3483 0%, #4a235a 100%)', emoji: '🎸' },
  // --- Languages ---
  'english':        { grad: 'linear-gradient(135deg, #012169 0%, #c8102e 100%)', emoji: '🇬🇧' },
  'spanish':        { grad: 'linear-gradient(135deg, #c60b1e 0%, #ffc400 100%)', emoji: '🇪🇸' },
  'french':         { grad: 'linear-gradient(135deg, #002395 0%, #ed2939 100%)', emoji: '🇫🇷' },
  'german':         { grad: 'linear-gradient(135deg, #000000 0%, #dd0000 100%)', emoji: '🇩🇪' },
  'japanese':       { grad: 'linear-gradient(135deg, #bc002d 0%, #8b0000 100%)', emoji: '🇯🇵' },
  'chinese':        { grad: 'linear-gradient(135deg, #de2910 0%, #ffd700 100%)', emoji: '🇨🇳' },
  'hindi':          { grad: 'linear-gradient(135deg, #ff9933 0%, #138808 100%)', emoji: '🇮🇳' },
  'arabic':         { grad: 'linear-gradient(135deg, #009736 0%, #ce1126 100%)', emoji: '🌙' },
  'portuguese':     { grad: 'linear-gradient(135deg, #006600 0%, #ff0000 100%)', emoji: '🇵🇹' },
  // --- Health & Fitness ---
  'yoga':           { grad: 'linear-gradient(135deg, #9b59b6 0%, #6c3483 100%)', emoji: '🧘' },
  'gym':            { grad: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)', emoji: '🏋️' },
  'nutrition':      { grad: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)', emoji: '🥗' },
  'meditation':     { grad: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', emoji: '🧘' },
  // --- Photography & Video ---
  'photography':    { grad: 'linear-gradient(135deg, #2c3e50 0%, #e74c3c 100%)', emoji: '📷' },
  'videography':    { grad: 'linear-gradient(135deg, #e74c3c 0%, #8e44ad 100%)', emoji: '🎬' },
  'youtube':        { grad: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)', emoji: '▶️' },
  'editing':        { grad: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)', emoji: '✂️' },
  // --- Business ---
  'marketing':      { grad: 'linear-gradient(135deg, #fd7e14 0%, #e04e00 100%)', emoji: '📢' },
  'finance':        { grad: 'linear-gradient(135deg, #27ae60 0%, #1e8449 100%)', emoji: '💰' },
  'accounting':     { grad: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)', emoji: '🧾' },
  'seo':            { grad: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)', emoji: '🔍' },
  'social media':   { grad: 'linear-gradient(135deg, #405de6 0%, #e1306c 100%)', emoji: '📱' },
  'copywriting':    { grad: 'linear-gradient(135deg, #2c3e50 0%, #e74c3c 100%)', emoji: '✍️' },
  // --- Writing ---
  'writing':        { grad: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', emoji: '✍️' },
  'blogging':       { grad: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', emoji: '📝' }
};

/**
 * Returns a background config { grad, emoji } by matching the skill name
 * against SKILL_BACKGROUNDS keywords (longest match wins).
 */
function getSkillBackground(skillName) {
  const lower = ' ' + (skillName || '').toLowerCase() + ' ';
  // Prefer longer keyword matches (more specific wins)
  let best = null;
  let bestLen = 0;
  for (const key of Object.keys(SKILL_BACKGROUNDS)) {
    if (lower.includes(key) && key.length > bestLen) {
      best = SKILL_BACKGROUNDS[key];
      bestLen = key.length;
    }
  }
  return best;
}

// Get gradient colors for a category
function getCategoryGradient(category) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  return `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`;
}

// Get emoji icon for a category
function getCategoryEmoji(category) {
  return CATEGORY_EMOJIS[category] || '⭐';
}

// Get skill image config: custom thumbnail > skill-name match > category gradient
function getSkillImage(skill) {
  // 1. Custom thumbnail wins
  if (skill.thumbnail && skill.thumbnail.trim() !== '') {
    return { type: 'image', value: skill.thumbnail };
  }
  // 2. Match skill name against specific technology keywords
  const match = getSkillBackground(skill.name);
  if (match) {
    return { type: 'gradient', value: match.grad, emoji: match.emoji, darkText: !!match.dark };
  }
  // 3. Category-level gradient fallback
  return {
    type: 'gradient',
    value: getCategoryGradient(skill.category),
    emoji: getCategoryEmoji(skill.category),
    darkText: false
  };
}

// ======================


async function renderHomePage() {
  try {
    // Load all skills for featured section
    const data = await apiRequest('/users/skills/all');
    AppState.featuredSkills = data.skills.slice(0, 4);

    const featuredSkillsGrid = document.getElementById('featuredSkillsGrid');
    if (featuredSkillsGrid) {
      if (AppState.featuredSkills.length > 0) {
        featuredSkillsGrid.innerHTML = AppState.featuredSkills.map(skill => {
          const skillImage = getSkillImage(skill);
          const imageStyle = skillImage.type === 'image'
            ? `background-image: url('${skillImage.value}'); background-size: cover; background-position: center;`
            : `background: ${skillImage.value};`;
          const skillEmoji = skillImage.emoji || getCategoryEmoji(skill.category);
          const textColor = skillImage.darkText ? 'rgba(0,0,0,0.85)' : 'white';

          return `
            <div class="skill-card">
              <div class="skill-image" style="${imageStyle}; position: relative; height: 140px; overflow: hidden; border-radius: var(--radius-md) var(--radius-md) 0 0;">
                <div style="position: absolute; top: 10px; right: 10px; width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.22); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; font-size: 22px; border: 2px solid rgba(255,255,255,0.4);">
                  ${skillEmoji}
                </div>
              </div>
              <div class="skill-info">
                <h3 class="skill-name">${skill.name}</h3>
                <p class="skill-provider">by ${skill.user.name}</p>
                <div class="skill-category" style="margin-top: 8px; font-size: 12px; color: var(--color-text-secondary);">
                  ${getCategoryEmoji(skill.category)} ${skill.category}
                </div>
                <div class="skill-rating">⭐ ${skill.user.rating.toFixed(1)}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        featuredSkillsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--color-text-secondary);">
            <p>No skills available yet. Be the first to add your skills!</p>
          </div>
        `;
      }
    }

    // Update platform stats
    if (AppState.platformStats) {
      const statNumbers = document.querySelectorAll('.stat-number');
      if (statNumbers[0]) statNumbers[0].textContent = AppState.platformStats.total_users?.toLocaleString() || '0';
      if (statNumbers[1]) statNumbers[1].textContent = AppState.platformStats.total_exchanges?.toLocaleString() || '0';
      if (statNumbers[2]) statNumbers[2].textContent = AppState.platformStats.success_rate + '%' || '0%';
    }
  } catch (error) {
    console.error('Error rendering home page:', error);
    
    // Show error-friendly UI instead of crashing
    const featuredSkillsGrid = document.getElementById('featuredSkillsGrid');
    if (featuredSkillsGrid) {
      featuredSkillsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
          <p style="color: var(--color-error); margin-bottom: 10px;">⚠️ Unable to load featured skills</p>
          <p style="color: var(--color-text-secondary); font-size: 14px;">${error.message}</p>
          <button class="btn btn--primary" onclick="renderHomePage()" style="margin-top: 20px;">
            Try Again
          </button>
        </div>
      `;
    }
    
    // Set default stats
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers[0]) statNumbers[0].textContent = '0';
    if (statNumbers[1]) statNumbers[1].textContent = '0';
    if (statNumbers[2]) statNumbers[2].textContent = '0%';
  }
}

// ======================
// DASHBOARD
// ======================

async function renderDashboard() {
  if (!AppState.currentUser) {
    console.warn('No current user found, redirecting to login');
    navigateToPage('login');
    return;
  }

  const user = AppState.currentUser;

  // Update profile card
  const dashboardAvatar = document.getElementById('dashboardAvatar');
  const dashboardUserName = document.getElementById('dashboardUserName');
  const dashboardUserBio = document.getElementById('dashboardUserBio');
  const userTotalExchanges = document.getElementById('userTotalExchanges');
  const userTokenCount = document.getElementById('userTokenCount');
  const userRating = document.getElementById('userRating');

  if (dashboardAvatar) {
    const avatarUrl = user.profilePicture || user.avatar || getDefaultAvatar(user.name);
    dashboardAvatar.src = avatarUrl;
    dashboardAvatar.alt = user.name || 'User';
  }
  if (dashboardUserName) dashboardUserName.textContent = user.name || 'User';
  if (dashboardUserBio) dashboardUserBio.textContent = user.bio || 'New SkillExchange member';
  if (userTotalExchanges) userTotalExchanges.textContent = user.total_exchanges || 0;
  if (userTokenCount) {
    const tokens = user.tokens_earned || 0;
    userTokenCount.textContent = tokens;
    // Add tooltip showing token info
    userTokenCount.title = `Total Tokens: ${tokens}\nClick to view history`;
    userTokenCount.style.cursor = 'pointer';
    userTokenCount.onclick = () => showTokenHistory();
  }
  if (userRating) userRating.textContent = (user.rating || 0).toFixed(1);

  // Render sections
  renderDashboardSkills();
  await renderRecommendedMatches();
  await renderActiveExchanges();
  renderUserBadges();
  await renderRecentMessages();
  await renderLearnedSkills(); // Add learned skills section
  await renderTaughtSkills(); // Add taught skills section
  
  // Show profile completion widget for new users
  renderProfileCompletion();
}

// Render dashboard skills section
function renderDashboardSkills() {
  const dashboardSkills = document.getElementById('dashboardSkills');
  if (!dashboardSkills || !AppState.currentUser) return;

  const skills = AppState.currentUser.skills_offered || [];

  if (skills.length === 0) {
    dashboardSkills.innerHTML = `
      <div style="padding: 32px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
        <div style="font-size: 48px; margin-bottom: 12px;">🎯</div>
        <p style="color: var(--color-text-secondary); margin-bottom: 16px; font-weight: 500;">No skills added yet</p>
        <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 20px;">Add your first skill to start exchanging with others!</p>
        <button class="btn btn--primary" onclick="showAddSkillModal('offered')">+ Add Your First Skill</button>
      </div>
    `;
    return;
  }

  dashboardSkills.innerHTML = skills.map(skill => {
    const skillImage = getSkillImage(skill);
    const imageStyle = skillImage.type === 'image' 
      ? `background-image: url('${skillImage.value}'); background-size: cover; background-position: center;`
      : `background: ${skillImage.value}; display: flex; align-items: center; justify-content: center;`;
    
    const imageContent = skillImage.type === 'gradient' 
      ? `<span style="font-size: 32px;">${skillImage.emoji}</span>` 
      : '';

    return `
      <div class="dashboard-skill-item" style="display: flex; gap: 12px; background: var(--color-surface); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--color-card-border); transition: all 0.2s;">
        <div class="dashboard-skill-thumbnail" style="${imageStyle}; width: 80px; height: 80px; border-radius: var(--radius-md); flex-shrink: 0;">
          ${imageContent}
        </div>
        <div class="dashboard-skill-info" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
          <div class="dashboard-skill-name" style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">${skill.name}</div>
          <div class="dashboard-skill-category" style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 6px;">
            ${getCategoryEmoji(skill.category)} ${skill.category}
          </div>
          <div class="dashboard-skill-level" style="display: inline-block; background: var(--color-primary-light); color: var(--color-primary); padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; width: fit-content;">
            ${skill.experience_level}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render profile completion widget
function renderProfileCompletion() {
  if (!AppState.currentUser) return;

  const user = AppState.currentUser;
  const widget = document.getElementById('profileCompletionWidget');
  const tasksContainer = document.getElementById('completionTasks');
  const barFill = document.getElementById('completionBarFill');
  const percentage = document.getElementById('completionPercentage');

  // Calculate profile completion
  const tasks = [
    {
      id: 'avatar',
      icon: '📷',
      text: 'Add profile picture',
      completed: user.avatar && !user.avatar.includes('ui-avatars.com'),
      action: 'Edit Profile',
      onclick: 'showEditProfileModal()'
    },
    {
      id: 'bio',
      icon: '✍️',
      text: 'Write your bio',
      completed: user.bio && user.bio !== 'New SkillExchange member',
      action: 'Add Bio',
      onclick: 'showEditProfileModal()'
    },
    {
      id: 'skills',
      icon: '🎯',
      text: 'Add at least one skill',
      completed: user.skills_offered && user.skills_offered.length > 0,
      action: 'Add Skill',
      onclick: "showAddSkillModal('offered')"
    },
    {
      id: 'location',
      icon: '📍',
      text: 'Set your location',
      completed: user.location && user.location.trim() !== '',
      action: 'Set Location',
      onclick: 'showEditProfileModal()'
    }
  ];

  const completedTasks = tasks.filter(t => t.completed).length;
  const completionPercent = Math.round((completedTasks / tasks.length) * 100);

  // Hide widget if profile is 100% complete or user has dismissed it
  if (completionPercent === 100 || localStorage.getItem('hideProfileCompletion') === 'true') {
    widget.style.display = 'none';
    return;
  }

  widget.style.display = 'block';

  // Update progress bar
  if (barFill) barFill.style.width = `${completionPercent}%`;
  if (percentage) percentage.textContent = `${completionPercent}%`;

  // Render tasks
  if (tasksContainer) {
    tasksContainer.innerHTML = tasks.map(task => `
      <div class="completion-task ${task.completed ? 'completed' : ''}">
        <div class="completion-task-info">
          <span class="completion-task-icon">${task.icon}</span>
          <span class="completion-task-text">${task.text}</span>
        </div>
        <button class="completion-task-action" onclick="${task.onclick}">
          ${task.completed ? '✓ Done' : task.action}
        </button>
      </div>
    `).join('');
  }
}

// Hide profile completion widget
function hideProfileCompletion() {
  localStorage.setItem('hideProfileCompletion', 'true');
  document.getElementById('profileCompletionWidget').style.display = 'none';
}

// Show token history modal
async function showTokenHistory() {
  try {
    const data = await apiRequest(`/users/${AppState.currentUser._id}/tokens`);
    const tokenData = data.tokens;

    const historyHTML = tokenData.history.length > 0
      ? tokenData.history.slice(0, 10).map(entry => `
          <div style="padding: 12px; border-bottom: 1px solid var(--color-card-border); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 500;">${entry.reason}</div>
              <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">
                ${new Date(entry.date).toLocaleDateString()} - ${entry.type}
              </div>
            </div>
            <div style="font-weight: 600; font-size: 18px; color: ${entry.amount > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
              ${entry.amount > 0 ? '+' : ''}${entry.amount}
            </div>
          </div>
        `).join('')
      : '<div style="padding: 24px; text-align: center; color: var(--color-text-secondary);">No token history yet</div>';

    showNotification(`Token Balance: ${tokenData.current} | Total Earned: ${tokenData.total_earned}`, 'success');
  } catch (error) {
    showNotification('Failed to load token history', 'error');
  }
}

async function renderRecommendedMatches() {
  const recommendedMatches = document.getElementById('recommendedMatches');
  if (!recommendedMatches || !AppState.currentUser) return;

  try {
    const data = await apiRequest('/users/matches/recommendations');
    const matches = data.matches;

    recommendedMatches.innerHTML = matches.length > 0
      ? matches.slice(0, 3).map(match => {
          // Determine compatibility badge color
          const compatibilityColor = match.compatibility === 'high' 
            ? 'var(--color-success)' 
            : match.compatibility === 'medium' 
            ? 'var(--color-warning)' 
            : 'var(--color-info)';
          
          const compatibilityLabel = match.compatibility === 'high' 
            ? 'Excellent Match' 
            : match.compatibility === 'medium' 
            ? 'Good Match' 
            : 'Potential Match';

          // Get the first matched skill info
          const firstMatch = match.matchedSkills[0];
          const skillName = firstMatch?.skill?.name || 'Skills';
          const skillLevel = firstMatch?.skill?.experience_level || 'intermediate';
          const skillDescription = firstMatch?.skill?.description || 'Explore skill exchange opportunities';

          return `
          <div class="match-card" style="background: var(--color-surface); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 12px; border: 1px solid var(--color-card-border); position: relative;">
            ${match.bidirectionalMatch ? `
              <div style="position: absolute; top: 8px; right: 8px; background: linear-gradient(135deg, var(--color-primary), var(--color-teal-700)); color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0a1 1 0 0 1 1 1v5.268l4.562-2.634a1 1 0 1 1 1 1.732L10 8l4.562 2.634a1 1 0 1 1-1 1.732L9 9.732V15a1 1 0 1 1-2 0V9.732l-4.562 2.634a1 1 0 1 1-1-1.732L6 8 1.438 5.366a1 1 0 0 1 1-1.732L7 6.268V1a1 1 0 0 1 1-1z"/>
                </svg>
                Perfect Match
              </div>
            ` : ''}
            
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-top: ${match.bidirectionalMatch ? '24px' : '0'};">
              <img src="${match.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.user.name)}&background=21808d&color=fff&size=128`}" 
                   alt="${match.user.name}"
                   style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid ${compatibilityColor};">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                  <div style="font-weight: 600; font-size: 15px; color: var(--color-text);">${match.user.name}</div>
                  <div style="background: ${compatibilityColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">
                    ${compatibilityLabel}
                  </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                  <div style="font-size: 13px; color: var(--color-primary); font-weight: 500;">
                    ${skillName}
                  </div>
                  <span style="color: var(--color-text-secondary);">•</span>
                  <div style="font-size: 12px; color: var(--color-text-secondary); text-transform: capitalize;">
                    ${skillLevel}
                  </div>
                  ${match.matchedSkills.length > 1 ? `
                    <span style="color: var(--color-text-secondary);">•</span>
                    <div style="font-size: 11px; color: var(--color-primary); font-weight: 500;">
                      +${match.matchedSkills.length - 1} more skill${match.matchedSkills.length > 2 ? 's' : ''}
                    </div>
                  ` : ''}
                </div>

                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary);">
                    <svg width="14" height="14" fill="var(--color-warning)" viewBox="0 0 16 16">
                      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
                    </svg>
                    ${match.user.rating ? match.user.rating.toFixed(1) : 'New'}
                  </div>
                  <span style="color: var(--color-text-secondary);">•</span>
                  <div style="font-size: 12px; color: var(--color-text-secondary);">
                    ${match.user.total_exchanges || 0} exchange${match.user.total_exchanges !== 1 ? 's' : ''}
                  </div>
                </div>

                <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0 0 12px 0; line-height: 1.5;">
                  ${skillDescription.length > 80 ? skillDescription.substring(0, 80) + '...' : skillDescription}
                </p>
                
                <button class="btn btn--primary btn--sm" onclick="openExchangeModal('${match.user._id}', '${skillName}')" style="width: 100%;">
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 6px;">
                    <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
                  </svg>
                  Request Exchange
                </button>
              </div>
            </div>
          </div>
        `}).join('')
      : `<div style="text-align: center; padding: 32px 16px; color: var(--color-text-secondary);">
          <svg width="64" height="64" fill="currentColor" viewBox="0 0 16 16" style="opacity: 0.3; margin-bottom: 16px;">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          <p style="font-weight: 500; margin-bottom: 8px;">No matches found yet</p>
          <p style="font-size: 14px; margin: 0;">Add skills you want to learn in your profile to discover potential learning partners!</p>
        </div>`;
  } catch (error) {
    recommendedMatches.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading matches</p>';
  }
}

async function renderActiveExchanges() {
  const activeExchanges = document.getElementById('activeExchanges');
  if (!activeExchanges || !AppState.currentUser) return;

  try {
    const data = await apiRequest('/exchanges?status=active');
    const exchanges = data.exchanges;

    activeExchanges.innerHTML = exchanges.length > 0
      ? exchanges
          .filter(exchange => exchange.requester_id && exchange.provider_id) // Skip exchanges with deleted users
          .map(exchange => {
            const _rqId = exchange.requester_id?._id || exchange.requester_id;
            const otherUser = _rqId?.toString() === AppState.currentUser._id?.toString()
              ? exchange.provider_id
              : exchange.requester_id;

            return `
              <div class="exchange-card" style="background: var(--color-surface); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 12px; border: 1px solid var(--color-card-border);">
                <div class="flex items-center gap-8 mb-8">
                  <img src="${otherUser.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(otherUser.name || 'User')}" alt="${otherUser.name || 'User'}"
                     style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                <div>
                  <div style="font-weight: 500;">${otherUser.name}</div>
                  <div style="font-size: 12px; color: var(--color-text-secondary);">
                    Learning: ${exchange.requested_skill}
                  </div>
                </div>
              </div>
              <button class="btn btn--outline btn--sm" onclick="navigateToPage('messages')">
                View Messages
              </button>
            </div>
          `;
        }).join('')
      : '<p style="color: var(--color-text-secondary);">No active exchanges.</p>';
  } catch (error) {
    activeExchanges.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading exchanges</p>';
  }
}

function renderUserBadges() {
  const userBadges = document.getElementById('userBadges');
  if (!userBadges || !AppState.currentUser) return;

  // Ensure badges array exists, default to ['New Member'] for new users
  const badges = AppState.currentUser.badges || ['New Member'];

  userBadges.innerHTML = badges.length > 0
    ? badges.map(badge => `
        <div class="badge" style="display: inline-block; background: var(--color-secondary); padding: 6px 12px; border-radius: var(--radius-full); font-size: 12px; margin-right: 8px; margin-bottom: 8px;">${badge}</div>
      `).join('')
    : '<p style="color: var(--color-text-secondary);">No badges earned yet.</p>';
}

async function renderRecentMessages() {
  const recentMessages = document.getElementById('recentMessages');
  if (!recentMessages || !AppState.currentUser) return;

  try {
    const data = await apiRequest('/conversations');
    const conversations = data.conversations.slice(0, 3);

    recentMessages.innerHTML = conversations.length > 0
      ? conversations
          .filter(conv => {
            const otherUser = conv.participants.find(p => p._id !== AppState.currentUser._id);
            return otherUser; // Skip conversations where other user was deleted
          })
          .map(conv => {
            const otherUser = conv.participants.find(p => p._id !== AppState.currentUser._id);
            return `
              <div class="message-preview" style="background: var(--color-surface); padding: 12px; border-radius: var(--radius-lg); margin-bottom: 8px; cursor: pointer; border: 1px solid var(--color-card-border);" onclick="navigateToPage('messages')">
                <div class="flex items-center gap-8">
                  <img src="${otherUser.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(otherUser.name || 'User')}" alt="${otherUser.name || 'User'}"
                     style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 500;">${otherUser.name}</div>
                  <div style="font-size: 11px; color: var(--color-text-secondary);">
                    ${conv.lastMessage?.content?.substring(0, 50) || 'No messages yet'}...
                  </div>
                </div>
              </div>
            </div>
          `;
          }).join('')
      : '<p style="color: var(--color-text-secondary);">No recent messages</p>';
  } catch (error) {
    recentMessages.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading messages</p>';
  }
}

// Render learned skills section
async function renderLearnedSkills() {
  const learnedSkillsContainer = document.getElementById('learnedSkills');
  if (!learnedSkillsContainer || !AppState.currentUser) return;

  try {
    const data = await apiRequest('/exchanges/learned');
    const learnedSkills = data.learnedSkills;

    if (learnedSkills.length === 0) {
      learnedSkillsContainer.innerHTML = `
        <div style="padding: 32px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
          <div style="font-size: 48px; margin-bottom: 12px;">🎓</div>
          <p style="color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 500;">No skills learned yet</p>
          <p style="font-size: 14px; color: var(--color-text-secondary);">Complete exchanges to build your learning history!</p>
        </div>
      `;
      return;
    }

    learnedSkillsContainer.innerHTML = learnedSkills.slice(0, 5).map(item => `
      <div class="learned-skill-card" style="background: var(--color-surface); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 12px; border: 1px solid var(--color-card-border); transition: all 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <img src="${item.teacher.avatar}" 
               alt="${item.teacher.name}"
               style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-primary);"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.teacher.name)}'">
          <div style="flex: 1;">
            <div style="font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
              🎓 ${item.skill}
            </div>
            <div style="font-size: 13px; color: var(--color-text-secondary);">
              Learned from <span style="font-weight: 500; color: var(--color-primary); cursor: pointer;" onclick="navigateToPage('profile', '${item.teacher.id}')">${item.teacher.name}</span>
            </div>
          </div>
          ${item.rating ? `
            <div style="display: flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
              ⭐ ${item.rating.toFixed(1)}
            </div>
          ` : ''}
        </div>
        
        ${item.review ? `
          <div style="background: var(--color-bg); padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid var(--color-primary);">
            <p style="font-size: 13px; color: var(--color-text-secondary); font-style: italic; margin: 0;">"${item.review}"</p>
          </div>
        ` : ''}
        
        <div style="display: flex; gap: 16px; font-size: 12px; color: var(--color-text-secondary);">
          <span>📅 Completed ${new Date(item.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          ${item.sessionsCompleted ? `<span>📊 ${item.sessionsCompleted} sessions</span>` : ''}
          ${item.totalHours ? `<span>⏱️ ${item.totalHours} hours</span>` : ''}
        </div>
      </div>
    `).join('');
    
    // Add "View All" button if there are more skills
    if (learnedSkills.length > 5) {
      learnedSkillsContainer.innerHTML += `
        <button class="btn btn--secondary btn--sm" onclick="navigateToPage('profile')" style="width: 100%; margin-top: 8px;">
          View All ${learnedSkills.length} Learned Skills →
        </button>
      `;
    }
  } catch (error) {
    console.error('Error loading learned skills:', error);
    learnedSkillsContainer.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading learned skills</p>';
  }
}

// Render taught skills section
async function renderTaughtSkills() {
  const taughtSkillsContainer = document.getElementById('taughtSkills');
  if (!taughtSkillsContainer || !AppState.currentUser) return;

  try {
    const data = await apiRequest('/exchanges/taught');
    const taughtSkills = data.taughtSkills;

    if (taughtSkills.length === 0) {
      taughtSkillsContainer.innerHTML = `
        <div style="padding: 32px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
          <div style="font-size: 48px; margin-bottom: 12px;">👨‍🏫</div>
          <p style="color: var(--color-text-secondary); margin-bottom: 8px; font-weight: 500;">No skills taught yet</p>
          <p style="font-size: 14px; color: var(--color-text-secondary);">Share your knowledge and teach others!</p>
        </div>
      `;
      return;
    }

    taughtSkillsContainer.innerHTML = taughtSkills.slice(0, 5).map(item => `
      <div class="taught-skill-card" style="background: var(--color-surface); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 12px; border: 1px solid var(--color-card-border); transition: all 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <img src="${item.student.avatar}" 
               alt="${item.student.name}"
               style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-success);"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.student.name)}'">
          <div style="flex: 1;">
            <div style="font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
              👨‍🏫 ${item.skill}
            </div>
            <div style="font-size: 13px; color: var(--color-text-secondary);">
              Taught to <span style="font-weight: 500; color: var(--color-success); cursor: pointer;" onclick="navigateToPage('profile', '${item.student.id}')">${item.student.name}</span>
            </div>
          </div>
          ${item.rating ? `
            <div style="display: flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
              ⭐ ${item.rating.toFixed(1)}
            </div>
          ` : ''}
        </div>
        
        ${item.review ? `
          <div style="background: var(--color-bg); padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid var(--color-success);">
            <p style="font-size: 13px; color: var(--color-text-secondary); font-style: italic; margin: 0;">"${item.review}"</p>
          </div>
        ` : ''}
        
        <div style="display: flex; gap: 16px; font-size: 12px; color: var(--color-text-secondary);">
          <span>📅 Completed ${new Date(item.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          ${item.sessionsCompleted ? `<span>📊 ${item.sessionsCompleted} sessions</span>` : ''}
          ${item.totalHours ? `<span>⏱️ ${item.totalHours} hours</span>` : ''}
        </div>
      </div>
    `).join('');
    
    // Add "View All" button if there are more skills
    if (taughtSkills.length > 5) {
      taughtSkillsContainer.innerHTML += `
        <button class="btn btn--secondary btn--sm" onclick="navigateToPage('profile')" style="width: 100%; margin-top: 8px;">
          View All ${taughtSkills.length} Taught Skills →
        </button>
      `;
    }
  } catch (error) {
    console.error('Error loading taught skills:', error);
    taughtSkillsContainer.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading taught skills</p>';
  }
}

// ======================
// MARKETPLACE
// ======================

async function renderMarketplace() {
  await loadCategories();
  await filterSkills();
}

async function filterSkills() {
  const skillSearch = document.getElementById('skillSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const levelFilter = document.getElementById('levelFilter');
  const skillsMarketplace = document.getElementById('skillsMarketplace');

  if (!skillsMarketplace) return;

  try {
    const params = new URLSearchParams();
    if (skillSearch?.value) params.append('search', skillSearch.value);
    if (categoryFilter?.value) params.append('category', categoryFilter.value);
    if (levelFilter?.value) params.append('level', levelFilter.value);

    const data = await apiRequest(`/users/skills/all?${params.toString()}`);
    let skills = data.skills;

    // Apply frontend filtering
    if (skillSearch?.value) {
      const searchTerm = skillSearch.value.toLowerCase();
      skills = skills.filter(skill =>
        skill.name.toLowerCase().includes(searchTerm) ||
        skill.description.toLowerCase().includes(searchTerm)
      );
    }

    if (categoryFilter?.value) {
      skills = skills.filter(skill => skill.category === categoryFilter.value);
    }

    if (levelFilter?.value) {
      skills = skills.filter(skill => skill.experience_level === levelFilter.value);
    }

    renderSkillsGrid(skills);
  } catch (error) {
    console.error('Error filtering skills:', error);
    skillsMarketplace.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading skills</p>';
  }
}

function renderSkillsGrid(skills) {
  const skillsMarketplace = document.getElementById('skillsMarketplace');
  if (!skillsMarketplace) return;

  if (!skills || skills.length === 0) {
    skillsMarketplace.innerHTML = '<p style="color: var(--color-text-secondary); padding: 20px;">No skills found matching your criteria.</p>';
    return;
  }

  // Get current user ID to filter out own skills
  const currentUserId = AppState.currentUser?._id;

  // Filter out skills from the current user
  const filteredSkills = skills.filter(skill => skill.user._id !== currentUserId);

  if (filteredSkills.length === 0) {
    skillsMarketplace.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <p style="color: var(--color-text-secondary); margin-bottom: 12px;">No skills available from other users</p>
        <p style="font-size: 14px; color: var(--color-text-secondary);">Add more skills to your profile or wait for other users to join!</p>
      </div>
    `;
    return;
  }

  skillsMarketplace.innerHTML = filteredSkills.map(skill => {
    const skillImage = getSkillImage(skill);
    const imageStyle = skillImage.type === 'image'
      ? `background-image: url('${skillImage.value}'); background-size: cover; background-position: center;`
      : `background: ${skillImage.value};`;
    const textColor = skillImage.darkText ? 'rgba(0,0,0,0.85)' : 'white';
    const shadowColor = skillImage.darkText ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    const skillEmoji = skillImage.emoji || getCategoryEmoji(skill.category);

    const userRating = skill.user?.rating || 0;
    const userName = skill.user?.name || 'Unknown User';
    const userAvatar = skill.user?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName);
    const userId = skill.user?._id;

    return `
      <div class="marketplace-skill-card" style="overflow: hidden; border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div class="skill-thumbnail" style="${imageStyle}; height: 160px; position: relative; background-color: var(--color-surface);">
          <!-- Skill icon badge top-right -->
          <div style="position: absolute; top: 10px; right: 10px; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.22); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; font-size: 24px; border: 2px solid rgba(255,255,255,0.4); box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            ${skillEmoji}
          </div>
          <!-- User info bottom-left -->
          <div style="position: absolute; bottom: 10px; left: 10px; display: flex; align-items: center; gap: 8px;">
            <img src="${userAvatar}"
                 alt="${userName}"
                 class="skill-avatar"
                 style="width: 44px; height: 44px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.85); background: white; object-fit: cover; flex-shrink: 0;"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}'">
            <div>
              <div style="color: ${textColor}; font-weight: 600; font-size: 13px; text-shadow: 0 1px 4px ${shadowColor}; line-height: 1.2;">${userName}</div>
              <div style="color: ${textColor}; font-size: 11px; text-shadow: 0 1px 3px ${shadowColor}; opacity: 0.92;">⭐ ${userRating.toFixed(1)}</div>
            </div>
          </div>
        </div>
        <div style="padding: 16px;">
          <h3 class="skill-title" style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: var(--color-text-primary);">${skill.name}</h3>
          <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
            <span class="skill-category" style="background: var(--color-primary); color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
              ${getCategoryEmoji(skill.category)} ${skill.category}
            </span>
            <span class="skill-level" style="background: var(--color-bg-1); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 500;">
              📚 ${skill.experience_level}
            </span>
          </div>
          <p class="skill-description" style="margin: 0 0 12px 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5;">
            ${skill.description || 'No description available'}
          </p>
          <button class="btn btn--primary btn--sm" style="width: 100%; margin-top: 12px;" onclick="openExchangeModal('${userId}', '${skill.name}')">
            🤝 Request Exchange
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ======================
// PROFILE
// ======================

async function renderProfile(userId) {
  const profileContainer = document.getElementById('profileContainer');
  if (!profileContainer) return;

  try {
    const data = await apiRequest(`/users/${userId || AppState.currentUser._id}`);
    const user = data.user;
    const isOwnProfile = !userId || userId === AppState.currentUser._id;

    // Use fallbacks for all user data to prevent undefined values
    const displayName = user.name || 'User';
    const displayBio = user.bio || 'No bio available';
    const displayAvatar = user.profilePicture || user.avatar || getDefaultAvatar(user.name);
    const displayExchanges = user.total_exchanges || 0;
    const displayTokens = user.tokens_earned || 0;
    const displayRating = (user.rating || 0).toFixed(1);
    const displayBadges = user.badges || ['New Member'];
    const displaySkillsOffered = user.skills_offered || [];
    const displaySkillsWanted = user.skills_wanted || [];

    profileContainer.innerHTML = `
      <div class="profile-header">
        <div style="position: relative; display: inline-block;">
          <img src="${displayAvatar}" alt="${displayName}" class="profile-avatar" id="profilePageAvatar">
          ${isOwnProfile ? `
            <label for="profilePagePicUpload" style="position: absolute; bottom: 5px; right: 5px; background: var(--color-primary); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 3px solid white; transition: all 0.2s;">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                <path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/>
              </svg>
            </label>
            <input type="file" id="profilePagePicUpload" accept="image/*" style="display: none;" onchange="handleProfilePicUpload(event)">
          ` : ''}
        </div>
        <div class="profile-info">
          <h1 class="profile-name">${displayName}</h1>
          <p class="profile-bio">${displayBio}</p>
          ${isOwnProfile ? `<button class="btn btn--secondary btn--sm" onclick="showEditProfileModal()" style="margin-top: 12px;">✏️ Edit Profile</button>` : ''}
          <div class="profile-stats">
            <div class="profile-stat">
              <span class="profile-stat-number">${displayExchanges}</span>
              <span class="profile-stat-label">Exchanges</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-number">${displayTokens}</span>
              <span class="profile-stat-label">Tokens</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-number">${displayRating}</span>
              <span class="profile-stat-label">Rating</span>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-content">
        <div class="profile-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3>Skills Offered</h3>
            ${isOwnProfile ? `<button class="btn btn--primary btn--sm" onclick="showAddSkillModal('offered')">+ Add Skill</button>` : ''}
          </div>
          ${displaySkillsOffered.length > 0
            ? displaySkillsOffered.map(skill => `
                <div class="skill-item">
                  <div class="skill-item-header">
                    <span class="skill-item-name">${skill.name}</span>
                    <span class="skill-item-level">${skill.experience_level}</span>
                  </div>
                  <p class="skill-item-description">${skill.description}</p>
                  <p class="skill-item-category" style="font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">📚 ${skill.category}</p>
                </div>
              `).join('')
            : `<div style="padding: 24px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
                <p style="color: var(--color-text-secondary); margin-bottom: 12px;">🎯 No skills offered yet</p>
                ${isOwnProfile ? '<p style="font-size: 14px; color: var(--color-text-secondary);">Add your first skill to start exchanging with others!</p>' : ''}
              </div>`}
        </div>

        <div class="profile-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3>Skills Wanted</h3>
            ${isOwnProfile ? `<button class="btn btn--primary btn--sm" onclick="showAddSkillModal('wanted')">+ Add Skill</button>` : ''}
          </div>
          ${displaySkillsWanted.length > 0
            ? displaySkillsWanted.map(skill => `
                <div class="skill-item">
                  <div class="skill-item-header">
                    <span class="skill-item-name">${skill.name}</span>
                    <span class="skill-item-level">${skill.experience_level}</span>
                  </div>
                  <p class="skill-item-description">${skill.description}</p>
                  <p class="skill-item-category" style="font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">📚 ${skill.category}</p>
                </div>
              `).join('')
            : `<div style="padding: 24px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
                <p style="color: var(--color-text-secondary); margin-bottom: 12px;">🎓 No skills wanted yet</p>
                ${isOwnProfile ? '<p style="font-size: 14px; color: var(--color-text-secondary);">Add skills you want to learn!</p>' : ''}
              </div>`}
        </div>

        <div class="profile-section">
          <h3>Badges</h3>
          <div class="badges-grid">
            ${displayBadges.length > 0
              ? displayBadges.map(badge => `<div class="badge">🏆 ${badge}</div>`).join('')
              : '<p style="color: var(--color-text-secondary);">No badges yet - complete exchanges to earn them!</p>'}
          </div>
        </div>
        
        ${isOwnProfile ? `
          <div class="profile-section">
            <h3>🎓 Skills I Learned</h3>
            <div id="profileLearnedSkills">
              <p style="color: var(--color-text-secondary);">Loading...</p>
            </div>
          </div>
          
          <div class="profile-section">
            <h3>👨‍🏫 Skills I Taught</h3>
            <div id="profileTaughtSkills">
              <p style="color: var(--color-text-secondary);">Loading...</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    // Load learned and taught skills for own profile
    if (isOwnProfile) {
      renderProfileLearnedSkills();
      renderProfileTaughtSkills();
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    profileContainer.innerHTML = '<p style="color: var(--color-error); padding: 20px;">Error loading profile</p>';
  }
}

// Render learned skills in profile page
async function renderProfileLearnedSkills() {
  const container = document.getElementById('profileLearnedSkills');
  if (!container) return;

  try {
    const data = await apiRequest('/exchanges/learned');
    const learnedSkills = data.learnedSkills;

    if (learnedSkills.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
          <p style="color: var(--color-text-secondary); margin-bottom: 8px;">🎓 No skills learned yet</p>
          <p style="font-size: 14px; color: var(--color-text-secondary);">Complete exchanges to build your learning history!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = learnedSkills.map(item => `
      <div class="skill-item" style="border-left: 3px solid var(--color-success);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <img src="${item.teacher.avatar}" 
               alt="${item.teacher.name}"
               style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-success);"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.teacher.name)}'">
          <div style="flex: 1;">
            <div class="skill-item-header">
              <span class="skill-item-name">🎓 ${item.skill}</span>
              ${item.rating ? `<span class="skill-item-level" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);">⭐ ${item.rating.toFixed(1)}</span>` : ''}
            </div>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin: 4px 0 0 0;">
              Learned from <span style="font-weight: 500; color: var(--color-primary); cursor: pointer;" onclick="navigateToPage('profile', '${item.teacher.id}')">${item.teacher.name}</span>
            </p>
          </div>
        </div>
        
        ${item.review ? `
          <p class="skill-item-description" style="background: var(--color-bg); padding: 10px; border-radius: 6px; font-style: italic; border-left: 2px solid var(--color-primary);">
            "${item.review}"
          </p>
        ` : ''}
        
        <div style="display: flex; gap: 12px; font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;">
          <span>📅 ${new Date(item.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          ${item.sessionsCompleted ? `<span>📊 ${item.sessionsCompleted} sessions</span>` : ''}
          ${item.totalHours ? `<span>⏱️ ${item.totalHours}h</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading learned skills:', error);
    container.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading learned skills</p>';
  }
}

// Render taught skills in profile page
async function renderProfileTaughtSkills() {
  const container = document.getElementById('profileTaughtSkills');
  if (!container) return;

  try {
    const data = await apiRequest('/exchanges/taught');
    const taughtSkills = data.taughtSkills;

    if (taughtSkills.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; background: var(--color-surface); border-radius: var(--radius-lg); border: 2px dashed var(--color-card-border);">
          <p style="color: var(--color-text-secondary); margin-bottom: 8px;">👨‍🏫 No skills taught yet</p>
          <p style="font-size: 14px; color: var(--color-text-secondary);">Share your knowledge and teach others!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = taughtSkills.map(item => `
      <div class="skill-item" style="border-left: 3px solid var(--color-info);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <img src="${item.student.avatar}" 
               alt="${item.student.name}"
               style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-info);"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.student.name)}'">
          <div style="flex: 1;">
            <div class="skill-item-header">
              <span class="skill-item-name">👨‍🏫 ${item.skill}</span>
              ${item.rating ? `<span class="skill-item-level" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);">⭐ ${item.rating.toFixed(1)}</span>` : ''}
            </div>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin: 4px 0 0 0;">
              Taught to <span style="font-weight: 500; color: var(--color-info); cursor: pointer;" onclick="navigateToPage('profile', '${item.student.id}')">${item.student.name}</span>
            </p>
          </div>
        </div>
        
        ${item.review ? `
          <p class="skill-item-description" style="background: var(--color-bg); padding: 10px; border-radius: 6px; font-style: italic; border-left: 2px solid var(--color-info);">
            "${item.review}"
          </p>
        ` : ''}
        
        <div style="display: flex; gap: 12px; font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;">
          <span>📅 ${new Date(item.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          ${item.sessionsCompleted ? `<span>📊 ${item.sessionsCompleted} sessions</span>` : ''}
          ${item.totalHours ? `<span>⏱️ ${item.totalHours}h</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading taught skills:', error);
    container.innerHTML = '<p style="color: var(--color-text-secondary);">Error loading taught skills</p>';
  }
}

// ======================
// EXCHANGES
// ======================

let currentExchangeFilter = 'all';

async function renderExchanges() {
  const exchangesList = document.getElementById('exchangesList');
  if (!exchangesList || !AppState.currentUser) return;

  try {
    // Fetch exchanges based on current filter
    const endpoint = currentExchangeFilter === 'all' 
      ? '/exchanges' 
      : `/exchanges?status=${currentExchangeFilter}`;
    
    const data = await apiRequest(endpoint);
    const exchanges = data.exchanges;

    if (exchanges.length === 0) {
      exchangesList.innerHTML = `
        <div class="exchanges-empty">
          <div class="exchanges-empty-icon">🤝</div>
          <h3>No ${currentExchangeFilter === 'all' ? '' : currentExchangeFilter} exchanges yet</h3>
          <p>Start exchanging skills with others in the marketplace!</p>
          <button class="btn btn--primary" onclick="navigateToPage('marketplace')">
            Browse Marketplace
          </button>
        </div>
      `;
      return;
    }

    exchangesList.innerHTML = exchanges.map(exchange => {
      // Null check for user data
      if (!exchange.requester_id || !exchange.provider_id) {
        console.warn('Exchange has missing user data:', exchange);
        return ''; // Skip this exchange
      }

      const reqId = exchange.requester_id?._id || exchange.requester_id;
      const isRequester = reqId?.toString() === AppState.currentUser._id?.toString();
      const otherUser = isRequester ? exchange.provider_id : exchange.requester_id;
      
      // CLEAR SKILL ASSIGNMENT LOGIC:
      // Requester: LEARNS requested_skill, TEACHES offered_skill
      // Provider: LEARNS offered_skill, TEACHES requested_skill
      
      let myLearningSkill, myTeachingSkill, theirLearningSkill, theirTeachingSkill;
      
      if (isRequester) {
        // I am the requester
        myLearningSkill = exchange.requested_skill;      // What I want to learn
        myTeachingSkill = exchange.offered_skill;        // What I offer to teach
        theirLearningSkill = exchange.offered_skill;     // What they want to learn (what I teach)
        theirTeachingSkill = exchange.requested_skill;   // What they teach (what I learn)
      } else {
        // I am the provider
        myLearningSkill = exchange.offered_skill;        // What I want to learn
        myTeachingSkill = exchange.requested_skill;      // What I offer to teach
        theirLearningSkill = exchange.requested_skill;   // What they want to learn (what I teach)
        theirTeachingSkill = exchange.offered_skill;     // What they teach (what I learn)
      }

      // Additional safety check for otherUser
      if (!otherUser) {
        console.warn('Other user is null for exchange:', exchange);
        return '';
      }

      // ── Derived values used throughout the card ───────────────────────────
      const myRating    = isRequester ? exchange.requester_rating   : exchange.provider_rating;
      const theirRating = isRequester ? exchange.provider_rating    : exchange.requester_rating;
      const myReview    = isRequester ? exchange.requester_review   : exchange.provider_review;
      const theirReview = isRequester ? exchange.provider_review    : exchange.requester_review;
      const myLpId      = (() => {
        const lp = isRequester ? exchange.requester_learningPathId : exchange.provider_learningPathId;
        return lp?._id || lp || null;
      })();
      const theirLpStatus = (() => {
        const lp = isRequester ? exchange.provider_learningPathId : exchange.requester_learningPathId;
        return lp?.status || 'not-started';
      })();
      const myLpStatus  = (() => {
        const lp = isRequester ? exchange.requester_learningPathId : exchange.provider_learningPathId;
        return lp?.status || 'not-started';
      })();

      const avatarUrl = (user) =>
        user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=667eea&color=fff&size=64`;

      const fmtStatus = { pending: '⏳ Pending', active: '🔄 Active', completed: '✅ Completed', rejected: '❌ Rejected', cancelled: '🚫 Cancelled' };
      const statusLabel = fmtStatus[exchange.status] || exchange.status;

      const statusColor = {
        pending:   { bg: '#fff3cd', color: '#856404' },
        active:    { bg: '#cfe2ff', color: '#084298' },
        completed: { bg: '#d4edda', color: '#155724' },
        rejected:  { bg: '#f8d7da', color: '#721c24' },
        cancelled: { bg: '#e2e3e5', color: '#383d41' }
      }[exchange.status] || { bg: '#e2e3e5', color: '#383d41' };

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '';

      // ── Completion notification (once per exchange) ───────────────────────
      if (!AppState.notifiedExchanges.has(exchange._id) && (exchange.status === 'active' || exchange.status === 'completed')) {
        if (!myRating) {
          AppState.notifiedExchanges.add(exchange._id);
          try { localStorage.setItem('_notifiedExchanges', JSON.stringify([...AppState.notifiedExchanges])); } catch (_) {}
          (async () => {
            const completion = await checkLearningCompletion(exchange._id);
            if (completion && completion.bothCompleted) {
              showCompletionNotification(completion, exchange._id, otherUser.name);
            } else {
              AppState.notifiedExchanges.delete(exchange._id);
              try { localStorage.setItem('_notifiedExchanges', JSON.stringify([...AppState.notifiedExchanges])); } catch (_) {}
            }
          })();
        }
      }

      // ── Progress helpers ──────────────────────────────────────────────────
      const progColor = (s) => s === 'completed' ? '#28a745' : s === 'in-progress' ? '#ffc107' : '#dee2e6';
      const progPct   = (s) => s === 'completed' ? 100 : s === 'in-progress' ? 50 : 0;
      const statusBadge = (s) => {
        const map = {
          'completed':   ['#d4edda','#155724','✅ Completed'],
          'in-progress': ['#fff3cd','#856404','⏳ In Progress'],
          'not-started': ['#f0f0f0','#666',   '🔘 Not Started'],
          'cancelled':   ['#f8d7da','#721c24','🚫 Cancelled'],
        };
        const [bg, color, label] = map[s] || map['not-started'];
        return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${color};padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700;">${label}</span>`;
      };

      const sidesComplete = (myLpStatus==='completed'?1:0) + (theirLpStatus==='completed'?1:0);
      const overallPct    = sidesComplete * 50;

      const myActionBtn = !myLpId
        ? `<button onclick="loadLearningPathFromExchange('${exchange._id}')" style="background:#667eea;color:#fff;border:none;padding:5px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">▶ Start</button>`
        : myLpStatus === 'completed'
        ? `<span style="font-size:16px;" title="Learning complete">🎓</span>`
        : myLpStatus === 'in-progress'
        ? `<button onclick="markLearningComplete('${myLpId}','${exchange._id}')" style="background:#28a745;color:#fff;border:none;padding:5px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;" title="Mark ${myLearningSkill} as learned">✅ Mark Complete</button>`
        : `<button onclick="navigateToLearningDashboard('${myLpId}','${exchange._id}')" style="background:#667eea;color:#fff;border:none;padding:5px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">▶ Start</button>`;

      const contextMsg = myLpStatus==='completed' && theirLpStatus==='completed'
        ? '🏆 Both sides finished — great exchange!'
        : myLpStatus==='completed'
        ? `✅ You finished! Waiting for ${otherUser.name} to complete.`
        : theirLpStatus==='completed'
        ? `⚡ ${otherUser.name} is done — keep going!`
        : myLpStatus==='in-progress'
        ? `📖 Keep going — you're making progress on ${myLearningSkill}!`
        : `🚀 Open the dashboard to start learning ${myLearningSkill}.`;

      const isExchangeComplete = exchange.status === 'completed';

      // ── Rating stars helper ───────────────────────────────────────────────
      const ratingStars = (n) => n ? `${'⭐'.repeat(n)}${'☆'.repeat(5-n)} <span style="color:#999;font-size:11px;">${n}/5</span>` : '';


      return `
        <div class="exchange-item" data-exchange-id="${exchange._id}">

          <!-- ── Card Header ── -->
          <div class="exchange-header">
            <div class="exchange-user-info">
              <img src="${avatarUrl(otherUser)}" alt="${otherUser.name || 'User'}" class="exchange-avatar"
                   onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name||'U')}&background=667eea&color=fff&size=64'">
              <div class="exchange-user-details">
                <h3>${otherUser.name || 'Unknown User'}</h3>
                <div class="exchange-user-rating">
                  ⭐ ${(otherUser.rating || 0).toFixed(1)} • ${otherUser.total_exchanges || 0} exchanges
                </div>
              </div>
            </div>
            <span style="background:${statusColor.bg};color:${statusColor.color};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap;">
              ${statusLabel}
            </span>
          </div>

          <div class="exchange-body">

            <!-- ── Skills Summary ── -->
            <div class="exchange-skills">
              <div class="exchange-skill-box skill-i-learn">
                <div class="exchange-skill-label">📚 I'm Learning</div>
                <div class="exchange-skill-name">${myLearningSkill}</div>
              </div>
              <div class="exchange-arrow">⇄</div>
              <div class="exchange-skill-box skill-i-teach">
                <div class="exchange-skill-label">🎓 I'm Teaching</div>
                <div class="exchange-skill-name">${myTeachingSkill}</div>
              </div>
            </div>

            <!-- ── Partner info ── -->
            <div style="margin-top:10px;padding:8px 12px;background:#f8f9fa;border-radius:8px;font-size:13px;color:#555;display:flex;gap:20px;flex-wrap:wrap;">
              <span><strong>${otherUser.name}</strong> is learning <strong>${theirLearningSkill}</strong></span>
              <span style="color:#aaa;">|</span>
              <span>teaching <strong>${theirTeachingSkill}</strong></span>
            </div>

            <!-- ── Meta dates ── -->
            <div class="exchange-meta" style="margin-top:8px;">
              <div class="exchange-meta-item">
                <span>📅</span>
                <span>Started ${fmtDate(exchange.created_date)}</span>
              </div>
              ${exchange.completed_date ? `
              <div class="exchange-meta-item">
                <span>🏁</span>
                <span>Completed ${fmtDate(exchange.completed_date)}</span>
              </div>` : ''}
            </div>

            <!-- ── Learning Progress (active / completed) ── -->
            ${(exchange.status === 'active' || exchange.status === 'completed') ? `
            <div style="background:#f8f9fc;border-radius:10px;margin-top:14px;overflow:hidden;border:1px solid #e2e8f0;">

              <!-- Header + overall bar -->
              <div style="background:${isExchangeComplete?'#d4edda':'#eff0ff'};padding:10px 14px;border-bottom:1px solid #e2e8f0;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                  <span style="font-size:12px;font-weight:800;color:${isExchangeComplete?'#28a745':'#667eea'};text-transform:uppercase;letter-spacing:0.6px;">
                    ${isExchangeComplete ? '🎉 Exchange Complete' : '📚 Learning Progress'}
                  </span>
                  <span style="font-size:11px;font-weight:700;color:${isExchangeComplete?'#28a745':'#667eea'};">${overallPct}% done</span>
                </div>
                <div style="background:rgba(0,0,0,0.08);border-radius:6px;height:7px;overflow:hidden;">
                  <div style="background:${overallPct===100?'#28a745':'#667eea'};width:${overallPct}%;height:100%;border-radius:6px;transition:width 0.5s ease;"></div>
                </div>
              </div>

              <!-- Two columns: my side | their side -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">

                <!-- MY SIDE -->
                <div style="padding:12px 14px;border-right:1px solid #e2e8f0;">
                  <div style="font-size:10px;color:#888;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">🎓 You're Learning</div>
                  <div style="font-size:13px;color:#222;font-weight:700;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${myLearningSkill}">${myLearningSkill}</div>
                  <div style="background:#e9ecef;border-radius:4px;height:4px;margin-bottom:7px;">
                    <div style="background:${progColor(myLpStatus)};width:${progPct(myLpStatus)}%;height:100%;border-radius:4px;transition:width 0.4s;"></div>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:5px;">
                    ${statusBadge(myLpStatus)}
                    ${myActionBtn}
                  </div>
                </div>

                <!-- THEIR SIDE -->
                <div style="padding:12px 14px;">
                  <div style="font-size:10px;color:#888;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">📖 ${otherUser.name} Learns</div>
                  <div style="font-size:13px;color:#222;font-weight:700;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${theirLearningSkill}">${theirLearningSkill}</div>
                  <div style="background:#e9ecef;border-radius:4px;height:4px;margin-bottom:7px;">
                    <div style="background:${progColor(theirLpStatus)};width:${progPct(theirLpStatus)}%;height:100%;border-radius:4px;transition:width 0.4s;"></div>
                  </div>
                  ${statusBadge(theirLpStatus)}
                </div>
              </div>

              <!-- Context bar -->
              <div style="padding:9px 14px;background:#fff;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <span style="font-size:12px;color:#666;">${contextMsg}</span>
                ${myLpId ? `
                <button onclick="navigateToLearningDashboard('${myLpId}','${exchange._id}')"
                  style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:6px 14px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;"
                  onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                  📂 Dashboard →
                </button>` : ''}
              </div>
            </div>
            ` : ''}

            <!-- ── Ratings (completed only) ── -->
            ${exchange.status === 'completed' ? `
            <div style="margin-top:14px;padding-top:14px;border-top:2px solid #eee;">
              <div style="font-size:11px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">⭐ Ratings</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <!-- MY RATING -->
                <div style="background:#f9f9f9;padding:10px;border-radius:8px;border-left:3px solid #667eea;">
                  <div style="font-size:11px;color:#666;font-weight:600;margin-bottom:5px;">Your Rating</div>
                  ${myRating
                    ? `<div style="font-size:16px;letter-spacing:1px;">${ratingStars(myRating)}</div>
                       ${myReview ? `<div style="font-size:12px;color:#555;margin-top:5px;font-style:italic;">"${myReview}"</div>` : ''}`
                    : `<div style="color:#aaa;font-size:12px;">⏳ Not rated yet</div>`}
                </div>
                <!-- THEIR RATING -->
                <div style="background:#f0f8ff;padding:10px;border-radius:8px;border-left:3px solid #4caf50;">
                  <div style="font-size:11px;color:#666;font-weight:600;margin-bottom:5px;">${otherUser.name}'s Rating</div>
                  ${theirRating
                    ? `<div style="font-size:16px;letter-spacing:1px;">${ratingStars(theirRating)}</div>
                       ${theirReview ? `<div style="font-size:12px;color:#555;margin-top:5px;font-style:italic;">"${theirReview}"</div>` : ''}`
                    : `<div style="color:#aaa;font-size:12px;">⏳ Not rated yet</div>`}
                </div>
              </div>
            </div>
            ` : ''}

          </div><!-- /.exchange-body -->

          <div class="exchange-actions">
            ${renderExchangeActions(exchange, isRequester)}
          </div>
        </div>
      `;
    }).filter(html => html !== '').join('');
  } catch (error) {
    console.error('Error loading exchanges:', error);
    exchangesList.innerHTML = '<p style="color: var(--color-error); text-align: center; padding: 40px;">Error loading exchanges</p>';
  }
}

function renderExchangeActions(exchange, isRequester) {
  const buttons = [];
  const eid = exchange._id;
  const otherName = isRequester ? exchange.provider_id?.name : exchange.requester_id?.name;
  const safeName = (otherName || 'Partner').replace(/'/g, "\\'");

  // ── PENDING ──────────────────────────────────────────────────────────────
  if (exchange.status === 'pending') {
    if (!isRequester) {
      buttons.push(`
        <button class="btn btn--primary" onclick="updateExchangeStatus('${eid}', 'active')">
          ✓ Accept Request
        </button>
        <button class="btn btn--outline" onclick="updateExchangeStatus('${eid}', 'rejected')">
          ✗ Decline
        </button>
      `);
    } else {
      buttons.push(`
        <button class="btn btn--outline" onclick="cancelExchange('${eid}')">
          Cancel Request
        </button>
      `);
    }
    return buttons.join('');
  }

  // ── ACTIVE ───────────────────────────────────────────────────────────────
  if (exchange.status === 'active') {
    // Use already-populated LP id — no extra API call needed
    const myLpId = isRequester
      ? (exchange.requester_learningPathId?._id || exchange.requester_learningPathId)
      : (exchange.provider_learningPathId?._id  || exchange.provider_learningPathId);

    if (myLpId) {
      buttons.push(`
        <button class="btn btn--primary" onclick="navigateToLearningDashboard('${myLpId}', '${eid}')">
          📂 Open Dashboard
        </button>
      `);
    } else {
      // LP not created yet — use exchange route to create it
      buttons.push(`
        <button class="btn btn--primary" onclick="loadLearningPathFromExchange('${eid}')">
          📂 Open Dashboard
        </button>
      `);
    }

    buttons.push(`
      <button class="btn btn--outline" onclick="openMessagesForExchange('${eid}')">
        💬 Message ${safeName}
      </button>
    `);
    return buttons.join('');
  }

  // ── COMPLETED ────────────────────────────────────────────────────────────
  if (exchange.status === 'completed') {
    const hasUserRated = isRequester ? exchange.requester_rating : exchange.provider_rating;
    const hasPartnerRated = isRequester ? exchange.provider_rating : exchange.requester_rating;

    if (!hasUserRated) {
      // Prompt to rate
      buttons.push(`
        <button class="btn btn--primary" onclick="showEnhancedRatingModal('${eid}', '${safeName}')">
          ⭐ Rate ${safeName}
        </button>
      `);
    } else {
      // Already rated — show static badge
      buttons.push(`
        <span style="display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:7px;background:#d4edda;color:#155724;font-size:13px;font-weight:600;">
          ✅ You Rated
        </span>
      `);
    }

    if (!hasPartnerRated) {
      // Partner hasn't rated yet
      buttons.push(`
        <span style="display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:7px;background:#fff3cd;color:#856404;font-size:13px;font-weight:600;">
          ⏳ Awaiting ${safeName}'s Rating
        </span>
      `);
    }

    buttons.push(`
      <button class="btn btn--outline" onclick="openMessagesForExchange('${eid}')">
        💬 Message ${safeName}
      </button>
    `);
    return buttons.join('');
  }

  // ── REJECTED / CANCELLED ─────────────────────────────────────────────────
  buttons.push(`
    <button class="btn btn--outline" onclick="openMessagesForExchange('${eid}')">
      💬 Message ${safeName}
    </button>
  `);
  return buttons.join('');
}

// Check exchange status and refresh if completed
async function checkAndRefreshExchange(exchangeId) {
  try {
    showNotification('Checking exchange status...', 'info');
    
    const data = await apiRequest(`/exchanges/${exchangeId}/completion-status`);
    const status = data.completionStatus;
    
    if (status.bothCompleted && status.readyForRating) {
      showNotification('🎉 Both completed! Rating section ready...', 'success');
      setTimeout(() => renderExchanges(), 300);
    } else if (status.bothCompleted) {
      // Both paths are complete but exchange status hasn't updated yet
      // Force update the exchange status to 'completed'
      showNotification('⏳ Marking exchange as complete...', 'info');
      
      try {
        await apiRequest(`/exchanges/${exchangeId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'completed' })
        });
        
        showNotification('🎉 Complete! Opening rating section...', 'success');
        // Refresh with a slight delay to ensure DB updated
        setTimeout(() => {
          renderExchanges();
          // Scroll to the exchange card
          setTimeout(() => {
            const exchangeCard = document.querySelector(`[data-exchange-id="${exchangeId}"]`);
            if (exchangeCard) {
              exchangeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Highlight the rating section
              const ratingSection = exchangeCard.querySelector('.exchange-ratings-section');
              if (ratingSection) {
                ratingSection.style.animation = 'pulse 0.5s ease';
              }
            }
          }, 100);
        }, 500);
      } catch (error) {
        console.error('Error updating exchange status:', error);
        showNotification('⚠️ Exchange marked complete locally. Refreshing...', 'warning');
        setTimeout(() => renderExchanges(), 1000);
      }
    } else {
      const message = `${status.requesterProgress?.percentage || 0}% (You) • ${status.providerProgress?.percentage || 0}% (Them)`;
      showNotification(`Progress: ${message}`, 'info');
    }
  } catch (error) {
    showNotification('Error checking status', 'error');
    console.error(error);
  }
}

function switchExchangeTab(filter) {
  currentExchangeFilter = filter;
  
  // Update active tab
  document.querySelectorAll('.exchange-tab').forEach(tab => {
    if (tab.dataset.tab === filter) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Re-render exchanges
  renderExchanges();
}

async function updateExchangeStatus(exchangeId, status) {
  try {
    const data = await apiRequest(`/exchanges/${exchangeId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });

    console.log('✅ Exchange status updated:', data.exchange);

    // Refresh user data to get updated stats
    await checkAuth();

    // Clear cache for exchanges to force fresh fetch
    clearCache('exchanges');

    // Show success notification with details
    if (status === 'completed') {
      showNotification('🎉 Exchange completed! Tokens and stats updated!', 'success');
      // Refresh dashboard stats
      if (AppState.currentPage === 'dashboard') {
        renderDashboard();
      }
    } else if (status === 'active') {
      showNotification('✅ Exchange accepted! You can now start exchanging skills.', 'success');
    } else {
      showNotification(`Exchange ${status} successfully!`, 'success');
    }

    // Re-render exchanges to show updated data
    await renderExchanges();
  } catch (error) {
    showNotification(error.message || 'Failed to update exchange', 'error');
  }
}

async function cancelExchange(exchangeId) {
  if (!confirm('Are you sure you want to cancel this exchange request?')) {
    return;
  }

  try {
    await apiRequest(`/exchanges/${exchangeId}`, {
      method: 'DELETE'
    });

    showNotification('Exchange request cancelled', 'success');
    renderExchanges();
  } catch (error) {
    showNotification(error.message || 'Failed to cancel exchange', 'error');
  }
}

// =============================================
// DYNAMIC RATING SYSTEM - AUTO DETECTION
// =============================================

// Check if both learning paths are completed
async function checkLearningCompletion(exchangeId) {
  try {
    const data = await apiRequest(`/exchanges/${exchangeId}/completion-status`);
    return data.completionStatus;
  } catch (error) {
    console.error('Error checking completion status:', error);
    return null;
  }
}

// Show completion notification and rating prompt
function showCompletionNotification(completionStatus, exchangeId, otherUserName) {
  if (completionStatus.bothCompleted && completionStatus.readyForRating) {
    const notification = document.createElement('div');
    notification.className = 'completion-notification show';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      max-width: 400px;
      animation: slideInRight 0.3s ease;
    `;
    notification.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px;">🎉 Learning Complete!</h3>
          <p style="margin: 0 0 12px 0; font-size: 14px; opacity: 0.95;">
            Both of you have completed all modules. Time to rate your experience!
          </p>
          <button onclick="showEnhancedRatingModal('${exchangeId}', '${otherUserName}')" style="
            background: white;
            color: #667eea;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s ease;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            Rate Now ⭐
          </button>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ×
        </button>
      </div>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 8000);
  }
}

// Enhanced Rating Modal with Progress Info
function showEnhancedRatingModal(exchangeId, userName) {
  const modal = document.getElementById('ratingModal');
  const modalContent = document.getElementById('ratingModalContent');

  modalContent.innerHTML = `
    <div class="rating-form" style="max-width: 500px;">
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⭐</div>
        <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #333;">Rate Your Experience</h2>
        <p style="margin: 0; font-size: 14px; color: #666;">
          Rate <strong>${userName}</strong>'s teaching and communication skills
        </p>
      </div>

      <!-- Rating Stars -->
      <div class="rating-stars" id="ratingStars" style="
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-bottom: 25px;
        font-size: 40px;
      ">
        ${[1, 2, 3, 4, 5].map(star => `
          <span class="rating-star" data-rating="${star}" onclick="selectRating(${star})" style="
            cursor: pointer;
            filter: grayscale(80%);
            opacity: 0.6;
            transition: all 0.2s ease;
          ">☆</span>
        `).join('')}
      </div>

      <!-- Rating Labels -->
      <div id="ratingLabel" style="
        text-align: center;
        font-weight: 600;
        color: #667eea;
        margin-bottom: 20px;
        font-size: 14px;
        min-height: 20px;
      "></div>

      <!-- Review Textarea -->
      <div class="form-group" style="margin-bottom: 20px;">
        <label class="form-label" style="font-weight: 600; color: #333; margin-bottom: 8px;">
          Share Your Experience (Optional)
        </label>
        <textarea class="form-control" id="reviewText" rows="4" 
                  placeholder="What did you learn? Any feedback for improvement? Any highlights?"
                  style="
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                  "></textarea>
        <div style="font-size: 12px; color: #999; margin-top: 4px;">
          <span id="charCount">0</span>/500 characters
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 12px;">
        <button class="btn btn--primary" style="flex: 1; padding: 12px;" onclick="submitRating('${exchangeId}')">
          ✓ Submit Rating
        </button>
        <button class="btn btn--outline" onclick="closeRatingModal()" style="flex: 1; padding: 12px;">
          Cancel
        </button>
      </div>
    </div>
  `;

  // Add character counter
  const reviewText = document.getElementById('reviewText');
  reviewText.addEventListener('input', function() {
    document.getElementById('charCount').textContent = this.value.length;
  });

  modal.classList.add('show');
  AppState.selectedRating = 0;
}

function selectRating(rating) {
  AppState.selectedRating = rating;

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  // Update star display
  document.querySelectorAll('.rating-star').forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active');
      star.textContent = '⭐';
      star.style.filter = 'grayscale(0%)';
      star.style.opacity = '1';
    } else {
      star.classList.remove('active');
      star.textContent = '☆';
      star.style.filter = 'grayscale(80%)';
      star.style.opacity = '0.6';
    }
  });

  // Update label
  const label = document.getElementById('ratingLabel');
  if (label) {
    label.textContent = ratingLabels[rating] || '';
  }
}

// Original Rating Modal (kept for compatibility)
function showRatingModal(exchangeId, userName) {
  showEnhancedRatingModal(exchangeId, userName);
}

async function submitRating(exchangeId) {
  if (!AppState.selectedRating || AppState.selectedRating === 0) {
    showNotification('Please select a rating', 'error');
    return;
  }

  const review = document.getElementById('reviewText').value.trim();

  try {
    await apiRequest(`/exchanges/${exchangeId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        rating: AppState.selectedRating,
        review: review || undefined
      })
    });

    closeRatingModal();
    showNotification('⭐ Rating submitted! Thank you for your feedback.', 'success');

    // Remove from notifiedExchanges so the set stays clean
    AppState.notifiedExchanges.delete(exchangeId);
    try { localStorage.setItem('_notifiedExchanges', JSON.stringify([...AppState.notifiedExchanges])); } catch (_) {}

    // Refresh exchanges to show the rating
    renderExchanges();
  } catch (error) {
    showNotification(error.message || 'Failed to submit rating', 'error');
  }
}

function closeRatingModal() {
  const modal = document.getElementById('ratingModal');
  if (modal) {
    // Properly hide modal using both class and display style
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  AppState.selectedRating = 0;
  
  // Clear review text for next time
  const reviewInput = document.getElementById('reviewText');
  if (reviewInput) {
    reviewInput.value = '';
  }
}

// ======================
// SETTINGS
// ======================

async function renderSettings() {
  if (!AppState.currentUser) return;

  // Load current email preferences
  const prefs = AppState.currentUser.emailNotifications || {};

  // Set toggle values
  document.getElementById('exchangeRequests').checked = prefs.exchangeRequests !== false;
  document.getElementById('exchangeAccepted').checked = prefs.exchangeAccepted !== false;
  document.getElementById('exchangeCompleted').checked = prefs.exchangeCompleted !== false;
  document.getElementById('newRatings').checked = prefs.newRatings !== false;
  document.getElementById('newMessages').checked = prefs.newMessages !== false;
  document.getElementById('marketingEmails').checked = prefs.marketingEmails === true;
}

async function saveEmailPreferences() {
  if (!AppState.currentUser) return;

  const emailNotifications = {
    exchangeRequests: document.getElementById('exchangeRequests').checked,
    exchangeAccepted: document.getElementById('exchangeAccepted').checked,
    exchangeCompleted: document.getElementById('exchangeCompleted').checked,
    newRatings: document.getElementById('newRatings').checked,
    newMessages: document.getElementById('newMessages').checked,
    marketingEmails: document.getElementById('marketingEmails').checked
  };

  try {
    await apiRequest(`/users/${AppState.currentUser._id}/email-preferences`, {
      method: 'PUT',
      body: JSON.stringify({ emailNotifications })
    });

    // Update current user state
    AppState.currentUser.emailNotifications = emailNotifications;

    showNotification('✅ Email preferences saved successfully!', 'success');
  } catch (error) {
    showNotification(error.message || 'Failed to save preferences', 'error');
  }
}

// ======================
// MESSAGES
// ======================

// Navigate to Messages page and auto-open the conversation for a specific exchange
async function openMessagesForExchange(exchangeId) {
  navigateToPage('messages');
  // Wait for the conversations list to render, then find and open the matching conversation
  setTimeout(async () => {
    try {
      // Try to find conversation in already-loaded list
      const existing = AppState.conversations?.find(c => {
        const ceid = c.exchange_id?._id || c.exchange_id;
        return ceid && ceid.toString() === exchangeId.toString();
      });
      if (existing) {
        selectConversation(existing._id);
        return;
      }
      // Fallback: fetch conversations fresh and retry
      const data = await apiRequest('/conversations');
      const conv = (data.conversations || []).find(c => {
        const ceid = c.exchange_id?._id || c.exchange_id;
        return ceid && ceid.toString() === exchangeId.toString();
      });
      if (conv) {
        selectConversation(conv._id);
      }
    } catch (e) {
      console.warn('Could not auto-open conversation for exchange:', e);
    }
  }, 500);
}

async function renderMessages() {
  if (!AppState.currentUser) return;

  await renderConversationsList();

  const messagesSidebar = document.querySelector('.messages-sidebar');
  const messagesMain = document.querySelector('.messages-main');

  const applyMessagesLayout = () => {
    const isMobile = window.innerWidth <= 900;
    if (!isMobile) {
      messagesSidebar && messagesSidebar.classList.remove('hidden');
      messagesMain && messagesMain.classList.remove('active');
      return;
    }
    if (AppState.activeConversation) {
      messagesSidebar && messagesSidebar.classList.add('hidden');
      messagesMain && messagesMain.classList.add('active');
    } else {
      messagesSidebar && messagesSidebar.classList.remove('hidden');
      messagesMain && messagesMain.classList.remove('active');
    }
  };

  // Apply on load
  applyMessagesLayout();

  // Bind resize handler (deduplicated)
  if (window.__messagesResizeHandler) {
    window.removeEventListener('resize', window.__messagesResizeHandler);
  }
  window.__messagesResizeHandler = () => applyMessagesLayout();
  window.addEventListener('resize', window.__messagesResizeHandler);
}

async function renderConversationsList() {
  const conversationsList = document.getElementById('conversationsList');
  if (!conversationsList) return;

  try {
    conversationsList.innerHTML = '<p style="padding: 16px; color: var(--color-text-secondary);">Loading conversations...</p>';
    
    const data = await apiRequest('/conversations');
    let conversations = data.conversations || [];

    // Deduplicate conversations by exchange_id and other user
    const uniqueConversations = new Map();
    conversations.forEach(conv => {
      if (!conv.participants || conv.participants.length < 2) return;
      
      const otherUser = conv.participants.find(p => p._id !== AppState.currentUser._id);
      if (!otherUser || !otherUser._id) return;
      
      // Use exchange_id + otherUser._id as unique key
      const key = `${conv.exchange_id?._id || conv.exchange_id}-${otherUser._id}`;
      
      // Keep the conversation with the most recent message
      if (!uniqueConversations.has(key) || 
          (conv.lastMessage?.timestamp && 
           (!uniqueConversations.get(key).lastMessage?.timestamp || 
            new Date(conv.lastMessage.timestamp) > new Date(uniqueConversations.get(key).lastMessage.timestamp)))) {
        uniqueConversations.set(key, conv);
      }
    });

    AppState.conversations = Array.from(uniqueConversations.values());

    if (!AppState.conversations || AppState.conversations.length === 0) {
      conversationsList.innerHTML = `
        <div style="padding: 32px 16px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">💬</div>
          <p style="color: var(--color-text); font-weight: 500; margin-bottom: 8px;">No conversations yet</p>
          <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5;">Start exchanging skills to begin chatting!</p>
        </div>
      `;
      return;
    }

    conversationsList.innerHTML = AppState.conversations.map(conv => {
      try {
        const otherUser = conv.participants.find(p => p._id !== AppState.currentUser._id);
        
        if (!otherUser || !otherUser.name) {
          return '';
        }
        
        const userName = otherUser.name || 'Unknown User';
        const userAvatar = otherUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=21808d&color=fff&size=128`;
        const lastMessageContent = conv.lastMessage?.content || 'No messages yet';
        const previewText = lastMessageContent.substring(0, 35) + (lastMessageContent.length > 35 ? '...' : '');
        
        // Get skill info from exchange
        const skillInfo = conv.exchange_id?.requested_skill?.name || conv.exchange_id?.offered_skill?.name || '';
        const exchangeStatus = conv.exchange_id?.status || 'active';
        
        // Format relative time
        const getRelativeTime = (timestamp) => {
          if (!timestamp) return '';
          const now = Date.now();
          const msgTime = new Date(timestamp).getTime();
          const diff = now - msgTime;
          const minutes = Math.floor(diff / 60000);
          const hours = Math.floor(diff / 3600000);
          const days = Math.floor(diff / 86400000);
          
          if (minutes < 1) return 'now';
          if (minutes < 60) return `${minutes}m`;
          if (hours < 24) return `${hours}h`;
          if (days < 7) return `${days}d`;
          return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        
        const timeLabel = getRelativeTime(conv.lastMessage?.timestamp);
        const unreadCount = conv.unreadCount || 0;
        const hasUnread = unreadCount > 0;
        
        return `
          <div class="conversation-item ${conv._id === AppState.activeConversation?._id ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}"
               onclick="selectConversation('${conv._id}')">
            <div class="conversation-avatar-wrapper">
              <img src="${userAvatar}" 
                   alt="${userName}" 
                   class="conversation-avatar"
                   onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=21808d&color=fff&size=128'">
              <div class="online-indicator"></div>
            </div>
            <div class="conversation-info">
              <div class="conversation-header">
                <div class="conversation-name">${userName}</div>
                ${timeLabel ? `<div class="conversation-time">${timeLabel}</div>` : ''}
              </div>
              <div class="conversation-preview ${hasUnread ? 'unread' : ''}">${previewText}</div>
              ${skillInfo ? `<div class="conversation-skill">📚 ${skillInfo}</div>` : ''}
            </div>
            ${hasUnread ? `<div class="unread-badge">${unreadCount > 9 ? '9+' : unreadCount}</div>` : ''}
            ${exchangeStatus === 'completed' && !hasUnread ? '<div class="conversation-status completed">✓</div>' : ''}
          </div>
        `;
      } catch (convError) {
        console.error('Error rendering conversation:', convError, conv);
        return '';
      }
    }).filter(html => html).join('');
    
    // If no valid conversations rendered
    if (conversationsList.innerHTML.trim() === '') {
      conversationsList.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <p style="color: var(--color-text-secondary);">No valid conversations found</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
    conversationsList.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <p style="color: var(--color-error); margin-bottom: 12px;">❌ Error loading conversations</p>
        <p style="font-size: 14px; color: var(--color-text-secondary);">${error.message || 'Please try again later'}</p>
        <button class="btn btn--secondary btn--sm" onclick="renderConversationsList()" style="margin-top: 12px;">
          🔄 Retry
        </button>
      </div>
    `;
  }
}

async function selectConversation(conversationId) {
  try {
    const data = await apiRequest(`/conversations/${conversationId}`);
    AppState.activeConversation = data.conversation;

    if (!AppState.activeConversation.exchange_id || !AppState.activeConversation.exchange_id._id) {
      throw new Error('Invalid exchange data');
    }

    // Start polling for new messages in this conversation
    startMessagePolling(conversationId);

    const exchangeData = await apiRequest(`/conversations/exchange/${AppState.activeConversation.exchange_id._id}`);

    // Update UI
    const chatHeader = document.getElementById('chatHeader');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatAvatar = document.getElementById('chatAvatar');
    const chatUserName = document.getElementById('chatUserName');

    if (!AppState.activeConversation.participants || AppState.activeConversation.participants.length < 2) {
      throw new Error('Invalid conversation participants');
    }

    const otherUser = AppState.activeConversation.participants.find(p => p._id !== AppState.currentUser._id);
    
    if (!otherUser) {
      throw new Error('Could not find other participant');
    }

    // Show chat and hide sidebar on mobile
    const messagesSidebar = document.querySelector('.messages-sidebar');
    const messagesMain = document.querySelector('.messages-main');
    if (messagesSidebar) messagesSidebar.classList.add('hidden');
    if (messagesMain) messagesMain.classList.add('active');

    chatHeader.style.display = 'flex';
    chatInput.style.display = 'block';
    
    const userName = otherUser?.name || 'Unknown User';
    const userAvatar = otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=21808d&color=fff&size=128`;
    
    chatAvatar.src = userAvatar;
    chatUserName.textContent = userName;
    
    const chatUserStatus = document.getElementById('chatUserStatus');
    if (chatUserStatus) {
      chatUserStatus.textContent = 'Online'; // Can be updated with real online status
    }
    
    // Auto-resize message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
      
      // Enable/disable send button based on input
      const sendBtn = document.getElementById('sendMessageBtn');
      messageInput.addEventListener('input', function() {
        if (sendBtn) {
          sendBtn.disabled = !this.value.trim();
        }
      });
    }

    const messages = exchangeData.messages || [];
    
    if (messages.length === 0) {
      chatMessages.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <p style="color: var(--color-text-secondary); margin-bottom: 8px;">💬 No messages yet</p>
          <p style="font-size: 14px; color: var(--color-text-secondary);">Start the conversation!</p>
        </div>
      `;
    } else {
      const getStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
      const today = getStartOfDay(new Date());
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const getDateLabel = (d) => {
        const day = getStartOfDay(d).getTime();
        if (day === today.getTime()) return 'Today';
        if (day === yesterday.getTime()) return 'Yesterday';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      let prevLabel = '';
      let html = '';

      messages.forEach(msg => {
        const isOwnMessage = msg.user_id._id === AppState.currentUser._id;
        const userName = msg.user_id.name || 'Unknown';
        const userAvatar = msg.user_id.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
        const timeInline = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const timeBelow = timeInline;
        const dateLabel = getDateLabel(msg.timestamp);

        if (dateLabel !== prevLabel) {
          html += `<div class="chat-date-separator"><span>${dateLabel}</span></div>`;
          prevLabel = dateLabel;
        }

        // Determine status ticks for own messages
        let status = 'sent';
        if (msg.read === true) status = 'read'; else status = 'delivered';

        // Escape HTML and preserve line breaks
        const escapedMessage = (msg.message || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br>');

        html += `
          <div class="message ${isOwnMessage ? 'own' : ''}" data-message-id="${msg._id || ''}">
            <img src="${userAvatar}" 
                 alt="${userName}" 
                 class="message-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}'">
            <div class="message-content">
              <div class="message-bubble">
                ${escapedMessage}
                <span class="message-meta">
                  <span class="message-time-inline">${timeInline}</span>
                  ${isOwnMessage ? `<span class="msg-status" data-status="${status}" title="${status === 'read' ? 'Read' : 'Delivered'}">${status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : '✓'}</span>` : ''}
                </span>
              </div>
              <div class="message-time">${timeBelow}</div>
            </div>
          </div>`;
      });

      chatMessages.innerHTML = html;
      
      // Add typing indicator placeholder (can be toggled when needed)
      const typingIndicator = document.createElement('div');
      typingIndicator.id = 'typingIndicator';
      typingIndicator.className = 'typing-indicator';
      typingIndicator.style.display = 'none';
      typingIndicator.innerHTML = `
        <div class="message">
          <img src="${otherUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}`}" 
               class="message-avatar"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}'">
          <div class="message-content">
            <div class="message-bubble typing-bubble">
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>
      `;
      chatMessages.appendChild(typingIndicator);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Update conversation list
    renderConversationsList();
  } catch (error) {
    console.error('Error loading conversation:', error);
    showNotification(error.message || 'Error loading conversation', 'error');
    
    // Clear chat if there's an error
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      chatMessages.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <p style="color: var(--color-error); margin-bottom: 12px;">❌ Error loading messages</p>
          <p style="font-size: 14px; color: var(--color-text-secondary);">${error.message || 'Please try again'}</p>
          <button class="btn btn--secondary btn--sm" onclick="selectConversation('${conversationId}')" style="margin-top: 12px;">
            🔄 Retry
          </button>
        </div>
      `;
    }
  }
}

async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendMessageBtn');
  
  if (!messageInput || !messageInput.value.trim()) {
    showNotification('Please enter a message', 'error');
    return;
  }
  
  if (!AppState.activeConversation) {
    showNotification('No active conversation selected', 'error');
    return;
  }
  
  if (!AppState.activeConversation.exchange_id || !AppState.activeConversation.exchange_id._id) {
    showNotification('Invalid conversation data', 'error');
    return;
  }

  const messageText = messageInput.value.trim();
  
  // Disable input and button while sending
  if (sendBtn) sendBtn.disabled = true;
  messageInput.disabled = true;

  try {
    await apiRequest(`/exchanges/${AppState.activeConversation.exchange_id._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: messageText })
    });

    messageInput.value = '';
    
    // Reload conversation to show new message
    await selectConversation(AppState.activeConversation._id);
    
    showNotification('Message sent!', 'success');
  } catch (error) {
    console.error('Error sending message:', error);
    showNotification(error.message || 'Error sending message', 'error');
  } finally {
    // Re-enable input and button
    if (sendBtn) sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// ======================
// EXCHANGE MODAL
// ======================

async function openExchangeModal(userId, skillName = '') {
  try {
    const data = await apiRequest(`/users/${userId}`);
    const user = data.user;

    const modalContent = document.getElementById('exchangeModalContent');
    modalContent.innerHTML = `
      <div class="flex items-center gap-16 mb-16">
        <img src="${user.avatar}" alt="${user.name}"
             style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">
        <div>
          <h4 style="margin: 0 0 4px 0;">${user.name}</h4>
          <p style="margin: 0; color: var(--color-text-secondary); font-size: 14px;">${user.location || 'Location not specified'}</p>
          <p style="margin: 4px 0 0 0; color: var(--color-warning);">⭐ ${user.rating.toFixed(1)} • ${user.total_exchanges} exchanges</p>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Skill you want to learn</label>
        <select class="form-control" id="modalRequestedSkill">
          <option value="">Select a skill</option>
          ${user.skills_offered.map(skill =>
            `<option value="${skill.name}" ${skill.name === skillName ? 'selected' : ''}>${skill.name} (${skill.experience_level})</option>`
          ).join('')}
        </select>
      </div>

      ${AppState.currentUser ? `
        <div class="form-group">
          <label class="form-label">Skill you can offer in exchange</label>
          <select class="form-control" id="modalOfferedSkill">
            <option value="">Select a skill</option>
            ${AppState.currentUser.skills_offered.map(skill =>
              `<option value="${skill.name}">${skill.name} (${skill.experience_level})</option>`
            ).join('')}
          </select>
        </div>

        <button class="btn btn--primary btn--full-width" onclick="sendExchangeRequest('${userId}')">
          Send Exchange Request
        </button>
      ` : `
        <p style="text-align: center; color: var(--color-text-secondary); margin: 20px 0;">
          Please <a href="#" data-page="login" style="color: var(--color-primary);">login</a> to send exchange requests
        </p>
      `}
    `;

    document.getElementById('exchangeModal').classList.add('show');
  } catch (error) {
    showNotification('Error loading user details', 'error');
  }
}

async function sendExchangeRequest(userId) {
  const requestedSkill = document.getElementById('modalRequestedSkill').value;
  const offeredSkill = document.getElementById('modalOfferedSkill').value;

  if (!requestedSkill || !offeredSkill) {
    showNotification('Please select both skills', 'error');
    return;
  }

  try {
    await apiRequest('/exchanges', {
      method: 'POST',
      body: JSON.stringify({
        provider_id: userId,
        requested_skill: requestedSkill,
        offered_skill: offeredSkill
      })
    });

    document.getElementById('exchangeModal').classList.remove('show');
    showNotification('Exchange request sent successfully!', 'success');

    if (AppState.currentPage === 'dashboard') {
      renderDashboard();
    }
  } catch (error) {
    showNotification(error.message || 'Error sending request', 'error');
  }
}

// ======================
// ACCOUNT RECOVERY
// ======================

function showForgotPassword() {
  navigateToPage('forgotPasswordPage');
  renderForgotPassword();
  updateStepIndicator(1);
}

// Current recovery method
let currentRecoveryMethod = 'email';
let isDemoAccountsVisible = false;

// Toggle demo accounts section
function toggleDemoAccounts() {
  isDemoAccountsVisible = !isDemoAccountsVisible;
  const demoSection = document.getElementById('demo-accounts-section');
  const toggleIcon = document.getElementById('demo-toggle-icon');
  
  if (isDemoAccountsVisible) {
    demoSection.style.display = 'block';
    toggleIcon.style.transform = 'rotate(180deg)';
  } else {
    demoSection.style.display = 'none';
    toggleIcon.style.transform = 'rotate(0deg)';
  }
}

// Update step indicator
function updateStepIndicator(step) {
  const progressBar = document.getElementById('progress-bar');
  const steps = document.querySelectorAll('.step-item');
  
  // Update progress bar
  const progress = ((step - 1) / 2) * 100;
  if (progressBar) progressBar.style.width = `${progress}%`;
  
  // Update step items
  steps.forEach((stepItem, index) => {
    const stepNumber = index + 1;
    const circle = stepItem.querySelector('div');
    
    if (stepNumber <= step) {
      circle.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      circle.style.color = 'white';
      circle.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
      stepItem.classList.add('active');
    } else {
      circle.style.background = 'var(--color-surface)';
      circle.style.color = 'var(--color-text-secondary)';
      circle.style.boxShadow = 'none';
      stepItem.classList.remove('active');
    }
  });
}

// Switch recovery method with animation
function switchRecoveryMethod(method) {
  currentRecoveryMethod = method;
  
  // Update card styling
  document.querySelectorAll('.recovery-card').forEach(card => {
    const checkMark = card.querySelector('.check-mark');
    if (card.dataset.method === method) {
      card.classList.add('active');
      card.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))';
      card.style.borderColor = 'var(--color-primary)';
      card.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
      if (checkMark) checkMark.style.display = 'flex';
    } else {
      card.classList.remove('active');
      card.style.background = 'var(--color-surface)';
      card.style.borderColor = 'transparent';
      card.style.boxShadow = 'none';
      if (checkMark) checkMark.style.display = 'none';
    }
  });
  
  // Show/hide input fields with animation
  document.querySelectorAll('.recovery-method').forEach(methodDiv => {
    if (methodDiv.id === `${method}-method`) {
      methodDiv.style.display = 'block';
      methodDiv.style.animation = 'fadeInUp 0.5s';
    } else {
      methodDiv.style.display = 'none';
    }
  });
  
  // Clear all inputs
  document.getElementById('forgotEmail').value = '';
  document.getElementById('forgotUsername').value = '';
  document.getElementById('forgotPhone').value = '';
}

async function renderForgotPassword() {
  // Wait for DOM to be ready
  setTimeout(() => {
    const testAccountsList = document.getElementById('testAccountsList');
    if (!testAccountsList) {
      console.error('testAccountsList element not found');
      return;
    }
    
    // Demo accounts with credentials (for testing only)
    const demoAccounts = [
      { name: 'Sarah Chen', email: 'sarah@example.com', username: 'sarah_chen', phone: '+1-555-0101', role: 'React Developer', avatar: '👩‍💻' },
      { name: 'Miguel Rodriguez', email: 'miguel@example.com', username: 'miguel_dev', phone: '+1-555-0102', role: 'UX Designer', avatar: '👨‍🎨' },
      { name: 'Priya Patel', email: 'priya@example.com', username: 'priya_data', phone: '+1-555-0103', role: 'Data Scientist', avatar: '👩‍🔬' },
      { name: 'James Wilson', email: 'james@example.com', username: 'james_marketing', phone: '+1-555-0104', role: 'Marketing Expert', avatar: '👨‍💼' },
      { name: 'Lisa Kim', email: 'lisa@example.com', username: 'lisa_teacher', phone: '+1-555-0105', role: 'Language Teacher', avatar: '👩‍🏫' }
    ];
  
    testAccountsList.innerHTML = demoAccounts.map(account => `
      <div onclick="useAccount('${account.email}', '${account.username}', '${account.phone}')" style="cursor: pointer; background: white; padding: 14px; border-radius: var(--radius-md); border: 2px solid var(--color-card-border); transition: all 0.3s; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), transparent); opacity: 0; transition: opacity 0.3s;"></div>
        <div style="display: flex; align-items: center; gap: 12px; position: relative;">
          <div style="width: 45px; height: 45px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">
            ${account.avatar}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; color: var(--color-text); margin-bottom: 4px; font-size: 14px;">${account.name}</div>
            <div style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.4;">
              <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                <span style="opacity: 0.7;">📧</span>
                <span>${account.email}</span>
              </div>
              <div style="display: flex; gap: 12px;">
                <span style="opacity: 0.7;">👤 ${account.username}</span>
                <span style="opacity: 0.7;">📱 ${account.phone}</span>
              </div>
            </div>
          </div>
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap;">
            Use →
          </div>
        </div>
      </div>
    `).join('');
    
    // Add hover effect
    const cards = testAccountsList.querySelectorAll('div[onclick]');
    cards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateX(5px)';
        this.style.borderColor = 'var(--color-primary)';
        this.style.boxShadow = '0 5px 20px rgba(102, 126, 234, 0.2)';
        this.querySelector('div[style*="opacity: 0"]').style.opacity = '1';
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateX(0)';
        this.style.borderColor = 'var(--color-card-border)';
        this.style.boxShadow = 'none';
        this.querySelector('div[style*="opacity"]').style.opacity = '0';
      });
    });
  }, 100);
}

function useAccount(email, username, phone) {
  // Fill the current recovery method field
  if (currentRecoveryMethod === 'email') {
    document.getElementById('forgotEmail').value = email;
  } else if (currentRecoveryMethod === 'username') {
    document.getElementById('forgotUsername').value = username;
  } else if (currentRecoveryMethod === 'phone') {
    document.getElementById('forgotPhone').value = phone;
  }
  
  // Highlight the filled input
  const activeInput = document.getElementById(`forgot${currentRecoveryMethod.charAt(0).toUpperCase() + currentRecoveryMethod.slice(1)}`);
  if (activeInput) {
    activeInput.style.borderColor = 'var(--color-primary)';
    activeInput.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)';
    setTimeout(() => {
      activeInput.style.borderColor = '';
      activeInput.style.boxShadow = '';
    }, 1500);
  }
  
  showNotification(`✅ ${currentRecoveryMethod.toUpperCase()} auto-filled! Click "Send Recovery Link" to proceed.`, 'success');
  
  // Scroll to form
  document.getElementById('forgotPasswordForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function loadRememberedEmail() {
  const rememberedEmail = localStorage.getItem('rememberedEmail');
  if (rememberedEmail) {
    const emailInput = document.getElementById('loginEmail');
    const rememberCheckbox = document.getElementById('rememberMe');
    if (emailInput) {
      emailInput.value = rememberedEmail;
      if (rememberCheckbox) rememberCheckbox.checked = true;
    }
  }
}

// Password Reset Functions
async function handleForgotPasswordSubmit(e) {
  e.preventDefault();
  
  // Update step indicator
  updateStepIndicator(2);
  
  // Get identifier based on current method
  let identifier = '';
  let inputField = null;
  
  if (currentRecoveryMethod === 'email') {
    identifier = document.getElementById('forgotEmail').value;
    inputField = document.getElementById('forgotEmail');
  } else if (currentRecoveryMethod === 'username') {
    identifier = document.getElementById('forgotUsername').value;
    inputField = document.getElementById('forgotUsername');
  } else if (currentRecoveryMethod === 'phone') {
    identifier = document.getElementById('forgotPhone').value;
    inputField = document.getElementById('forgotPhone');
  }
  
  if (!identifier) {
    showNotification(`❌ Please enter your ${currentRecoveryMethod}`, 'error');
    updateStepIndicator(1);
    if (inputField) {
      inputField.style.borderColor = '#ef4444';
      inputField.style.animation = 'shake 0.5s';
      setTimeout(() => {
        inputField.style.borderColor = '';
        inputField.style.animation = '';
      }, 500);
    }
    return;
  }
  
  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <span style="display: flex; align-items: center; justify-content: center; gap: 10px;">
      <span style="animation: spin 1s linear infinite;">⏳</span>
      <span>Sending...</span>
    </span>`;
  
  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Update to step 3
      updateStepIndicator(3);
      
      // Check if we're in development mode (email service not configured)
      if (data.resetToken) {
        // Development mode - show reset token
        const resetUrl = `${window.location.origin}${window.location.pathname}?reset=${data.resetToken}`;
        
        showNotification('', 'success');
        
        // Create beautiful success display
        setTimeout(() => {
          const messageEl = document.querySelector('.notification.notification--success');
          if (messageEl) {
            messageEl.innerHTML = `
              <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 12px; animation: bounceIn 0.6s;">✅</div>
                <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Account Found!</div>
                <div style="font-size: 14px; margin-bottom: 20px; opacity: 0.9;">
                  Recovery method: <strong>${currentRecoveryMethod.toUpperCase()}</strong><br>
                  ${data.maskedContact ? `Sent to: <strong>${data.maskedContact}</strong>` : ''}
                </div>
                <a href="${resetUrl}" style="display: inline-block; background: white; color: var(--color-primary); padding: 14px 28px; border-radius: 25px; text-decoration: none; font-weight: 700; margin-top: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: transform 0.2s;">
                  🔗 Reset Password Now
                </a>
                <div style="font-size: 12px; margin-top: 16px; opacity: 0.8;">
                  ⏰ Link expires in 15 minutes
                </div>
              </div>`;
              
            // Add bounce animation
            messageEl.style.animation = 'bounceIn 0.6s';
          }
        }, 100);
      } else {
        // Production mode - email sent
        showNotification('', 'success');
        
        setTimeout(() => {
          const messageEl = document.querySelector('.notification.notification--success');
          if (messageEl) {
            messageEl.innerHTML = `
              <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 12px; animation: bounceIn 0.6s;">📧</div>
                <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Reset Link Sent!</div>
                <div style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">
                  Check your ${data.contactMethod || 'email'} inbox
                </div>
                ${data.maskedContact ? `
                <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 12px; display: inline-block; margin-top: 8px;">
                  <strong>${data.maskedContact}</strong>
                </div>` : ''}
                <div style="font-size: 12px; margin-top: 16px; opacity: 0.8;">
                  ⏰ Link expires in 15 minutes
                </div>
              </div>`;
          }
        }, 100);
      }
      
      // Clear form
      document.getElementById('forgotEmail').value = '';
      document.getElementById('forgotUsername').value = '';
      document.getElementById('forgotPhone').value = '';
    } else {
      updateStepIndicator(1);
      showNotification(`❌ ${data.message || 'Failed to send reset link'}`, 'error');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    updateStepIndicator(1);
    showNotification('❌ Failed to send reset link. Please try again.', 'error');
  } finally {
    // Restore button
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes bounceIn {
    0% { transform: scale(0.3); opacity: 0; }
    50% { transform: scale(1.05); }
    70% { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(style);

// ========== PASSWORD STRENGTH INDICATOR ==========
function updatePasswordStrength() {
  const password = document.getElementById('newPassword').value;
  const indicator = document.getElementById('passwordStrengthIndicator');
  
  if (!password) {
    indicator.style.display = 'none';
    return;
  }
  
  indicator.style.display = 'block';

  // Check requirements
  const requirements = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password)
  };

  // Update requirement checks
  document.getElementById('req-length').textContent = requirements.length ? '✓' : '✗';
  document.getElementById('req-length').style.color = requirements.length ? '#10b981' : '#9ca3af';
  
  document.getElementById('req-uppercase').textContent = requirements.uppercase ? '✓' : '✗';
  document.getElementById('req-uppercase').style.color = requirements.uppercase ? '#10b981' : '#9ca3af';
  
  document.getElementById('req-lowercase').textContent = requirements.lowercase ? '✓' : '✗';
  document.getElementById('req-lowercase').style.color = requirements.lowercase ? '#10b981' : '#9ca3af';
  
  document.getElementById('req-number').textContent = requirements.number ? '✓' : '✗';
  document.getElementById('req-number').style.color = requirements.number ? '#10b981' : '#9ca3af';

  // Calculate strength
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  const strengthText = document.getElementById('strengthText');
  const strength1 = document.getElementById('strength-1');
  const strength2 = document.getElementById('strength-2');
  const strength3 = document.getElementById('strength-3');

  // Reset colors
  strength1.style.background = '#e5e7eb';
  strength2.style.background = '#e5e7eb';
  strength3.style.background = '#e5e7eb';

  if (metRequirements <= 1) {
    strengthText.textContent = '❌ Weak';
    strengthText.style.color = '#ef4444';
    strength1.style.background = '#ef4444';
  } else if (metRequirements === 2) {
    strengthText.textContent = '⚠️ Fair';
    strengthText.style.color = '#f97316';
    strength1.style.background = '#f97316';
    strength2.style.background = '#f97316';
  } else if (metRequirements === 3) {
    strengthText.textContent = '✓ Good';
    strengthText.style.color = '#eab308';
    strength1.style.background = '#eab308';
    strength2.style.background = '#eab308';
    strength3.style.background = '#eab308';
  } else if (metRequirements === 4) {
    strengthText.textContent = '✓✓ Strong';
    strengthText.style.color = '#10b981';
    strength1.style.background = '#10b981';
    strength2.style.background = '#10b981';
    strength3.style.background = '#10b981';
  }
}

// ========== PASSWORD MATCH CHECKER ==========
function checkPasswordMatch() {
  const password = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const matchIndicator = document.getElementById('passwordMatchIndicator');
  const matchText = document.getElementById('matchText');

  if (!confirmPassword) {
    matchIndicator.style.display = 'none';
    return;
  }

  matchIndicator.style.display = 'block';

  if (password === confirmPassword) {
    matchText.textContent = '✓ Passwords match';
    matchIndicator.style.background = 'rgba(16, 185, 129, 0.1)';
    matchIndicator.style.color = '#10b981';
    matchIndicator.style.borderLeft = '3px solid #10b981';
  } else {
    matchText.textContent = '✗ Passwords do not match';
    matchIndicator.style.background = 'rgba(239, 68, 68, 0.1)';
    matchIndicator.style.color = '#ef4444';
    matchIndicator.style.borderLeft = '3px solid #ef4444';
  }
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  // ========== VALIDATION ==========
  // Check if fields are empty
  if (!newPassword || !confirmPassword) {
    showNotification('Please enter both password and confirmation', 'error');
    return;
  }
  
  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showNotification('❌ Passwords do not match!', 'error');
    return;
  }
  
  // Validate password length
  if (newPassword.length < 6) {
    showNotification('❌ Password must be at least 6 characters long', 'error');
    return;
  }

  // Validate password strength (at least 1 uppercase, 1 lowercase, 1 number)
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumbers = /[0-9]/.test(newPassword);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    showNotification(
      '❌ Password must contain uppercase letter, lowercase letter, and number\nExample: MyPassword123',
      'error'
    );
    return;
  }
  
  // Get reset token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset');
  
  if (!resetToken) {
    showNotification('❌ Invalid or missing reset token', 'error');
    return;
  }
  
  try {
    // Show loading state
    const submitBtn = document.querySelector('#resetPasswordForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Resetting password...';
    }

    const response = await fetch(`${API_URL}/auth/reset-password/${resetToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        password: newPassword,
        confirmPassword: confirmPassword
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('✅ Password reset successful! Redirecting to login...', 'success');
      
      // Clear form fields
      document.getElementById('resetPasswordForm').reset();
      
      // Clear reset token from URL and redirect to login
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        navigateToPage('login');
      }, 2000);
    } else {
      showNotification(data.message || 'Failed to reset password', 'error');
      
      // Re-enable submit button on error
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Reset Password';
      }
    }
  } catch (error) {
    console.error('Reset password error:', error);
    showNotification('❌ Failed to reset password. Please try again.', 'error');
    
    // Re-enable submit button on error
    const submitBtn = document.querySelector('#resetPasswordForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Reset Password';
    }
  }
}

// ======================
// SKILL MANAGEMENT
// ======================

async function showAddSkillModal(type) {
  const modalContent = document.getElementById('exchangeModalContent');
  const modalTitle = document.querySelector('#exchangeModal .modal-header h3');
  
  modalTitle.textContent = type === 'offered' ? 'Add Skill You Offer' : 'Add Skill You Want to Learn';
  
  // Get categories
  const categoriesData = await apiRequest('/users/categories');
  const categories = categoriesData.categories;
  
  modalContent.innerHTML = `
    <form id="addSkillForm" onsubmit="handleAddSkill(event, '${type}')">
      <div class="form-group">
        <label class="form-label">Skill Name *</label>
        <input type="text" class="form-control" id="skillName" required 
               placeholder="e.g., React Development, Graphic Design, Spanish">
      </div>

      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-control" id="skillCategory" required>
          <option value="">Select a category</option>
          ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Experience Level *</label>
        <select class="form-control" id="skillLevel" required>
          <option value="">Select level</option>
          <option value="Beginner">🟢 Beginner - Just starting out</option>
          <option value="Intermediate">🟡 Intermediate - Some experience</option>
          <option value="Advanced">🟠 Advanced - Highly skilled</option>
          <option value="Expert">🔴 Expert - Master level</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Description *</label>
        <textarea class="form-control" id="skillDescription" required rows="3"
                  placeholder="Describe your skill or what you want to learn..."></textarea>
      </div>

      <button type="submit" class="btn btn--primary btn--full-width">Add Skill</button>
    </form>
  `;
  
  document.getElementById('exchangeModal').classList.add('show');
}

async function handleAddSkill(event, type) {
  event.preventDefault();
  
  const skillName = document.getElementById('skillName').value.trim();
  const skillCategory = document.getElementById('skillCategory').value;
  const skillLevel = document.getElementById('skillLevel').value;
  const skillDescription = document.getElementById('skillDescription').value.trim();
  
  if (!skillName || !skillCategory || !skillLevel || !skillDescription) {
    showNotification('Please fill in all fields', 'error');
    return;
  }
  
  try {
    const fieldName = type === 'offered' ? 'skills_offered' : 'skills_wanted';
    const currentSkills = AppState.currentUser[fieldName] || [];
    
    // Add new skill to existing skills
    const updatedSkills = [...currentSkills, {
      name: skillName,
      category: skillCategory,
      experience_level: skillLevel,
      description: skillDescription
    }];
    
    const updateData = {
      name: AppState.currentUser.name,
      bio: AppState.currentUser.bio,
      location: AppState.currentUser.location,
      avatar: AppState.currentUser.avatar,
      [fieldName]: updatedSkills
    };
    
    const data = await apiRequest('/auth/update', {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    AppState.currentUser = data.user;
    
    document.getElementById('exchangeModal').classList.remove('show');
    showNotification(`✅ Skill "${skillName}" added successfully!`, 'success');
    
    // Refresh current page
    if (AppState.currentPage === 'profile') {
      renderProfile();
    } else if (AppState.currentPage === 'dashboard') {
      renderDashboard();
    }
  } catch (error) {
    showNotification(error.message || 'Error adding skill', 'error');
  }
}

async function showEditProfileModal() {
  const modalContent = document.getElementById('exchangeModalContent');
  const modalTitle = document.querySelector('#exchangeModal .modal-header h3');
  
  modalTitle.textContent = 'Edit Profile';
  
  const currentAvatar = AppState.currentUser.profilePicture || AppState.currentUser.avatar || getDefaultAvatar(AppState.currentUser.name);

  const presetName = encodeURIComponent((AppState.currentUser.name || 'User').trim());
  const preset1 = `https://ui-avatars.com/api/?name=${presetName}&size=150&background=6366f1&color=fff&rounded=true&bold=true`;
  const preset2 = `https://ui-avatars.com/api/?name=${presetName}&size=150&background=ec4899&color=fff&rounded=true&bold=true`;
  const preset3 = `https://ui-avatars.com/api/?name=${presetName}&size=150&background=22c55e&color=fff&rounded=true&bold=true`;
  const preset4 = `https://ui-avatars.com/api/?name=${presetName}&size=150&background=f97316&color=fff&rounded=true&bold=true`;
  
  modalContent.innerHTML = `
    <form id="editProfileForm" onsubmit="handleEditProfile(event)">
      <div class="form-group">
        <label class="form-label">Profile Picture</label>
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="position: relative; display: inline-block;">
            <img src="${currentAvatar}" id="previewAvatar" 
                 style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid var(--color-primary); box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <label for="profilePicUpload" style="position: absolute; bottom: 0; right: 0; background: var(--color-primary); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 3px solid white;">
              <i class="fas fa-camera" style="font-size: 16px;"></i>
            </label>
            <input type="file" id="profilePicUpload" accept="image/*" style="display: none;" onchange="handleProfilePicUpload(event)">
          </div>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-top: 12px;">
            � Click camera icon to upload from device
          </p>
        </div>
        
        <div id="urlSection" style="margin-bottom: 16px;">
          <label class="form-label" style="font-size: 14px;">Or enter image URL:</label>
          <input type="url" class="form-control" id="editAvatar" 
                 value="${currentAvatar}"
                 placeholder="https://example.com/photo.jpg"
                 oninput="updateAvatarPreview(this.value)">
        </div>
        
        <div id="presetsSection" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('${preset1}')">🟣 Indigo</button>
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('${preset2}')">🩷 Pink</button>
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('${preset3}')">🟢 Green</button>
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('${preset4}')">🟠 Orange</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Name *</label>
        <input type="text" class="form-control" id="editName" value="${AppState.currentUser.name}" required>
      </div>

      <div class="form-group">
        <label class="form-label">Bio</label>
        <textarea class="form-control" id="editBio" rows="3" 
                  placeholder="Tell others about yourself...">${AppState.currentUser.bio || ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Location</label>
        <input type="text" class="form-control" id="editLocation" value="${AppState.currentUser.location || ''}" 
               placeholder="e.g., San Francisco, CA">
      </div>

      <div style="display: flex; gap: 12px;">
        <button type="submit" class="btn btn--primary" style="flex: 1;">💾 Save Changes</button>
        <button type="button" class="btn btn--outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `;
  
  document.getElementById('exchangeModal').classList.add('show');
}

// Update avatar preview
function updateAvatarPreview(url) {
  const preview = document.getElementById('previewAvatar');
  if (preview && url) {
    preview.src = url;
    preview.onerror = () => {
      preview.src = getDefaultAvatar(AppState.currentUser?.name);
    };
  }
}

// Set avatar preset
function setAvatarPreset(url) {
  const avatarInput = document.getElementById('editAvatar');
  if (avatarInput) {
    avatarInput.value = url;
    updateAvatarPreview(url);
  }
}

// Handle profile picture upload from device
let uploadedProfilePicture = null;
let cropState = {
  image: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  originalFile: null
};

async function handleProfilePicUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showNotification('Please select a valid image file', 'error');
    return;
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('Image size must be less than 5MB', 'error');
    return;
  }
  
  // Store original file and show crop modal
  cropState.originalFile = file;
  
  // Read and show crop interface
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      cropState.image = img;
      showCropModal();
    };
    img.src = e.target.result;
  };
  
  reader.onerror = () => {
    showNotification('Error reading image file', 'error');
  };
  
  reader.readAsDataURL(file);
}

function showCropModal() {
  const modal = document.getElementById('imageCropModal');
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size (square aspect ratio)
  const size = Math.min(500, window.innerWidth - 80);
  canvas.width = size;
  canvas.height = size;
  
  // Calculate initial scale to fit image
  const imgAspect = cropState.image.width / cropState.image.height;
  if (imgAspect > 1) {
    // Landscape
    cropState.scale = size / cropState.image.height;
  } else {
    // Portrait or square
    cropState.scale = size / cropState.image.width;
  }
  
  // Center the image
  cropState.offsetX = (size - cropState.image.width * cropState.scale) / 2;
  cropState.offsetY = (size - cropState.image.height * cropState.scale) / 2;
  
  // Reset zoom slider
  const zoomSlider = document.getElementById('zoomSlider');
  zoomSlider.value = 1;
  
  // Draw initial image
  drawCropPreview();
  
  // Add event listeners for dragging
  canvas.addEventListener('mousedown', startDrag);
  canvas.addEventListener('mousemove', drag);
  canvas.addEventListener('mouseup', endDrag);
  canvas.addEventListener('mouseleave', endDrag);
  
  // Touch events for mobile
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', endDrag);
  
  // Mouse wheel for zoom
  canvas.addEventListener('wheel', handleWheel);
  
  modal.classList.add('show');
}

function drawCropPreview() {
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw image with current transform
  ctx.save();
  ctx.translate(cropState.offsetX, cropState.offsetY);
  ctx.scale(cropState.scale, cropState.scale);
  ctx.drawImage(cropState.image, 0, 0);
  ctx.restore();
  
  // Draw crop overlay
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.setLineDash([]);
}

function startDrag(e) {
  cropState.isDragging = true;
  cropState.startX = e.offsetX - cropState.offsetX;
  cropState.startY = e.offsetY - cropState.offsetY;
}

function drag(e) {
  if (!cropState.isDragging) return;
  
  cropState.offsetX = e.offsetX - cropState.startX;
  cropState.offsetY = e.offsetY - cropState.startY;
  
  drawCropPreview();
}

function endDrag() {
  cropState.isDragging = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = e.target.getBoundingClientRect();
  cropState.isDragging = true;
  cropState.startX = touch.clientX - rect.left - cropState.offsetX;
  cropState.startY = touch.clientY - rect.top - cropState.offsetY;
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!cropState.isDragging) return;
  
  const touch = e.touches[0];
  const rect = e.target.getBoundingClientRect();
  cropState.offsetX = touch.clientX - rect.left - cropState.startX;
  cropState.offsetY = touch.clientY - rect.top - cropState.startY;
  
  drawCropPreview();
}

function handleWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.5, Math.min(3, cropState.scale + delta));
  
  updateCropZoom(newScale);
  document.getElementById('zoomSlider').value = newScale;
}

function updateCropZoom(value) {
  const canvas = document.getElementById('cropCanvas');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Zoom towards center
  const oldScale = cropState.scale;
  cropState.scale = parseFloat(value);
  
  const scaleChange = cropState.scale / oldScale;
  cropState.offsetX = centerX - (centerX - cropState.offsetX) * scaleChange;
  cropState.offsetY = centerY - (centerY - cropState.offsetY) * scaleChange;
  
  drawCropPreview();
}

async function applyCrop() {
  const canvas = document.getElementById('cropCanvas');
  const outputCanvas = document.createElement('canvas');
  const size = 400; // Output size
  outputCanvas.width = size;
  outputCanvas.height = size;
  const ctx = outputCanvas.getContext('2d');
  
  // Draw the cropped area at higher resolution
  ctx.save();
  ctx.scale(size / canvas.width, size / canvas.height);
  ctx.translate(cropState.offsetX, cropState.offsetY);
  ctx.scale(cropState.scale, cropState.scale);
  ctx.drawImage(cropState.image, 0, 0);
  ctx.restore();
  
  // Get cropped image as base64
  const croppedImage = outputCanvas.toDataURL('image/jpeg', 0.9);
  
  // Close crop modal first
  closeCropModal();
  
  // Show loading notification
  showNotification('📸 Saving cropped image...', 'info');
  
  // Update preview in edit modal if it exists
  const preview = document.getElementById('previewAvatar');
  if (preview) {
    preview.src = croppedImage;
  }
  
  // Hide URL section in edit modal if it exists
  const urlSection = document.getElementById('urlSection');
  const presetsSection = document.getElementById('presetsSection');
  if (urlSection) urlSection.style.display = 'none';
  if (presetsSection) presetsSection.style.display = 'none';
  
  // Auto-save to database
  try {
    const updateData = {
      name: AppState.currentUser.name,
      bio: AppState.currentUser.bio || '',
      location: AppState.currentUser.location || '',
      profilePicture: croppedImage,
      avatar: croppedImage,
      skills_offered: AppState.currentUser.skills_offered,
      skills_wanted: AppState.currentUser.skills_wanted
    };
    
    const data = await apiRequest('/auth/update', {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    // Update AppState with the new user data
    AppState.currentUser = data.user;
    
    // Ensure the avatar fields are set
    AppState.currentUser.profilePicture = croppedImage;
    AppState.currentUser.avatar = croppedImage;
    
    uploadedProfilePicture = null;
    
    showNotification('✅ Profile picture updated successfully!', 'success');
    
    // Force immediate UI updates
    updateAllProfilePictures(croppedImage);
    updateNavigation();
    
    // Close edit profile modal if open
    const editModal = document.getElementById('exchangeModal');
    if (editModal && editModal.classList.contains('show')) {
      editModal.classList.remove('show');
    }
    
    // Refresh current page to show updated avatar
    if (AppState.currentPage === 'profile') {
      await renderProfile();
    } else if (AppState.currentPage === 'dashboard') {
      await renderDashboard();
    }
  } catch (error) {
    showNotification('Error saving profile picture: ' + error.message, 'error');
  }
}

function closeCropModal() {
  const modal = document.getElementById('imageCropModal');
  const canvas = document.getElementById('cropCanvas');
  
  // Remove event listeners
  canvas.removeEventListener('mousedown', startDrag);
  canvas.removeEventListener('mousemove', drag);
  canvas.removeEventListener('mouseup', endDrag);
  canvas.removeEventListener('mouseleave', endDrag);
  canvas.removeEventListener('touchstart', handleTouchStart);
  canvas.removeEventListener('touchmove', handleTouchMove);
  canvas.removeEventListener('touchend', endDrag);
  canvas.removeEventListener('wheel', handleWheel);
  
  modal.classList.remove('show');
  
  // Reset crop state
  cropState = {
    image: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    originalFile: null
  };
  
  // Reset file input
  const fileInput = document.getElementById('profilePicUpload');
  if (fileInput) fileInput.value = '';
}

// Update all profile pictures in the UI
function updateAllProfilePictures(imageUrl) {
  // Small delay to ensure DOM is ready
  setTimeout(() => {
    // Update <img> based avatars with multiple selectors
    const profileImages = document.querySelectorAll(
      '.user-avatar, .profile-avatar, .dashboard-avatar, ' +
      'img[alt*="avatar" i], img[alt*="profile" i], ' +
      '#dashboardAvatar, #previewAvatar, #profilePageAvatar, .profile-img'
    );
    
    profileImages.forEach(img => {
      if (img && img.tagName === 'IMG') {
        img.src = imageUrl;
        // Force reload
        img.style.opacity = '0.99';
        setTimeout(() => { img.style.opacity = '1'; }, 10);
      }
    });

    // Also update background-image based avatars (nav bubble, custom avatar containers)
    const bgAvatars = document.querySelectorAll('#userAvatar, .avatar-bg, [style*="background-image"]');
    bgAvatars.forEach(el => {
      if (el) {
        el.style.backgroundImage = `url(${imageUrl})`;
      }
    });
  }, 50);
}

async function handleEditProfile(event) {
  event.preventDefault();
  
  const name = document.getElementById('editName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  const location = document.getElementById('editLocation').value.trim();
  const avatar = document.getElementById('editAvatar').value.trim();
  
  if (!name) {
    showNotification('Name is required', 'error');
    return;
  }
  
  try {
    const updateData = {
      name,
      bio,
      location,
      skills_offered: AppState.currentUser.skills_offered,
      skills_wanted: AppState.currentUser.skills_wanted
    };
    
    // Use uploaded picture if available, otherwise use URL
    if (uploadedProfilePicture) {
      updateData.profilePicture = uploadedProfilePicture;
      updateData.avatar = uploadedProfilePicture;
    } else if (avatar) {
      updateData.avatar = avatar;
      updateData.profilePicture = avatar;
    }
    
    const data = await apiRequest('/auth/update', {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    AppState.currentUser = data.user;
    
    // Clear uploaded picture after successful save
    uploadedProfilePicture = null;
    
    document.getElementById('exchangeModal').classList.remove('show');
    showNotification('✅ Profile updated successfully!', 'success');
    
    // Refresh current page
    if (AppState.currentPage === 'profile') {
      renderProfile();
    } else if (AppState.currentPage === 'dashboard') {
      renderDashboard();
    }
    updateNavigation();
    updateAllProfilePictures(AppState.currentUser.profilePicture || AppState.currentUser.avatar);
  } catch (error) {
    showNotification(error.message || 'Error updating profile', 'error');
  }
}

// Close modal helper
function closeModal() {
  document.getElementById('exchangeModal').classList.remove('show');
}

// ======================
// UTILITY FUNCTIONS
// ======================

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// ======================
// CONTACT FORM HANDLER
// ======================

function handleContactForm(event) {
  event.preventDefault();
  
  const form = event.target;
  const formStatus = document.getElementById('contactFormStatus');
  const submitButton = form.querySelector('button[type="submit"]');
  
  // Get form data
  const formData = {
    name: document.getElementById('contactName').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    subject: document.getElementById('contactSubject').value.trim(),
    message: document.getElementById('contactMessage').value.trim()
  };
  
  // Validate
  if (!formData.name || !formData.email || !formData.subject || !formData.message) {
    formStatus.textContent = 'Please fill in all fields';
    formStatus.className = 'form-status error';
    return;
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    formStatus.textContent = 'Please enter a valid email address';
    formStatus.className = 'form-status error';
    return;
  }
  
  // Disable submit button
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  
  // Send to API
  apiRequest('/contact', {
    method: 'POST',
    body: JSON.stringify(formData)
  })
    .then(response => {
      if (response.success) {
        // Success
        formStatus.textContent = `Thank you, ${formData.name}! Your message has been sent successfully. We'll get back to you soon at ${formData.email}.`;
        formStatus.className = 'form-status success';
        formStatus.style.display = 'block';
        
        // Reset form
        form.reset();
        
        // Show notification
        showNotification('Message sent successfully!', 'success');
        
        // Hide status after 5 seconds
        setTimeout(() => {
          formStatus.style.display = 'none';
        }, 5000);
      } else {
        // API returned error
        formStatus.textContent = response.message || 'Failed to send message. Please try again.';
        formStatus.className = 'form-status error';
        formStatus.style.display = 'block';
      }
    })
    .catch(error => {
      // Network or other error
      console.error('Contact form error:', error);
      formStatus.textContent = 'An error occurred. Please try again later or email us directly at support@skillexchange.com';
      formStatus.className = 'form-status error';
      formStatus.style.display = 'block';
    })
    .finally(() => {
      // Re-enable button
      submitButton.disabled = false;
      submitButton.textContent = 'Send Message';
    });
}

// Initialize contact form on page load
function initializeContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactForm);
  }
  
  // Set current year in footer
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
  
  // Smooth scroll for contact link
  const contactLink = document.getElementById('contactLink');
  if (contactLink) {
    contactLink.addEventListener('click', (e) => {
      e.preventDefault();
      const contactSection = document.getElementById('contact-section');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  
  // Handle footer scroll links (How It Works, Featured Skills)
  const footerScrollLinks = document.querySelectorAll('.footer-scroll-link');
  footerScrollLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionClass = link.getAttribute('data-section');
      
      // First navigate to home page if not already there
      const homePage = document.getElementById('homePage');
      if (homePage && homePage.style.display === 'none') {
        navigateToPage('home');
        // Scroll to top first
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Wait a bit for page transition, then scroll to section
      setTimeout(() => {
        const section = document.querySelector(`.${sectionClass}`);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    });
  });
  
  // Handle all footer links to scroll to top on navigation
  const footerLinks = document.querySelectorAll('.footer-links a[onclick]');
  footerLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Small delay to let navigation happen first
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    });
  });
}

// ======================
// INITIALIZE
// ======================

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  initializeContactForm();
  
  // Listen for user data updates from admin panel
  setInterval(() => {
    const lastUpdate = localStorage.getItem('userDataUpdated');
    if (lastUpdate && AppState.currentUser) {
      const updateTime = parseInt(lastUpdate);
      // If update was within last 5 seconds, refresh user data
      if (Date.now() - updateTime < 5000) {
        refreshUserProfile();
        localStorage.removeItem('userDataUpdated');
      }
    }
  }, 1000);
});

// Browser back/forward button support
window.addEventListener('popstate', (event) => {
  const page = (event.state && event.state.page) || location.hash.replace('#', '') || 'home';
  // Navigate without pushing a new history entry (already handled by popstate)
  AppState.currentPage = page;
  localStorage.setItem('currentPage', page);
  stopAllPolling();
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
  startExchangeAutoRefresh(page);
  renderPage();
  if (page === 'messages') startConversationPolling();
  else if (page === 'dashboard') startDashboardPolling();
});

// Refresh user profile data
async function refreshUserProfile() {
  try {
    const response = await apiRequest('/auth/me');
    if (response.success && response.user) {
      AppState.currentUser = response.user;
      updateUserDisplay();
    }
  } catch (error) {
    console.error('Error refreshing user profile:', error);
  }
}

// Update user display in UI
function updateUserDisplay() {
  if (!AppState.currentUser) return;
  
  // Update profile picture
  const profilePics = document.querySelectorAll('.user-avatar, .profile-avatar, img[alt*="Profile"]');
  profilePics.forEach(img => {
    if (AppState.currentUser.profilePicture) {
      img.src = AppState.currentUser.profilePicture;
    }
  });
  
  // Update user name
  const nameElements = document.querySelectorAll('.user-name, .profile-name');
  nameElements.forEach(el => {
    el.textContent = AppState.currentUser.fullName || 'User';
  });
}

// Make functions global for onclick handlers
window.navigateToPage = navigateToPage;
window.openExchangeModal = openExchangeModal;
window.selectConversation = selectConversation;
window.sendExchangeRequest = sendExchangeRequest;
window.showAddSkillModal = showAddSkillModal;
window.handleAddSkill = handleAddSkill;
window.showEditProfileModal = showEditProfileModal;
window.handleEditProfile = handleEditProfile;
window.updateAvatarPreview = updateAvatarPreview;
window.setAvatarPreset = setAvatarPreset;
window.handleProfilePicUpload = handleProfilePicUpload;
window.updateAllProfilePictures = updateAllProfilePictures;
window.closeCropModal = closeCropModal;
window.updateCropZoom = updateCropZoom;
window.applyCrop = applyCrop;
window.closeModal = closeModal;
window.hideProfileCompletion = hideProfileCompletion;
window.showForgotPassword = showForgotPassword;
window.useAccount = useAccount;
window.switchRecoveryMethod = switchRecoveryMethod;
window.toggleDemoAccounts = toggleDemoAccounts;
window.openMessagesForExchange = openMessagesForExchange;
window.navigateToLearningDashboard = navigateToLearningDashboard;
window.markLearningComplete = markLearningComplete;
