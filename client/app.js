// SkillExchange Application - Frontend with API Integration & Performance Optimization

// API Base URL
const API_URL = window.location.origin + '/api';

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
  useBatching: true // Enable request batching
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
    // Set default categories if loading fails
    AppState.skillCategories = [
      'Programming',
      'Design',
      'Languages',
      'Music',
      'Business',
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
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
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

  renderPage(userId);
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
      console.log('   Learner:', response.learningPath.learner?.name);
      console.log('   Instructor:', response.learningPath.instructor?.name);
      console.log('   Modules:', response.learningPath.totalModules);
      
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
    const navAvatarUrl = AppState.currentUser.profilePicture || AppState.currentUser.avatar;
    userAvatar.style.backgroundImage = `url(${navAvatarUrl})`;
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

// Category colors mapping for gradient backgrounds
const CATEGORY_COLORS = {
  'Programming': { primary: '#667eea', secondary: '#764ba2' },
  'Design': { primary: '#f093fb', secondary: '#f5576c' },
  'Languages': { primary: '#4facfe', secondary: '#00f2fe' },
  'Music': { primary: '#fa709a', secondary: '#fee140' },
  'Business': { primary: '#30cfd0', secondary: '#330867' },
  'Marketing': { primary: '#a8edea', secondary: '#fed6e3' },
  'Writing': { primary: '#ff9a9e', secondary: '#fecfef' },
  'Photography': { primary: '#ffecd2', secondary: '#fcb69f' },
  'Video': { primary: '#ff6e7f', secondary: '#bfe9ff' },
  'Teaching': { primary: '#a1c4fd', secondary: '#c2e9fb' },
  'Fitness': { primary: '#fa709a', secondary: '#fee140' },
  'Data': { primary: '#30cfd0', secondary: '#330867' },
  'AI': { primary: '#667eea', secondary: '#764ba2' },
  'Other': { primary: '#667eea', secondary: '#764ba2' }
};

// Category emojis
const CATEGORY_EMOJIS = {
  'Programming': '💻',
  'Design': '🎨',
  'Languages': '🌍',
  'Music': '🎵',
  'Business': '💼',
  'Marketing': '📢',
  'Writing': '✍️',
  'Photography': '📷',
  'Video': '🎬',
  'Teaching': '📚',
  'Fitness': '💪',
  'Data': '📊',
  'AI': '🤖',
  'Other': '⭐',
  'Academic': '🎓',
  'Arts & Crafts': '🎭',
  'Management': '📈'
};

// Get gradient colors for a category
function getCategoryGradient(category) {
  // Normalize category name
  const normalizedCategory = Object.keys(CATEGORY_COLORS).find(cat => 
    category?.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(category?.toLowerCase())
  ) || 'Other';
  
  const colors = CATEGORY_COLORS[normalizedCategory];
  return `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`;
}

// Get emoji icon for a category
function getCategoryEmoji(category) {
  const normalizedCategory = Object.keys(CATEGORY_EMOJIS).find(cat => 
    category?.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(category?.toLowerCase())
  ) || 'Other';
  
  return CATEGORY_EMOJIS[normalizedCategory];
}

// Get skill image or fallback gradient
function getSkillImage(skill) {
  // If skill has a custom thumbnail, use it
  if (skill.thumbnail && skill.thumbnail.trim() !== '') {
    return {
      type: 'image',
      value: skill.thumbnail,
      fallback: getCategoryGradient(skill.category)
    };
  }
  
  // Check if there's a video thumbnail from first video
  if (skill.videos && skill.videos.length > 0 && skill.videos[0].url) {
    const videoUrl = skill.videos[0].url;
    let thumbnailUrl = null;
    
    // Extract YouTube thumbnail
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const videoId = videoUrl.includes('youtu.be') 
        ? videoUrl.split('/').pop().split('?')[0]
        : new URL(videoUrl).searchParams.get('v');
      if (videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
    
    if (thumbnailUrl) {
      return {
        type: 'image',
        value: thumbnailUrl,
        fallback: getCategoryGradient(skill.category)
      };
    }
  }
  
  // Fallback to category-based gradient
  return {
    type: 'gradient',
    value: getCategoryGradient(skill.category),
    emoji: getCategoryEmoji(skill.category)
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
            : `background: ${skillImage.value}; display: flex; align-items: center; justify-content: center; font-size: 48px;`;
          
          const imageContent = skillImage.type === 'gradient' 
            ? `<div style="font-size: 48px;">${skillImage.emoji}</div>` 
            : '';

          return `
            <div class="skill-card">
              <div class="skill-image" style="${imageStyle}">
                ${imageContent}
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
    const avatarUrl = user.profilePicture || user.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
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
      completed: user.avatar && user.avatar !== 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
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
            const otherUser = exchange.requester_id._id === AppState.currentUser._id
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
    
    const userRating = skill.user?.rating || 0;
    const userName = skill.user?.name || 'Unknown User';
    const userAvatar = skill.user?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName);
    const userId = skill.user?._id;
    
    return `
      <div class="marketplace-skill-card" style="overflow: hidden; border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); transition: all 0.3s ease;">
        <div class="skill-thumbnail" style="${imageStyle}; height: 160px; display: flex; align-items: flex-end; justify-content: flex-start; padding: 12px; background-color: var(--color-surface);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${userAvatar}" 
                 alt="${userName}" 
                 class="skill-avatar"
                 style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; background: white;"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}'">
            <div>
              <div style="color: white; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${userName}</div>
              <div style="color: rgba(255,255,255,0.9); font-size: 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">⭐ ${userRating.toFixed(1)}</div>
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
    const displayAvatar = user.profilePicture || user.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
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

      const isRequester = exchange.requester_id._id === AppState.currentUser._id;
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

      // Additional safety check for otherUser
      if (!otherUser) {
        console.warn('Other user is null for exchange:', exchange);
        return '';
      }

      return `
        <div class="exchange-item">
          <div class="exchange-header">
            <div class="exchange-user-info">
              <img src="${otherUser.avatar || '/assets/default-avatar.png'}" alt="${otherUser.name || 'User'}" class="exchange-avatar">
              <div class="exchange-user-details">
                <h3>${otherUser.name || 'Unknown User'}</h3>
                <div class="exchange-user-rating">
                  ⭐ ${(otherUser.rating || 0).toFixed(1)} • ${otherUser.total_exchanges || 0} exchanges
                </div>
              </div>
            </div>
            <span class="exchange-status-badge exchange-status-${exchange.status}">
              ${exchange.status}
            </span>
          </div>

          <div class="exchange-body">
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

            <div class="exchange-other-skills" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; font-size: 13px; color: #666;">
              <div style="margin-bottom: 8px;">
                <strong>${otherUser.name}</strong> is:
              </div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <div>
                  <span style="color: #667eea; font-weight: 600;">Learning:</span> ${theirLearningSkill}
                </div>
                <div>
                  <span style="color: #4caf50; font-weight: 600;">Teaching:</span> ${theirTeachingSkill}
                </div>
              </div>
            </div>

            <div class="exchange-meta">
              <div class="exchange-meta-item">
                <span>📅</span>
                <span>Created ${new Date(exchange.created_date).toLocaleDateString()}</span>
              </div>
              ${exchange.completed_date ? `
                <div class="exchange-meta-item">
                  <span>✅</span>
                  <span>Completed ${new Date(exchange.completed_date).toLocaleDateString()}</span>
                </div>
              ` : ''}
            </div>

            <!-- Learning Progress Display (for active/completed exchanges) -->
            ${(exchange.status === 'active' || exchange.status === 'completed') ? `
              <div class="learning-progress-section" style="background: #f5f7fa; padding: 12px; border-radius: 8px; margin-top: 12px; border-left: 4px solid ${exchange.status === 'completed' ? '#4caf50' : '#667eea'};">
                <div style="font-size: 12px; font-weight: 700; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${exchange.status === 'completed' ? '🎉 Learning Complete' : '📚 Learning Progress'}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <!-- Your Learning Progress -->
                  <div style="background: white; padding: 10px; border-radius: 6px; border-left: 3px solid #667eea;">
                    <div style="font-size: 12px; color: #666; font-weight: 600;">Your Learning</div>
                    <div style="font-size: 13px; color: #333; font-weight: 600; margin-top: 2px;">${isRequester ? exchange.requested_skill : exchange.offered_skill}</div>
                    ${(() => {
                      const myPath = isRequester ? exchange.requester_learningPathId : exchange.provider_learningPathId;
                      if (myPath && myPath.totalModules) {
                        const progress = Math.round((myPath.completedModules / myPath.totalModules) * 100);
                        return `
                          <div style="margin-top: 8px;">
                            <div style="font-size: 14px; font-weight: 700; color: #667eea; margin-bottom: 4px;">
                              ${myPath.completedModules}/${myPath.totalModules} modules
                            </div>
                            <div style="background: #e0e7ff; border-radius: 10px; height: 6px; overflow: hidden;">
                              <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                            </div>
                            <div style="font-size: 11px; color: #999; margin-top: 4px;">
                              ${myPath.status === 'completed' ? '✅ Completed' : `${progress}% complete`}
                            </div>
                          </div>
                        `;
                      }
                      return '<div style="font-size: 11px; color: #999; margin-top: 4px;">⏳ Not started</div>';
                    })()}
                  </div>
                  <!-- Their Learning Progress -->
                  <div style="background: white; padding: 10px; border-radius: 6px; border-left: 3px solid #4caf50;">
                    <div style="font-size: 12px; color: #666; font-weight: 600;">${otherUser.name}'s Learning</div>
                    <div style="font-size: 13px; color: #333; font-weight: 600; margin-top: 2px;">${isRequester ? exchange.offered_skill : exchange.requested_skill}</div>
                    ${(() => {
                      const theirPath = isRequester ? exchange.provider_learningPathId : exchange.requester_learningPathId;
                      if (theirPath && theirPath.totalModules) {
                        const progress = Math.round((theirPath.completedModules / theirPath.totalModules) * 100);
                        return `
                          <div style="margin-top: 8px;">
                            <div style="font-size: 14px; font-weight: 700; color: #4caf50; margin-bottom: 4px;">
                              ${theirPath.completedModules}/${theirPath.totalModules} modules
                            </div>
                            <div style="background: #e8f5e9; border-radius: 10px; height: 6px; overflow: hidden;">
                              <div style="background: linear-gradient(90deg, #4caf50, #81c784); height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                            </div>
                            <div style="font-size: 11px; color: #999; margin-top: 4px;">
                              ${theirPath.status === 'completed' ? '✅ Completed' : `${progress}% complete`}
                            </div>
                          </div>
                        `;
                      }
                      return '<div style="font-size: 11px; color: #999; margin-top: 4px;">⏳ Not started</div>';
                    })()}
                  </div>
                </div>
                ${exchange.status === 'completed' ? `
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px; border-radius: 6px; margin-top: 12px; text-align: center; font-size: 13px; font-weight: 600;">
                    🎓 Both completed! Time to rate each other's teaching
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <!-- Bidirectional Rating Display -->
            ${exchange.status === 'completed' ? `
              <div class="exchange-ratings-section">
                ${isRequester ? `
                  <!-- Requester's rating of Provider -->
                  <div class="exchange-rating-item">
                    <div class="rating-label">Your Rating</div>
                    ${exchange.requester_rating ? `
                      <div class="exchange-rating-display">
                        <div class="exchange-rating-stars">
                          ${'⭐'.repeat(exchange.requester_rating)}${'☆'.repeat(5 - exchange.requester_rating)}
                        </div>
                        ${exchange.requester_review ? `<div class="exchange-rating-review">"${exchange.requester_review}"</div>` : ''}
                      </div>
                    ` : `<div class="rating-pending">Pending your rating...</div>`}
                  </div>
                  ${exchange.provider_rating ? `
                    <div class="exchange-rating-item">
                      <div class="rating-label">${otherUser.name}'s Rating</div>
                      <div class="exchange-rating-display">
                        <div class="exchange-rating-stars">
                          ${'⭐'.repeat(exchange.provider_rating)}${'☆'.repeat(5 - exchange.provider_rating)}
                        </div>
                        ${exchange.provider_review ? `<div class="exchange-rating-review">"${exchange.provider_review}"</div>` : ''}
                      </div>
                    </div>
                  ` : ''}
                ` : `
                  <!-- Provider's rating of Requester -->
                  <div class="exchange-rating-item">
                    <div class="rating-label">Your Rating</div>
                    ${exchange.provider_rating ? `
                      <div class="exchange-rating-display">
                        <div class="exchange-rating-stars">
                          ${'⭐'.repeat(exchange.provider_rating)}${'☆'.repeat(5 - exchange.provider_rating)}
                        </div>
                        ${exchange.provider_review ? `<div class="exchange-rating-review">"${exchange.provider_review}"</div>` : ''}
                      </div>
                    ` : `<div class="rating-pending">Pending your rating...</div>`}
                  </div>
                  ${exchange.requester_rating ? `
                    <div class="exchange-rating-item">
                      <div class="rating-label">${otherUser.name}'s Rating</div>
                      <div class="exchange-rating-display">
                        <div class="exchange-rating-stars">
                          ${'⭐'.repeat(exchange.requester_rating)}${'☆'.repeat(5 - exchange.requester_rating)}
                        </div>
                        ${exchange.requester_review ? `<div class="exchange-rating-review">"${exchange.requester_review}"</div>` : ''}
                      </div>
                    </div>
                  ` : ''}
                `}
              </div>
            ` : ''}
          </div>

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

  // Pending status - Provider can accept/reject, Requester can cancel
  if (exchange.status === 'pending') {
    if (!isRequester) {
      buttons.push(`
        <button class="btn btn--primary" onclick="updateExchangeStatus('${exchange._id}', 'active')">
          ✓ Accept Request
        </button>
        <button class="btn btn--outline" onclick="updateExchangeStatus('${exchange._id}', 'rejected')">
          ✗ Decline
        </button>
      `);
    } else {
      buttons.push(`
        <button class="btn btn--outline" onclick="cancelExchange('${exchange._id}')">
          Cancel Request
        </button>
      `);
    }
  }

  // Active status - Both can complete
  if (exchange.status === 'active') {
    console.log('=== Active Exchange Data ===');
    console.log('Full Exchange Object:', exchange);
    console.log('Available Fields:', Object.keys(exchange));
    
    // Get the exchange ID
    const exchangeId = exchange._id;
    console.log('Exchange ID:', exchangeId);
    
    // The button will use the new endpoint to fetch the correct learning path
    buttons.push(`
      <button class="btn btn--primary" onclick="loadLearningPathFromExchange('${exchangeId}')">
        📚 Learning Dashboard
      </button>
      <button class="btn btn--outline" onclick="navigateToPage('messages')">
        💬 View Messages
      </button>
    `);
  }

  // Completed status - Both parties can rate
  if (exchange.status === 'completed') {
    const isRequester = exchange.requester_id._id === AppState.currentUser._id;
    const hasUserRated = isRequester ? exchange.requester_rating : exchange.provider_rating;
    
    if (!hasUserRated) {
      buttons.push(`
        <button class="btn btn--primary" onclick="showRatingModal('${exchange._id}', '${exchange.requester_id._id === AppState.currentUser._id ? exchange.provider_id.name : exchange.requester_id.name}')">
          ⭐ Rate ${exchange.requester_id._id === AppState.currentUser._id ? 'Instructor' : 'Learner'}
        </button>
      `);
    }
  }

  // All non-pending exchanges can be messaged
  if (exchange.status !== 'pending' && exchange.status !== 'cancelled') {
    if (buttons.length === 0) {
      buttons.push(`
        <button class="btn btn--outline" onclick="navigateToPage('messages')">
          💬 View Messages
        </button>
      `);
    }
  }

  return buttons.join('');
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

// Rating Modal Functions
function showRatingModal(exchangeId, userName) {
  const modal = document.getElementById('ratingModal');
  const modalContent = document.getElementById('ratingModalContent');

  modalContent.innerHTML = `
    <div class="rating-form">
      <p style="text-align: center; margin-bottom: 20px;">
        How was your experience exchanging skills with <strong>${userName}</strong>?
      </p>

      <div class="rating-stars" id="ratingStars">
        ${[1, 2, 3, 4, 5].map(star => `
          <span class="rating-star" data-rating="${star}" onclick="selectRating(${star})">☆</span>
        `).join('')}
      </div>

      <div class="form-group">
        <label class="form-label">Review (Optional)</label>
        <textarea class="form-control" id="reviewText" rows="4" 
                  placeholder="Share your experience..."></textarea>
      </div>

      <div style="display: flex; gap: 12px;">
        <button class="btn btn--primary" style="flex: 1;" onclick="submitRating('${exchangeId}')">
          Submit Rating
        </button>
        <button class="btn btn--outline" onclick="closeRatingModal()">
          Cancel
        </button>
      </div>
    </div>
  `;

  modal.classList.add('show');
  AppState.selectedRating = 0;
}

function selectRating(rating) {
  AppState.selectedRating = rating;

  // Update star display
  document.querySelectorAll('.rating-star').forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active');
      star.textContent = '⭐';
    } else {
      star.classList.remove('active');
      star.textContent = '☆';
    }
  });
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

    // Refresh exchanges
    renderExchanges();
  } catch (error) {
    showNotification(error.message || 'Failed to submit rating', 'error');
  }
}

function closeRatingModal() {
  document.getElementById('ratingModal').classList.remove('show');
  AppState.selectedRating = 0;
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

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showNotification('Passwords do not match!', 'error');
    return;
  }
  
  // Validate password length
  if (newPassword.length < 6) {
    showNotification('Password must be at least 6 characters long', 'error');
    return;
  }
  
  // Get reset token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset');
  
  if (!resetToken) {
    showNotification('Invalid or missing reset token', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/auth/reset-password/${resetToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('✅ Password reset successful! Redirecting to login...', 'success');
      
      // Clear reset token from URL and redirect to login
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        navigateToPage('login');
      }, 2000);
    } else {
      showNotification(data.message || 'Failed to reset password', 'error');
    }
  } catch (error) {
    console.error('Reset password error:', error);
    showNotification('Failed to reset password. Please try again.', 'error');
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
  
  const currentAvatar = AppState.currentUser.profilePicture || AppState.currentUser.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
  
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
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face')">👤 Default 1</button>
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face')">👤 Default 2</button>
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face')">👤 Default 3</button>
          <button type="button" class="btn btn--outline btn--sm" onclick="setAvatarPreset('https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face')">👤 Default 4</button>
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
      preview.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
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

// Refresh user profile data
async function refreshUserProfile() {
  try {
    const response = await apiRequest('/users/me');
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
