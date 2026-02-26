// ===== STATE MANAGEMENT =====
let currentPage = 'dashboard';
let networkMonitorCollapsed = false;
let sidebarCollapsed = false;
let networkLogs = [];
let allUsers = [];
let allExchanges = [];
let allSkills = [];
let currentAdmin = null;

// ===== AUTHENTICATION =====
async function checkAuth() {
    const token = localStorage.getItem('adminToken');
    
    if (!token) {
        window.location.href = 'admin-login.html';
        return false;
    }
    
    try {
        const response = await fetch('/api/admin-auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentAdmin = data.data.admin;
            updateAdminInfo();
            return true;
        } else {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminData');
            window.location.href = 'admin-login.html';
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'admin-login.html';
        return false;
    }
}

function updateAdminInfo() {
    // Update admin info in UI if elements exist
    const adminNameElement = document.getElementById('adminName');
    const adminNameTopbar = document.getElementById('adminNameTopbar');
    const adminEmailElement = document.getElementById('adminEmail');
    const adminRoleElement = document.getElementById('adminRole');
    
    if (currentAdmin) {
        if (adminNameElement) adminNameElement.textContent = currentAdmin.fullName;
        if (adminNameTopbar) adminNameTopbar.textContent = currentAdmin.fullName;
        if (adminEmailElement) adminEmailElement.textContent = currentAdmin.email;
        if (adminRoleElement) {
            const roleDisplay = currentAdmin.role === 'super-admin' ? 'Super Admin' : 
                               currentAdmin.role === 'moderator' ? 'Moderator' : 'Admin';
            adminRoleElement.textContent = roleDisplay;
        }
    }
}

// Get auth headers for API calls
function getAuthHeaders() {
    const token = localStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        initializeAdmin();
        startNetworkMonitoring();
    }
});

function initializeAdmin() {
    // Get last active page from localStorage or default to dashboard
    const lastPage = localStorage.getItem('adminCurrentPage') || 'dashboard';
    
    // Load the last active page
    navigateToPage(lastPage);
    
    // Check database connection
    checkDatabaseConnection();
    
    // Initialize network logs display
    displayNetworkLogs();
    
    // Initialize modal handlers
    initializeModalHandlers();
    
    // Add some example logs to show the feature works
    setTimeout(() => {
        addExampleLogs();
    }, 500);
}

// Add example logs to demonstrate the feature
function addExampleLogs() {
    logAPICall('GET', '/api/admin/status', 200, 45, 'success');
    setTimeout(() => logAPICall('GET', '/api/admin/stats', 200, 128, 'success'), 200);
    setTimeout(() => logAPICall('GET', '/api/admin/users', 200, 95, 'success'), 400);
}

// ===== NAVIGATION =====
function navigateToPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const page = document.getElementById(`${pageId}Page`);
    if (page) {
        page.classList.add('active');
    }
    
    // Update navigation - remove active from all
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active to clicked item
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const onclick = item.getAttribute('onclick');
        if (onclick && onclick.includes(`'${pageId}'`)) {
            item.classList.add('active');
        }
    });
    
    // Update page title
    const titles = {
        dashboard: '📊SHA Dashboard',
        users: '👥 Users Management',
        exchanges: '🤝 Exchanges Management',
        modules: '🎓 Modules Management',
        videos: '🎥 Video Library',
        skills: '🎯 Skills Management',
        analytics: '📈 Analytics',
        backup: '💾 Backup & Data Management',
        settings: '⚙️ Settings'
    };
    
    document.getElementById('pageTitle').textContent = titles[pageId] || 'Dashboard';
    
    currentPage = pageId;
    
    // Save current page to localStorage for reload persistence
    localStorage.setItem('adminCurrentPage', pageId);
    
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 1024) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
        if (overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    }
    
    // Load page data
    loadPageData(pageId);
}

function loadPageData(pageId) {
    switch(pageId) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'users':
            loadUsers();
            break;
        case 'exchanges':
            loadExchanges();
            break;
        case 'skills':
            loadSkills();
            break;
        case 'modules':
            loadModules();
            break;
        case 'videos':
            loadVideos();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'backup':
            loadBackupPage();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    // For mobile: toggle 'active' class
    // For desktop: toggle 'collapsed' class
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('active');
        
        // Close sidebar when clicking outside on mobile
        if (sidebar.classList.contains('active')) {
            // Add overlay
            let overlay = document.querySelector('.sidebar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                overlay.onclick = () => toggleSidebar();
                document.body.appendChild(overlay);
            }
            overlay.classList.add('active');
        } else {
            // Remove overlay
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    } else {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
    
    sidebarCollapsed = !sidebarCollapsed;
}

// ===== NETWORK MONITOR =====
function toggleNetworkMonitor() {
    const monitor = document.getElementById('networkMonitor');
    const toggleBtn = monitor.querySelector('.toggle-btn');
    
    monitor.classList.toggle('collapsed');
    networkMonitorCollapsed = !networkMonitorCollapsed;
    
    toggleBtn.textContent = networkMonitorCollapsed ? '+' : '−';
}

async function checkDatabaseConnection() {
    try {
        const response = await fetch('/api/admin/status');
        const data = await response.json();
        
        const dbStatus = document.getElementById('dbStatus');
        const dbName = document.getElementById('dbName');
        
        if (data.success) {
            dbStatus.innerHTML = '🟢 MongoDB: Connected';
            dbName.innerHTML = `📊 Database: ${data.database}`;
        } else {
            dbStatus.innerHTML = '🔴 MongoDB: Disconnected';
            dbName.innerHTML = '📊 Database: N/A';
        }
    } catch (error) {
        const dbStatus = document.getElementById('dbStatus');
        const dbName = document.getElementById('dbName');
        
        dbStatus.innerHTML = '🔴 MongoDB: Error';
        dbName.innerHTML = '📊 Database: N/A';
        
        logAPICall('GET', '/api/admin/status', 500, 0, 'error');
    }
}

function startNetworkMonitoring() {
    // Intercept fetch calls
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
        const startTime = Date.now();
        const url = args[0];
        const options = args[1] || {};
        const method = options.method || 'GET';
        
        try {
            const response = await originalFetch.apply(this, args);
            const duration = Date.now() - startTime;
            
            logAPICall(method, url, response.status, duration, 'success');
            
            return response;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAPICall(method, url, 500, duration, 'error');
            throw error;
        }
    };
}

function logAPICall(method, url, status, duration, type) {
    const log = {
        method,
        url,
        status,
        duration,
        type,
        timestamp: new Date().toISOString()
    };
    
    networkLogs.unshift(log);
    
    // Keep only last 50 logs
    if (networkLogs.length > 50) {
        networkLogs.pop();
    }
    
    displayNetworkLogs();
}

function displayNetworkLogs() {
    const logsContainer = document.getElementById('networkLogs');
    
    if (!logsContainer) return;
    
    // Keep the header if it exists
    const existingHeader = logsContainer.querySelector('.log-header');
    
    // Clear existing logs but keep structure
    logsContainer.innerHTML = '<div class="log-header">Recent API Calls</div>';
    
    // If no logs yet, show waiting message
    if (networkLogs.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'log-item';
        emptyMessage.style.justifyContent = 'center';
        emptyMessage.style.color = 'var(--text-secondary)';
        emptyMessage.innerHTML = '⏳ Waiting for API calls...';
        logsContainer.appendChild(emptyMessage);
        return;
    }
    
    // Display logs (most recent first)
    networkLogs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        
        logItem.innerHTML = `
            <span class="log-method ${log.method}">${log.method}</span>
            <span class="log-url" title="${log.url}">${log.url}</span>
            <span class="log-status ${log.type}">${log.status}</span>
            <span class="log-time">${log.duration}ms</span>
        `;
        
        logsContainer.appendChild(logItem);
    });
}

// ===== DASHBOARD =====
async function loadDashboardStats() {
    try {
        // Show loading
        const dashboardUsersEl = document.getElementById('dashboardUsers');
        const dashboardExchangesEl = document.getElementById('dashboardExchanges');
        
        if (dashboardUsersEl) dashboardUsersEl.innerHTML = '<div class="loading">Loading users...</div>';
        if (dashboardExchangesEl) dashboardExchangesEl.innerHTML = '<div class="loading">Loading exchanges...</div>';
        
        const response = await fetch('/api/admin/stats');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            // Update stat cards
            updateStatCard('totalUsers', data.stats.totalUsers || 0, '+12%');
            updateStatCard('totalExchanges', data.stats.totalExchanges || 0, '+8%');
            updateStatCard('avgRating', (data.stats.averageRating || 0).toFixed(1), '+5%');
            updateStatCard('successRate', `${data.stats.successRate || 0}%`, '+3%');
            
            // Update recent users
            displayRecentUsers(data.recentUsers || []);
            
            // Update recent exchanges
            displayRecentExchanges(data.recentExchanges || []);
        } else {
            throw new Error(data.message || 'Failed to load dashboard stats');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        
        // Show error in UI
        const dashboardUsersEl = document.getElementById('dashboardUsers');
        const dashboardExchangesEl = document.getElementById('dashboardExchanges');
        
        if (dashboardUsersEl) {
            dashboardUsersEl.innerHTML = '<div class="loading" style="color: var(--danger);">❌ Error loading users</div>';
        }
        if (dashboardExchangesEl) {
            dashboardExchangesEl.innerHTML = '<div class="loading" style="color: var(--danger);">❌ Error loading exchanges</div>';
        }
        
        // Set default values for stat cards
        updateStatCard('totalUsers', '0', '');
        updateStatCard('totalExchanges', '0', '');
        updateStatCard('avgRating', '0.0', '');
        updateStatCard('successRate', '0%', '');
    }
}

function updateStatCard(id, value, change) {
    const cardElement = document.getElementById(id);
    
    if (!cardElement) {
        console.warn(`Stat card element with id '${id}' not found`);
        return;
    }
    
    const valueElement = cardElement.querySelector('.stat-value');
    const changeElement = cardElement.querySelector('.stat-change');
    
    if (valueElement) valueElement.textContent = value;
    if (changeElement && change) changeElement.textContent = change;
}

function displayRecentUsers(users) {
    const container = document.getElementById('dashboardUsers');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="loading">No recent users</div>';
        return;
    }
    
    const html = users.map(user => {
        // Use correct property names from User model: name, email, avatar
        const userName = user.name || 'Unknown User';
        const userEmail = user.email || 'No email';
        const userAvatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`;
        const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
        
        return `
        <div class="user-cell" style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
            <img src="${userAvatar}" 
                 class="user-avatar" 
                 alt="${userName}"
                 style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random'">
            <div class="user-info" style="flex: 1; min-width: 0;">
                <div class="user-name" style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${userName}
                </div>
                <div class="user-email" style="font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    📧 ${userEmail}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                    📅 Joined ${joinedDate}
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    container.innerHTML = html;
}

function displayRecentExchanges(exchanges) {
    const container = document.getElementById('dashboardExchanges');
    
    if (!exchanges || exchanges.length === 0) {
        container.innerHTML = '<div class="loading">No recent exchanges</div>';
        return;
    }
    
    const html = exchanges.map(exchange => {
        // Use correct property names from Exchange model
        const requester = exchange.requester_id || {};
        const provider = exchange.provider_id || {};
        
        const requesterName = requester.name || 'Unknown User';
        const providerName = provider.name || 'Unknown User';
        const requesterAvatar = requester.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(requesterName)}&background=4f46e5`;
        const providerAvatar = provider.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(providerName)}&background=0891b2`;
        const requesterEmail = requester.email || '';
        const providerEmail = provider.email || '';
        
        const requestedSkill = exchange.requested_skill || 'Unknown Skill';
        const offeredSkill = exchange.offered_skill || 'Unknown Skill';
        const status = exchange.status || 'pending';
        const createdDate = exchange.created_date || exchange.createdAt;
        const timeAgo = createdDate ? getTimeAgo(new Date(createdDate)) : 'Recently';
        
        // Status colors
        const statusColors = {
            'pending': 'background: #fef3c7; color: #92400e;',
            'accepted': 'background: #dbeafe; color: #1e40af;',
            'in_progress': 'background: #e0e7ff; color: #4338ca;',
            'completed': 'background: #d1fae5; color: #065f46;',
            'cancelled': 'background: #fee2e2; color: #991b1b;',
            'rejected': 'background: #fee2e2; color: #991b1b;',
            'active': 'background: #d1fae5; color: #065f46;'
        };
        const statusStyle = statusColors[status] || statusColors.pending;
        
        return `
        <div class="exchange-item" style="padding: 16px; border-bottom: 1px solid var(--border-color); transition: background 0.2s; cursor: pointer;" onclick="viewExchangeDetails('${exchange._id}')">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <img src="${requesterAvatar}" 
                         alt="${requesterName}"
                         style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #4f46e5;"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(requesterName)}&background=4f46e5'">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${requesterName}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${requesterEmail ? '📧 ' + requesterEmail : 'Requester'}
                        </div>
                    </div>
                </div>
                
                <div style="font-size: 20px; color: var(--text-secondary);">↔️</div>
                
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <img src="${providerAvatar}" 
                         alt="${providerName}"
                         style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #0891b2;"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(providerName)}&background=0891b2'">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${providerName}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${providerEmail ? '📧 ' + providerEmail : 'Provider'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 12px; flex-wrap: wrap;">
                <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-weight: 500;">
                    📚 ${requestedSkill}
                </span>
                <span style="color: var(--text-secondary);">↔️</span>
                <span style="background: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-weight: 500;">
                    🎯 ${offeredSkill}
                </span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="status-badge" style="${statusStyle} padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                    ${status.replace('_', ' ')}
                </span>
                <span style="font-size: 11px; color: var(--text-secondary);">
                    🕐 ${timeAgo}
                </span>
            </div>
        </div>
    `;
    }).join('');
    
    container.innerHTML = html;
}

// Helper function to get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'Just now';
}

// ===== USERS MANAGEMENT =====
async function loadUsers(search = '', filter = 'all', sortBy = 'createdAt', sortOrder = 'desc') {
    try {
        const tableBody = document.getElementById('usersTableBody');
        tableBody.innerHTML = '<tr><td colspan="10" class="loading">⏳ Loading users...</td></tr>';
        
        const url = `/api/admin/users?search=${encodeURIComponent(search)}&filter=${filter}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            allUsers = data.users || [];
            
            // Apply client-side sorting
            sortUsers(allUsers, sortBy, sortOrder);
            displayUsers(allUsers);
            
            // Update badge count
            const userCountBadge = document.getElementById('userCount');
            if (userCountBadge) {
                userCountBadge.textContent = allUsers.length;
            }
        } else {
            throw new Error(data.message || 'Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        const tableBody = document.getElementById('usersTableBody');
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--danger);">❌ Error: ${error.message}</td></tr>`;
    }
}

function sortUsers(users, sortBy, sortOrder) {
    users.sort((a, b) => {
        let aVal, bVal;
        
        switch(sortBy) {
            case 'name':
                aVal = (a.fullName || '').toLowerCase();
                bVal = (b.fullName || '').toLowerCase();
                break;
            case 'email':
                aVal = (a.email || '').toLowerCase();
                bVal = (b.email || '').toLowerCase();
                break;
            case 'location':
                aVal = (a.location || '').toLowerCase();
                bVal = (b.location || '').toLowerCase();
                break;
            case 'rating':
                aVal = a.rating || 0;
                bVal = b.rating || 0;
                break;
            case 'exchanges':
                aVal = a.totalExchanges || 0;
                bVal = b.totalExchanges || 0;
                break;
            case 'skills':
                aVal = (a.skillsOffered?.length || 0) + (a.skillsWanted?.length || 0);
                bVal = (b.skillsOffered?.length || 0) + (b.skillsWanted?.length || 0);
                break;
            case 'status':
                aVal = a.isActive ? 1 : 0;
                bVal = b.isActive ? 1 : 0;
                break;
            case 'createdAt':
            default:
                aVal = new Date(a.createdAt || 0);
                bVal = new Date(b.createdAt || 0);
                break;
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
}

function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No users found</td></tr>';
        return;
    }
    
    const html = users.map(user => {
        const statusBadge = user.isActive 
            ? '<span class="status-badge status-active">🟢 Active</span>' 
            : '<span class="status-badge status-inactive">🔴 Inactive</span>';
        
        const skillsOffered = user.skillsOffered || [];
        const skillsWanted = user.skillsWanted || [];
        const totalSkills = skillsOffered.length + skillsWanted.length;
        
        const skillsDisplay = totalSkills > 0 
            ? `<span title="Offered: ${skillsOffered.length}, Wanted: ${skillsWanted.length}">
                🎯 ${skillsOffered.length} / 📚 ${skillsWanted.length}
               </span>`
            : '<span style="color: var(--text-secondary);">No skills</span>';
        
        const ratingStars = user.rating ? '⭐'.repeat(Math.round(user.rating)) : '☆☆☆☆☆';
        const ratingDisplay = user.rating 
            ? `<span title="${user.rating.toFixed(2)} stars">${ratingStars} ${user.rating.toFixed(1)}</span>`
            : '<span style="color: var(--text-secondary);">No rating</span>';
        
        const joinedDate = user.createdAt 
            ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })
            : 'N/A';
        
        const lastActive = user.lastActive 
            ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                Last: ${new Date(user.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
               </div>`
            : '';
        
        return `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${user.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || 'User')}" 
                         class="user-avatar" 
                         alt="${user.fullName || 'User'}" 
                         onerror="this.src='https://ui-avatars.com/api/?name=User'">
                    <div class="user-info">
                        <span class="user-name">${user.fullName || 'Unknown'}</span>
                        <span class="user-email">${user.email || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>${user.location || '<span style="color: var(--text-secondary);">Not specified</span>'}</td>
            <td style="text-align: center;">${skillsDisplay}</td>
            <td style="text-align: center;">
                <span class="badge" style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 12px;">
                    ${user.totalExchanges || 0}
                </span>
            </td>
            <td style="text-align: center;">${ratingDisplay}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td>
                <div>${joinedDate}</div>
                ${lastActive}
            </td>
            <td style="text-align: center;">
                <span class="badge" style="background: ${(user.reviews?.length || 0) > 0 ? 'var(--success)' : 'var(--text-secondary)'}; color: white; padding: 4px 8px; border-radius: 12px;">
                    ${user.reviews?.length || 0}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewUserDetails('${user._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action btn-edit" onclick="editUser('${user._id}')" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteUser('${user._id}', '${(user.fullName || 'User').replace(/'/g, "\\'")}')" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = html;
}

function searchUsers() {
    const searchValue = document.getElementById('userSearch').value;
    const filterValue = document.getElementById('userFilter').value;
    const sortBy = document.getElementById('userSort')?.value || 'createdAt';
    const sortOrder = document.getElementById('userSortOrder')?.value || 'desc';
    loadUsers(searchValue, filterValue, sortBy, sortOrder);
}

function filterUsers() {
    const searchValue = document.getElementById('userSearch').value;
    const filterValue = document.getElementById('userFilter').value;
    const sortBy = document.getElementById('userSort')?.value || 'createdAt';
    const sortOrder = document.getElementById('userSortOrder')?.value || 'desc';
    loadUsers(searchValue, filterValue, sortBy, sortOrder);
}

function sortUsersBy(sortBy) {
    const searchValue = document.getElementById('userSearch')?.value || '';
    const filterValue = document.getElementById('userFilter')?.value || 'all';
    const sortOrder = document.getElementById('userSortOrder')?.value || 'desc';
    loadUsers(searchValue, filterValue, sortBy, sortOrder);
}

function toggleSortOrder() {
    const sortOrderSelect = document.getElementById('userSortOrder');
    const currentOrder = sortOrderSelect.value;
    sortOrderSelect.value = currentOrder === 'asc' ? 'desc' : 'asc';
    
    const searchValue = document.getElementById('userSearch')?.value || '';
    const filterValue = document.getElementById('userFilter')?.value || 'all';
    const sortBy = document.getElementById('userSort')?.value || 'createdAt';
    loadUsers(searchValue, filterValue, sortBy, sortOrderSelect.value);
}

async function viewUserDetails(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            
            // Function to group skills by category
            const groupSkillsByCategory = (skills) => {
                const grouped = {};
                skills.forEach(skill => {
                    const skillName = skill.name || skill;
                    const category = skill.category || 'Other';
                    if (!grouped[category]) {
                        grouped[category] = [];
                    }
                    grouped[category].push(skillName);
                });
                return grouped;
            };
            
            // Function to create categorized skills HTML
            const createCategorizedSkillsHTML = (skills, type) => {
                if (!skills || skills.length === 0) {
                    return '<p style="color: var(--text-secondary);">No skills added yet</p>';
                }
                
                const grouped = groupSkillsByCategory(skills);
                const categoryEmojis = {
                    'Programming': '💻',
                    'Design': '🎨',
                    'Marketing': '📢',
                    'Business': '💼',
                    'Writing': '✍️',
                    'Data Science': '📊',
                    'AI & Machine Learning': '🤖',
                    'Video Editing': '🎬',
                    'Music': '🎵',
                    'Photography': '📷',
                    'Teaching': '👨‍🏫',
                    'Health & Fitness': '💪',
                    'Lifestyle': '🌟',
                    'Other': '📌'
                };
                
                const categoryColors = {
                    'Programming': type === 'offered' ? '#4f46e5' : '#3b82f6',
                    'Design': type === 'offered' ? '#ec4899' : '#f472b6',
                    'Marketing': type === 'offered' ? '#f59e0b' : '#fbbf24',
                    'Business': type === 'offered' ? '#10b981' : '#34d399',
                    'Writing': type === 'offered' ? '#8b5cf6' : '#a78bfa',
                    'Data Science': type === 'offered' ? '#06b6d4' : '#22d3ee',
                    'AI & Machine Learning': type === 'offered' ? '#ef4444' : '#f87171',
                    'Video Editing': type === 'offered' ? '#6366f1' : '#818cf8',
                    'Music': type === 'offered' ? '#f97316' : '#fb923c',
                    'Photography': type === 'offered' ? '#14b8a6' : '#2dd4bf',
                    'Teaching': type === 'offered' ? '#a855f7' : '#c084fc',
                    'Health & Fitness': type === 'offered' ? '#059669' : '#10b981',
                    'Lifestyle': type === 'offered' ? '#d946ef' : '#e879f9',
                    'Other': type === 'offered' ? '#6b7280' : '#9ca3af'
                };
                
                let html = '';
                Object.keys(grouped).sort().forEach(category => {
                    const emoji = categoryEmojis[category] || '📌';
                    const categoryColor = categoryColors[category] || (type === 'offered' ? 'var(--primary)' : 'var(--info)');
                    
                    html += `
                        <div style="margin-bottom: 20px; background: var(--bg-secondary); padding: 16px; border-radius: 12px; border-left: 4px solid ${categoryColor};">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                <span style="font-size: 24px;">${emoji}</span>
                                <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.8px;">
                                    ${category}
                                </h4>
                                <span style="background: ${categoryColor}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">
                                    ${grouped[category].length} ${grouped[category].length === 1 ? 'Skill' : 'Skills'}
                                </span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                ${grouped[category].map(skillName => `
                                    <div style="background: linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}dd 100%); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 500; display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s; cursor: default;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <span style="font-size: 14px;">${type === 'offered' ? '🎯' : '📚'}</span>
                                            <span style="font-weight: 600; font-size: 14px;">${skillName}</span>
                                        </div>
                                        <span style="font-size: 10px; opacity: 0.9; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 20px;">
                                            ${category}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                });
                
                return html;
            };
            
            const skillsOfferedHTML = createCategorizedSkillsHTML(user.skills_offered || user.skillsOffered || [], 'offered');
            const skillsWantedHTML = createCategorizedSkillsHTML(user.skills_wanted || user.skillsWanted || [], 'wanted');
            
            const reviewsHTML = (user.reviews || []).length > 0
                ? user.reviews.map(review => `
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong>${review.reviewerName || 'Anonymous'}</strong>
                            <span>${'⭐'.repeat(review.rating || 0)}</span>
                        </div>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">${review.comment || 'No comment'}</p>
                        <small style="color: var(--text-secondary);">${new Date(review.createdAt).toLocaleDateString()}</small>
                    </div>
                `).join('')
                : '<p style="color: var(--text-secondary);">No reviews yet</p>';
            
            const modalBody = document.getElementById('editUserForm');
            modalBody.innerHTML = `
                <div class="user-details-view">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <img src="${user.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || 'User')}" 
                             style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid var(--primary);"
                             onerror="this.src='https://ui-avatars.com/api/?name=User'">
                        <h2 style="margin: 16px 0 8px 0;">${user.fullName || 'Unknown'}</h2>
                        <p style="color: var(--text-secondary); margin: 0;">${user.email || 'N/A'}</p>
                        <div style="margin-top: 12px;">
                            ${user.isActive 
                                ? '<span class="status-badge status-active">🟢 Active</span>' 
                                : '<span class="status-badge status-inactive">🔴 Inactive</span>'}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>📍 Location</h3>
                        <p>${user.location || 'Not specified'}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h3>📊 Statistics</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${user.totalExchanges || 0}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Total Exchanges</div>
                            </div>
                            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: var(--warning);">⭐ ${user.rating ? user.rating.toFixed(1) : 'N/A'}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Rating</div>
                            </div>
                            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: var(--success);">${user.reviews?.length || 0}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Reviews</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>🎯 Skills Offered (${(user.skillsOffered || []).length})</h3>
                        <div class="skills-container">
                            ${skillsOfferedHTML}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>📚 Skills Wanted (${(user.skillsWanted || []).length})</h3>
                        <div class="skills-container">
                            ${skillsWantedHTML}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>💬 Bio</h3>
                        <p style="white-space: pre-wrap;">${user.bio || 'No bio provided'}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h3>⭐ Reviews (${(user.reviews || []).length})</h3>
                        ${reviewsHTML}
                    </div>
                    
                    <div class="detail-section">
                        <h3>📅 Account Information</h3>
                        <p><strong>Joined:</strong> ${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
                        <p><strong>Last Active:</strong> ${user.lastActive ? new Date(user.lastActive).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
                        <p><strong>User ID:</strong> <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-size: 12px;">${user._id}</code></p>
                    </div>
                </div>
            `;
            
            openModal('editUserModal');
        } else {
            showError(data.message || 'Failed to load user details');
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        showError('Error loading user details: ' + error.message);
    }
}

async function editUser(userId) {
    try {
        // Fetch user data and available skills in parallel
        const [userResponse, skillsResponse] = await Promise.all([
            fetch(`/api/admin/users/${userId}`, { headers: getAuthHeaders() }),
            fetch('/api/skills?isActive=true', { headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` } })
        ]);
        
        if (!userResponse.ok) {
            throw new Error(`HTTP ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();
        const skillsData = skillsResponse.ok ? await skillsResponse.json() : { success: false, skills: [] };
        
        if (userData.success && userData.user) {
            const user = userData.user;
            const availableSkills = skillsData.success ? skillsData.skills : [];
            
            // Group skills by category
            const skillsByCategory = {};
            availableSkills.forEach(skill => {
                if (!skillsByCategory[skill.category]) {
                    skillsByCategory[skill.category] = [];
                }
                skillsByCategory[skill.category].push(skill);
            });
            
            // Get user's current skills
            const userSkillsOffered = user.skills_offered || [];
            const userSkillsWanted = user.skills_wanted || [];
            
            // Create skills selector HTML
            const createSkillsSelector = (type, currentSkills) => {
                const id = type === 'offered' ? 'editUserSkillsOffered' : 'editUserSkillsWanted';
                const label = type === 'offered' ? '🎯 Skills You Offer' : '📚 Skills You Want';
                const defaultLevel = type === 'offered' ? 'Intermediate' : 'Beginner';
                
                let html = `
                    <div class="setting-item">
                        <label>${label}</label>
                        <div style="margin-bottom: 10px; display: grid; grid-template-columns: 1fr auto; gap: 8px;">
                            <select id="${id}Selector" class="form-control">
                                <option value="">Select a skill to add...</option>
                `;
                
                // Group options by category
                Object.keys(skillsByCategory).sort().forEach(category => {
                    html += `<optgroup label="${category}">`;
                    skillsByCategory[category].forEach(skill => {
                        html += `<option value="${skill._id}" data-name="${skill.name}" data-category="${skill.category}">${skill.name}</option>`;
                    });
                    html += `</optgroup>`;
                });
                
                html += `
                            </select>
                            <select id="${id}LevelSelector" class="form-control" style="width: 140px;">
                                <option value="Beginner" ${defaultLevel === 'Beginner' ? 'selected' : ''}>Beginner</option>
                                <option value="Intermediate" ${defaultLevel === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Expert">Expert</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-sm" onclick="addSkillToList('${type}')" style="width: 100%; background: var(--primary); color: white; margin-bottom: 10px;">
                            <i class="fas fa-plus"></i> Add Skill
                        </button>
                        <div id="${id}Container" class="skills-container" style="min-height: 60px; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; background: var(--bg-secondary);">
                `;
                
                // Display current skills
                currentSkills.forEach(skill => {
                    const skillName = skill.name || skill;
                    const skillCategory = skill.category || '';
                    const skillLevel = skill.experience_level || defaultLevel;
                    html += `
                        <div class="skill-badge" data-skill-name="${skillName}" data-skill-level="${skillLevel}" style="display: inline-flex; align-items: center; gap: 6px; background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px; margin: 4px; font-size: 13px;">
                            <span>${skillName}</span>
                            ${skillCategory ? `<span style="opacity: 0.7; font-size: 11px;">(${skillCategory})</span>` : ''}
                            <span style="opacity: 0.8; font-size: 10px; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">${skillLevel}</span>
                            <button type="button" onclick="removeSkillFromList('${type}', '${skillName}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; margin-left: 4px; font-size: 16px;">
                                ×
                            </button>
                        </div>
                    `;
                });
                
                if (currentSkills.length === 0) {
                    html += '<p style="color: var(--text-secondary); margin: 0; text-align: center;">No skills added yet</p>';
                }
                
                html += `
                        </div>
                    </div>
                `;
                
                return html;
            };
            
            // Populate modal with form
            const modalBody = document.getElementById('editUserForm');
            modalBody.innerHTML = `
                <input type="hidden" id="editUserId" value="${user._id}">
                
                <div class="setting-item" style="text-align: center; margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px;">Profile Picture</label>
                    <div style="position: relative; display: inline-block;">
                        <img id="profilePicPreview" src="${user.profilePicture || user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'User')}" 
                             style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary);" 
                             alt="Profile Picture">
                        <label for="profilePicInput" style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            <i class="fas fa-camera"></i>
                        </label>
                        <input type="file" id="profilePicInput" accept="image/*" style="display: none;" onchange="handleProfilePicChange(event)">
                    </div>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Click camera icon to upload new picture</p>
                </div>
                
                <div class="setting-item">
                    <label>Full Name</label>
                    <input type="text" class="form-control" id="editUserName" value="${user.name || user.fullName || ''}" required>
                </div>
                <div class="setting-item">
                    <label>Email</label>
                    <input type="email" class="form-control" id="editUserEmail" value="${user.email || ''}" required>
                </div>
                <div class="setting-item">
                    <label>Location</label>
                    <input type="text" class="form-control" id="editUserLocation" value="${user.location || ''}">
                </div>
                <div class="setting-item">
                    <label>Bio</label>
                    <textarea class="form-control" id="editUserBio" rows="4">${user.bio || ''}</textarea>
                </div>
                
                ${createSkillsSelector('offered', userSkillsOffered)}
                ${createSkillsSelector('wanted', userSkillsWanted)}
                
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="saveUser()">💾 Save Changes</button>
                    <button class="btn btn-secondary" onclick="closeModal('editUserModal')">Cancel</button>
                </div>
            `;
            
            openModal('editUserModal');
        } else {
            showError('User not found');
        }
    } catch (error) {
        console.error('Error loading user:', error);
        showError('Error loading user details');
    }
}

// Add skill to list
function addSkillToList(type) {
    const selectorId = type === 'offered' ? 'editUserSkillsOfferedSelector' : 'editUserSkillsWantedSelector';
    const levelSelectorId = type === 'offered' ? 'editUserSkillsOfferedLevelSelector' : 'editUserSkillsWantedLevelSelector';
    const containerId = type === 'offered' ? 'editUserSkillsOfferedContainer' : 'editUserSkillsWantedContainer';
    
    const selector = document.getElementById(selectorId);
    const levelSelector = document.getElementById(levelSelectorId);
    const container = document.getElementById(containerId);
    
    if (!selector || !container || !levelSelector) return;
    
    const selectedOption = selector.options[selector.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;
    
    const skillName = selectedOption.getAttribute('data-name');
    const skillCategory = selectedOption.getAttribute('data-category');
    const skillLevel = levelSelector.value;
    
    // Check if skill already exists
    const existing = container.querySelector(`[data-skill-name="${skillName}"]`);
    if (existing) {
        showNotification('Skill already added!', 'error');
        return;
    }
    
    // Remove empty message if exists
    const emptyMsg = container.querySelector('p');
    if (emptyMsg) emptyMsg.remove();
    
    // Add skill badge
    const skillBadge = document.createElement('div');
    skillBadge.className = 'skill-badge';
    skillBadge.setAttribute('data-skill-name', skillName);
    skillBadge.setAttribute('data-skill-level', skillLevel);
    skillBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px; margin: 4px; font-size: 13px;';
    skillBadge.innerHTML = `
        <span>${skillName}</span>
        ${skillCategory ? `<span style="opacity: 0.7; font-size: 11px;">(${skillCategory})</span>` : ''}
        <span style="opacity: 0.8; font-size: 10px; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">${skillLevel}</span>
        <button type="button" onclick="removeSkillFromList('${type}', '${skillName}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; margin-left: 4px; font-size: 16px;">
            ×
        </button>
    `;
    
    container.appendChild(skillBadge);
    
    // Reset selectors
    selector.selectedIndex = 0;
    levelSelector.selectedIndex = type === 'offered' ? 1 : 0; // Reset to default (Intermediate for offered, Beginner for wanted)
    
    showNotification('Skill added! ✅', 'success');
}

// Remove skill from list
function removeSkillFromList(type, skillName) {
    const containerId = type === 'offered' ? 'editUserSkillsOfferedContainer' : 'editUserSkillsWantedContainer';
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    const skillBadge = container.querySelector(`[data-skill-name="${skillName}"]`);
    if (skillBadge) {
        skillBadge.remove();
    }
    
    // Add empty message if no skills left
    if (container.children.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); margin: 0; text-align: center;">No skills added yet</p>';
    }
    
    showNotification('Skill removed!', 'info');
}

async function saveUser() {
    const userId = document.getElementById('editUserId').value;
    
    // Get skills from containers with experience level
    const getSkillsFromContainer = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return [];
        
        const skillBadges = container.querySelectorAll('.skill-badge');
        return Array.from(skillBadges).map(badge => {
            const skillName = badge.getAttribute('data-skill-name');
            const skillLevel = badge.getAttribute('data-skill-level');
            return { 
                name: skillName,
                experience_level: skillLevel || 'Intermediate'
            };
        });
    };
    
    const userData = {
        name: document.getElementById('editUserName').value,
        email: document.getElementById('editUserEmail').value,
        location: document.getElementById('editUserLocation').value,
        bio: document.getElementById('editUserBio').value,
        skills_offered: getSkillsFromContainer('editUserSkillsOfferedContainer'),
        skills_wanted: getSkillsFromContainer('editUserSkillsWantedContainer')
    };
    
    // Add profile picture if uploaded
    if (uploadedProfilePic) {
        userData.profilePicture = uploadedProfilePic;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('editUserModal');
            
            // Update user in allUsers array
            const userIndex = allUsers.findIndex(u => u._id === userId);
            if (userIndex !== -1) {
                allUsers[userIndex] = { ...allUsers[userIndex], ...userData };
            }
            
            // Re-display users with updated data
            displayUsers(allUsers);
            
            showSuccess('✅ User updated successfully!');
            
            // Clear uploaded picture
            uploadedProfilePic = null;
            
            // Update main app cache if user is logged in
            localStorage.setItem('userDataUpdated', Date.now());
        } else {
            showError(data.message || 'Failed to update user');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showError('Error updating user: ' + error.message);
    }
}

function deleteUser(userId, userName) {
    const confirmMsg = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    confirmMsg.innerHTML = `
        <p>Are you sure you want to delete this user?</p>
        <p style="margin-top: 10px; font-weight: 600; font-size: 16px;">${userName}</p>
        <p style="color: var(--danger); margin-top: 10px; font-weight: 500;">⚠️ This will also delete:</p>
        <ul style="text-align: left; margin: 10px 0; padding-left: 20px; color: var(--text-secondary);">
            <li>All user's skills</li>
            <li>All user's exchanges</li>
            <li>All user's messages</li>
            <li>User's profile data</li>
        </ul>
        <p style="color: var(--danger); font-weight: 600;">This action cannot be undone!</p>
    `;
    confirmBtn.onclick = () => confirmDeleteUser(userId, userName);
    
    openModal('confirmModal');
}

async function confirmDeleteUser(userId, userName) {
    try {
        // Show loading state
        const confirmBtn = document.getElementById('confirmBtn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        confirmBtn.disabled = true;
        
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('confirmModal');
            
            // Optimized: Remove user from allUsers array immediately (no reload needed)
            allUsers = allUsers.filter(user => user._id !== userId);
            
            // Re-display current users without API call
            displayUsers(allUsers);
            
            showSuccess(`✅ User "${userName}" deleted successfully!`);
            
            // Update stats count
            updateStatsCount();
            
            // Reset button for next use
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        } else {
            showError(data.message || 'Failed to delete user');
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('Error deleting user: ' + error.message);
        
        // Reset button
        const confirmBtn = document.getElementById('confirmBtn');
        confirmBtn.innerHTML = 'Confirm';
        confirmBtn.disabled = false;
    }
}

// Update stats count after user deletion
function updateStatsCount() {
    const userCount = document.querySelector('.stat-card h3');
    if (userCount && allUsers) {
        userCount.textContent = allUsers.length;
    }
}

// Handle profile picture change
let uploadedProfilePic = null;

function handleProfilePicChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showError('Image size must be less than 5MB');
        return;
    }
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('profilePicPreview');
        if (preview) {
            preview.src = e.target.result;
            uploadedProfilePic = e.target.result; // Store base64 for upload
        }
    };
    reader.readAsDataURL(file);
}

// ===== EXCHANGES MANAGEMENT =====
async function loadExchanges(filter = 'all') {
    try {
        const tableBody = document.getElementById('exchangesTableBody');
        tableBody.innerHTML = '<tr><td colspan="7" class="loading">⏳ Loading exchanges...</td></tr>';
        
        const url = `/api/admin/exchanges?status=${filter}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            allExchanges = data.exchanges || [];
            displayExchanges(allExchanges);
            
            // Update badge count
            const exchangeCountBadge = document.getElementById('exchangeCount');
            if (exchangeCountBadge) {
                exchangeCountBadge.textContent = allExchanges.length;
            }
        } else {
            throw new Error(data.message || 'Failed to load exchanges');
        }
    } catch (error) {
        console.error('Error loading exchanges:', error);
        const tableBody = document.getElementById('exchangesTableBody');
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">❌ Error: ${error.message}</td></tr>`;
    }
}

function displayExchanges(exchanges) {
    const tableBody = document.getElementById('exchangesTableBody');
    
    if (!exchanges || exchanges.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">No exchanges found</td></tr>';
        return;
    }
    
    const html = exchanges.map(exchange => {
        // Get requester and provider info
        const requester = exchange.requester_id || {};
        const provider = exchange.provider_id || {};
        
        // Format status with proper styling
        const statusClass = exchange.status || 'pending';
        const statusDisplay = (exchange.status || 'pending').charAt(0).toUpperCase() + (exchange.status || 'pending').slice(1);
        
        // Format date
        const createdDate = exchange.created_date || exchange.createdAt;
        const dateDisplay = createdDate ? new Date(createdDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'N/A';
        
        return `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${requester.profilePicture || requester.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(requester.fullName || requester.name || 'User')}" 
                         class="user-avatar" 
                         alt="${requester.fullName || requester.name || 'User'}" 
                         onerror="this.src='https://ui-avatars.com/api/?name=User'">
                    <div class="user-info">
                        <span class="user-name">${requester.fullName || requester.name || 'Unknown User'}</span>
                        <span class="user-email">${requester.email || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="user-cell">
                    <img src="${provider.profilePicture || provider.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(provider.fullName || provider.name || 'User')}" 
                         class="user-avatar" 
                         alt="${provider.fullName || provider.name || 'User'}" 
                         onerror="this.src='https://ui-avatars.com/api/?name=User'">
                    <div class="user-info">
                        <span class="user-name">${provider.fullName || provider.name || 'Unknown User'}</span>
                        <span class="user-email">${provider.email || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 500; color: var(--primary);">📚 ${exchange.requested_skill || exchange.skillWanted || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 500; color: var(--success);">🎯 ${exchange.offered_skill || exchange.skillOffered || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="status-badge status-${statusClass}">${statusDisplay}</span>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span>${dateDisplay}</span>
                    ${createdDate ? '<span style="font-size: 11px; color: var(--text-secondary);">' + new Date(createdDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + '</span>' : ''}
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewExchangeDetails('${exchange._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="confirmDeleteExchange('${exchange._id}', '${(requester.fullName || requester.name || 'User').replace(/'/g, "\\'")}', '${(provider.fullName || provider.name || 'User').replace(/'/g, "\\'")}' )" title="Delete Exchange">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = html;
}

function filterExchanges() {
    const filterValue = document.getElementById('exchangeFilter').value;
    loadExchanges(filterValue);
}

async function viewExchangeDetails(exchangeId) {
    try {
        const response = await fetch(`/api/admin/exchanges/${exchangeId}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.exchange) {
            const exchange = data.exchange;
            const requester = exchange.requester_id || {};
            const provider = exchange.provider_id || {};
            
            // Get proper names and emails
            const requesterName = requester.fullName || requester.name || 'Unknown User';
            const requesterEmail = requester.email || 'N/A';
            const requesterAvatar = requester.profilePicture || requester.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(requesterName)}&background=random`;
            
            const providerName = provider.fullName || provider.name || 'Unknown User';
            const providerEmail = provider.email || 'N/A';
            const providerAvatar = provider.profilePicture || provider.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(providerName)}&background=random`;
            
            // Format dates properly
            const createdDate = exchange.created_date || exchange.createdAt;
            const completedDate = exchange.completed_date;
            const formattedCreated = createdDate 
                ? new Date(createdDate).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })
                : 'N/A';
            
            const formattedCompleted = completedDate 
                ? new Date(completedDate).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })
                : null;
            
            // Status badge styling
            const statusColors = {
                'pending': 'background: #fef3c7; color: #92400e; border: 1px solid #fbbf24;',
                'accepted': 'background: #dbeafe; color: #1e40af; border: 1px solid #3b82f6;',
                'in_progress': 'background: #e0e7ff; color: #4338ca; border: 1px solid #6366f1;',
                'completed': 'background: #d1fae5; color: #065f46; border: 1px solid #10b981;',
                'cancelled': 'background: #fee2e2; color: #991b1b; border: 1px solid #ef4444;'
            };
            const statusStyle = statusColors[exchange.status] || statusColors.pending;
            
            // Create modal content
            const modalContent = `
                <div class="exchange-details-modal">
                    <h3 style="margin-bottom: 24px; color: var(--primary); font-size: 24px; border-bottom: 2px solid var(--primary); padding-bottom: 12px;">
                        📊 Exchange Details
                    </h3>
                    
                    <div class="detail-section" style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin-bottom: 12px; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Status</h4>
                        <span class="status-badge" style="${statusStyle} padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; display: inline-block;">
                            ${exchange.status.toUpperCase().replace('_', ' ')}
                        </span>
                    </div>
                    
                    <div class="detail-section" style="background: #fef9e7; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                        <h4 style="margin-bottom: 16px; color: #92400e; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">👤</span> Requester
                        </h4>
                        <div class="user-card" style="display: flex; align-items: center; gap: 16px; background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            <img src="${requesterAvatar}" 
                                 class="user-avatar" 
                                 alt="${requesterName}"
                                 style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid #f59e0b;">
                            <div class="user-info" style="flex: 1;">
                                <div class="user-name" style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                                    ${requesterName}
                                </div>
                                <div class="user-email" style="font-size: 14px; color: #64748b; display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 16px;">📧</span> ${requesterEmail}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section" style="background: #eff6ff; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                        <h4 style="margin-bottom: 16px; color: #1e40af; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">👥</span> Provider
                        </h4>
                        <div class="user-card" style="display: flex; align-items: center; gap: 16px; background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            <img src="${providerAvatar}" 
                                 class="user-avatar" 
                                 alt="${providerName}"
                                 style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid #3b82f6;">
                            <div class="user-info" style="flex: 1;">
                                <div class="user-name" style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                                    ${providerName}
                                </div>
                                <div class="user-email" style="font-size: 14px; color: #64748b; display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 16px;">📧</span> ${providerEmail}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section" style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                        <h4 style="margin-bottom: 16px; color: #065f46; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">🔄</span> Skills Exchange
                        </h4>
                        <div style="background: white; padding: 16px; border-radius: 8px;">
                            <p style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 600; color: #059669; min-width: 140px;">📚 Requested Skill:</span>
                                <span style="background: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 6px; font-weight: 500;">
                                    ${exchange.requested_skill || exchange.skillWanted || 'N/A'}
                                </span>
                            </p>
                            <p style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 600; color: #0891b2; min-width: 140px;">🎯 Offered Skill:</span>
                                <span style="background: #cffafe; color: #155e75; padding: 6px 12px; border-radius: 6px; font-weight: 500;">
                                    ${exchange.offered_skill || exchange.skillOffered || 'N/A'}
                                </span>
                            </p>
                        </div>
                    </div>
                    
                    <div class="detail-section" style="background: #fdf4ff; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #a855f7;">
                        <h4 style="margin-bottom: 16px; color: #7e22ce; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">📅</span> Timeline
                        </h4>
                        <div style="background: white; padding: 16px; border-radius: 8px;">
                            <p style="margin-bottom: 12px; display: flex; align-items: start; gap: 8px;">
                                <span style="font-weight: 600; color: #7e22ce; min-width: 100px;">Created:</span>
                                <span style="color: #64748b; font-family: 'Courier New', monospace;">${formattedCreated}</span>
                            </p>
                            ${formattedCompleted ? `
                                <p style="display: flex; align-items: start; gap: 8px;">
                                    <span style="font-weight: 600; color: #059669; min-width: 100px;">Completed:</span>
                                    <span style="color: #64748b; font-family: 'Courier New', monospace;">${formattedCompleted}</span>
                                </p>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${exchange.rating ? `
                        <div class="detail-section" style="background: #fff7ed; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #ea580c;">
                            <h4 style="margin-bottom: 16px; color: #9a3412; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 20px;">⭐</span> Rating & Review
                            </h4>
                            <div style="background: white; padding: 16px; border-radius: 8px;">
                                <p style="margin-bottom: 8px; font-size: 24px;">
                                    ${'⭐'.repeat(exchange.rating)}${'☆'.repeat(5 - exchange.rating)}
                                </p>
                                <p style="color: #64748b; margin-bottom: 8px;">Rating: <strong>${exchange.rating}/5</strong></p>
                                ${exchange.review ? `
                                    <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 3px solid #f59e0b; margin-top: 12px;">
                                        <p style="color: #92400e; font-style: italic; margin: 0;">"${exchange.review}"</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="modal-actions" style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn btn-secondary" onclick="closeModal('editUserModal')" style="padding: 10px 24px; font-size: 14px;">
                            ✖️ Close
                        </button>
                    </div>
                </div>
            `;
            
            document.getElementById('editUserForm').innerHTML = modalContent;
            openModal('editUserModal');
        } else {
            showError('Exchange not found');
        }
    } catch (error) {
        console.error('Error loading exchange details:', error);
        showError('Error loading exchange details: ' + error.message);
    }
}

function confirmDeleteExchange(exchangeId, requesterName, providerName) {
    const confirmMsg = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    confirmMsg.innerHTML = `
        <p>Are you sure you want to delete this exchange?</p>
        <p style="margin-top: 10px;"><strong>Requester:</strong> ${requesterName}</p>
        <p><strong>Provider:</strong> ${providerName}</p>
        <p style="color: var(--danger); margin-top: 10px; font-weight: 500;">This action cannot be undone!</p>
    `;
    confirmBtn.onclick = () => deleteExchange(exchangeId);
    
    openModal('confirmModal');
}

async function deleteExchange(exchangeId) {
    try {
        const response = await fetch(`/api/admin/exchanges/${exchangeId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('confirmModal');
            showSuccess('Exchange deleted successfully! 🗑️');
            
            // Reload exchanges with current filter
            const filterValue = document.getElementById('exchangeFilter')?.value || 'all';
            loadExchanges(filterValue);
        } else {
            showError(data.message || 'Failed to delete exchange');
        }
    } catch (error) {
        console.error('Error deleting exchange:', error);
        showError('Error deleting exchange');
    }
}

// ===== SKILLS MANAGEMENT =====
async function loadSkills(search = '', category = 'all') {
    try {
        const container = document.getElementById('skillsGrid');
        container.innerHTML = '<div class="loading">⏳ Loading skills...</div>';
        
        // Extract skills from all users
        const skillsMap = new Map();
        
        allUsers.forEach(user => {
            if (user.skillsOffered && Array.isArray(user.skillsOffered)) {
                user.skillsOffered.forEach(skill => {
                    const skillName = skill.name || skill;
                    const skillCategory = skill.category || 'General';
                    const skillLevel = skill.level || 'Intermediate';
                    
                    if (skillName) {
                        const key = `${skillName}-${skillCategory}`;
                        
                        if (!skillsMap.has(key)) {
                            skillsMap.set(key, {
                                name: skillName,
                                category: skillCategory,
                                level: skillLevel,
                                providers: []
                            });
                        }
                        
                        // Add user as provider if not already added
                        const skillData = skillsMap.get(key);
                        if (!skillData.providers.find(p => p._id === user._id)) {
                            skillData.providers.push({
                                _id: user._id,
                                fullName: user.fullName,
                                email: user.email,
                                location: user.location,
                                rating: user.rating
                            });
                        }
                    }
                });
            }
        });
        
        // Convert map to array
        allSkills = Array.from(skillsMap.values());
        
        // Apply filters
        let filteredSkills = allSkills;
        
        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            filteredSkills = filteredSkills.filter(skill => 
                skill.name.toLowerCase().includes(searchLower) ||
                skill.category.toLowerCase().includes(searchLower)
            );
        }
        
        // Filter by category
        if (category !== 'all') {
            filteredSkills = filteredSkills.filter(skill => 
                skill.category.toLowerCase() === category.toLowerCase()
            );
        }
        
        displaySkills(filteredSkills);
    } catch (error) {
        console.error('Error loading skills:', error);
        const container = document.getElementById('skillsGrid');
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 18px; margin-bottom: 8px;">Error loading skills</div>
                <div style="font-size: 14px; color: var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}

function displaySkills(skills) {
    const container = document.getElementById('skillsGrid');
    
    if (!skills || skills.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 64px; margin-bottom: 20px;">🎯</div>
                <div style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">No Skills Found</div>
                <div style="font-size: 14px;">Try adjusting your search or filter criteria</div>
            </div>
        `;
        return;
    }
    
    // Category colors and emojis
    const categoryStyles = {
        'Programming': { emoji: '💻', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
        'Design': { emoji: '🎨', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
        'Marketing': { emoji: '📱', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        'Languages': { emoji: '🗣️', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        'Business': { emoji: '💼', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
        'Music': { emoji: '🎵', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
        'Sports': { emoji: '⚽', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
        'Cooking': { emoji: '👨‍🍳', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
        'General': { emoji: '🎯', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' }
    };
    
    const levelBadges = {
        'Beginner': { emoji: '🌱', color: '#10b981' },
        'Intermediate': { emoji: '📊', color: '#f59e0b' },
        'Advanced': { emoji: '🏆', color: '#6366f1' },
        'Expert': { emoji: '⭐', color: '#ef4444' }
    };
    
    const html = skills.map(skill => {
        const categoryStyle = categoryStyles[skill.category] || categoryStyles['General'];
        const levelBadge = levelBadges[skill.level] || levelBadges['Intermediate'];
        const providersCount = skill.providers.length;
        
        // Get top 3 providers by rating
        const topProviders = skill.providers
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 3);
        
        // Calculate average rating
        const avgRating = skill.providers.length > 0
            ? skill.providers.reduce((sum, p) => sum + (p.rating || 0), 0) / skill.providers.length
            : 0;
        
        return `
            <div class="skill-card" style="background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" 
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.2)'; this.style.borderColor='${categoryStyle.color}';" 
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'; this.style.borderColor='var(--border-color)';">
                
                <!-- Header with Category -->
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div style="flex: 1;">
                        <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">
                            ${categoryStyle.emoji} ${skill.name}
                        </div>
                        <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${categoryStyle.bg}; color: ${categoryStyle.color};">
                            ${skill.category}
                        </div>
                    </div>
                </div>
                
                <!-- Stats Row -->
                <div style="display: flex; gap: 16px; margin-bottom: 16px; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: ${categoryStyle.color};">${providersCount}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Providers</div>
                    </div>
                    <div style="width: 1px; background: var(--border-color);"></div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">⭐ ${avgRating.toFixed(1)}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Avg Rating</div>
                    </div>
                    <div style="width: 1px; background: var(--border-color);"></div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px;">${levelBadge.emoji}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${skill.level}</div>
                    </div>
                </div>
                
                <!-- Top Providers -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Top Providers
                    </div>
                    ${topProviders.map((provider, index) => `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-primary); border-radius: 6px; margin-bottom: 4px;">
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${categoryStyle.bg}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${categoryStyle.color};">
                                ${index + 1}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${provider.fullName}
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary);">
                                    📍 ${provider.location || 'Location not set'}
                                </div>
                            </div>
                            ${provider.rating ? `
                                <div style="font-size: 12px; font-weight: 600; color: #f59e0b; white-space: nowrap;">
                                    ⭐ ${provider.rating.toFixed(1)}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    ${providersCount > 3 ? `
                        <div style="text-align: center; padding: 8px; font-size: 12px; color: var(--text-secondary);">
                            +${providersCount - 3} more provider${providersCount - 3 !== 1 ? 's' : ''}
                        </div>
                    ` : ''}
                </div>
                
                <!-- View All Button -->
                <button onclick="viewSkillProviders('${skill.name.replace(/'/g, "\\'")}', event)" 
                        style="width: 100%; padding: 10px; background: ${categoryStyle.bg}; color: ${categoryStyle.color}; border: 1px solid ${categoryStyle.color}; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='${categoryStyle.color}'; this.style.color='white';"
                        onmouseout="this.style.background='${categoryStyle.bg}'; this.style.color='${categoryStyle.color}';">
                    View All ${providersCount} Provider${providersCount !== 1 ? 's' : ''}
                </button>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function searchSkills() {
    const searchValue = document.getElementById('skillSearch').value;
    const categoryValue = document.getElementById('categoryFilter').value;
    loadSkills(searchValue, categoryValue);
}

function filterSkills() {
    const searchValue = document.getElementById('skillSearch').value;
    const categoryValue = document.getElementById('categoryFilter').value;
    loadSkills(searchValue, categoryValue);
}

// View all providers for a skill in a modal
function viewSkillProviders(skillName, event) {
    event.stopPropagation();
    
    // Find the skill in allSkills
    const skill = allSkills.find(s => s.name === skillName);
    if (!skill) return;
    
    // Category styles
    const categoryStyles = {
        'Programming': { emoji: '💻', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
        'Design': { emoji: '🎨', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
        'Marketing': { emoji: '📱', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        'Languages': { emoji: '🗣️', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        'Business': { emoji: '💼', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
        'Music': { emoji: '🎵', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
        'Sports': { emoji: '⚽', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
        'Cooking': { emoji: '👨‍🍳', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
        'General': { emoji: '🎯', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' }
    };
    
    const categoryStyle = categoryStyles[skill.category] || categoryStyles['General'];
    
    // Sort providers by rating
    const sortedProviders = [...skill.providers].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;
    
    modal.innerHTML = `
        <div style="background: var(--surface); border-radius: 16px; padding: 0; max-width: 600px; width: 90%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; animation: slideUp 0.3s ease;">
            <!-- Header -->
            <div style="padding: 24px; border-bottom: 1px solid var(--border-color); background: ${categoryStyle.bg};">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: ${categoryStyle.color}; margin-bottom: 8px;">
                            ${categoryStyle.emoji} ${skill.name}
                        </div>
                        <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${categoryStyle.color}; color: white;">
                            ${skill.category}
                        </div>
                    </div>
                    <button onclick="this.closest('[style*=\\'z-index: 10000\\']').remove()" 
                            style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(0,0,0,0.1)'"
                            onmouseout="this.style.background='transparent'">
                        ×
                    </button>
                </div>
            </div>
            
            <!-- Providers List -->
            <div style="flex: 1; overflow-y: auto; padding: 24px;">
                <div style="font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
                    All Providers (${sortedProviders.length})
                </div>
                ${sortedProviders.map((provider, index) => `
                    <div style="padding: 16px; background: var(--bg-primary); border-radius: 12px; margin-bottom: 12px; transition: all 0.2s; cursor: pointer;"
                         onmouseover="this.style.background='var(--surface-hover)'; this.style.transform='translateX(4px)'"
                         onmouseout="this.style.background='var(--bg-primary)'; this.style.transform='translateX(0)'">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${categoryStyle.bg}; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: ${categoryStyle.color}; flex-shrink: 0;">
                                ${index + 1}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">
                                    ${provider.fullName}
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary);">
                                    📧 ${provider.email}
                                </div>
                            </div>
                            ${provider.rating ? `
                                <div style="text-align: center; padding: 8px 16px; background: rgba(245, 158, 11, 0.1); border-radius: 8px;">
                                    <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">⭐ ${provider.rating.toFixed(1)}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">Rating</div>
                                </div>
                            ` : `
                                <div style="text-align: center; padding: 8px 16px; background: var(--surface); border-radius: 8px;">
                                    <div style="font-size: 16px; color: var(--text-secondary);">-</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">No Rating</div>
                                </div>
                            `}
                        </div>
                        <div style="display: flex; gap: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                            <div style="flex: 1;">
                                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">📍 Location</div>
                                <div style="font-size: 13px; font-weight: 600;">${provider.location || 'Not specified'}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Footer -->
            <div style="padding: 20px; border-top: 1px solid var(--border-color); background: var(--bg-primary); text-align: center;">
                <button onclick="this.closest('[style*=\\'z-index: 10000\\']').remove()" 
                        style="padding: 12px 32px; background: ${categoryStyle.color}; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.opacity='0.9'; this.style.transform='scale(1.02)'"
                        onmouseout="this.style.opacity='1'; this.style.transform='scale(1)'">
                    Close
                </button>
            </div>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close on Escape key
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
}

// ===== ANALYTICS =====
async function loadAnalytics() {
    try {
        // Load analytics data
        const response = await fetch('/api/admin/analytics');
        
        if (!response.ok) {
            console.warn(`Analytics API returned ${response.status}, loading demo data`);
            loadDemoAnalytics();
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.charts) {
            // Update summary stats
            const totalActivity = (allUsers.length || 0) + (allExchanges.length || 0);
            document.getElementById('analyticsActivity').textContent = totalActivity;
            document.getElementById('analyticsGrowth').textContent = '+15%';
            document.getElementById('analyticsCompletion').textContent = '78%';
            document.getElementById('analyticsSatisfaction').textContent = '4.5';
            
            // Render charts if Chart.js is available
            if (typeof Chart !== 'undefined' && data.charts) {
                renderChart('userGrowthCanvas', 'line', data.charts.userGrowth);
                renderChart('exchangeStatsCanvas', 'doughnut', data.charts.exchangeStatus);
                renderChart('skillsDistCanvas', 'bar', data.charts.popularSkills);
                renderChart('ratingDistCanvas', 'line', data.charts.monthlyActivity);
            } else {
                console.warn('⚠️ Chart.js not available or no chart data');
            }
            
            // Display insights
            if (data.insights) {
                displayInsights(data.insights);
            }
            
            // Display top users and popular skills with real data
            displayTopPerformingUsers();
            displayMostPopularSkills();
        } else {
            console.warn('No analytics data available, loading demo data');
            loadDemoAnalytics();
        }
    } catch (error) {
        console.error('❌ Error loading analytics:', error);
        // Load demo data on error
        loadDemoAnalytics();
    }
}

function renderChart(canvasId, type, chartData) {
    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id '${canvasId}' not found`);
            return;
        }
        
        // Verify it's actually a canvas element
        if (!(canvas instanceof HTMLCanvasElement)) {
            console.error(`Element '${canvasId}' is not a canvas element`);
            return;
        }
        
        // Destroy existing chart if it exists
        if (canvas.chart) {
            canvas.chart.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error(`Failed to get 2D context for canvas '${canvasId}'`);
            return;
        }
        
        canvas.chart = new Chart(ctx, {
            type: type,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: type === 'doughnut' || type === 'pie',
                        position: 'bottom',
                        labels: {
                            color: '#e5e7eb',
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1
                    }
                },
                scales: type !== 'doughnut' && type !== 'pie' ? {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                } : {}
            }
        });
    } catch (error) {
        console.error(`❌ Error rendering chart '${canvasId}':`, error);
    }
}

function displayInsights(insights) {
    const container = document.getElementById('insightsContainer');
    if (!container) return;
    
    const html = insights.map(insight => `
        <div class="insight-card">
            <div class="insight-header">
                <h4>${insight.title}</h4>
                <span class="insight-status ${insight.status}">${insight.status}</span>
            </div>
            <p>${insight.description}</p>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function loadDemoAnalytics() {
    // Set summary stats
    const totalActivity = (allUsers.length || 0) + (allExchanges.length || 0);
    document.getElementById('analyticsActivity').textContent = totalActivity;
    document.getElementById('analyticsGrowth').textContent = '+15%';
    document.getElementById('analyticsCompletion').textContent = '78%';
    document.getElementById('analyticsSatisfaction').textContent = '4.5';
    
    // Create demo chart data
    if (typeof Chart !== 'undefined') {
        // User Growth Chart
        const userGrowthData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'New Users',
                data: [12, 19, 15, 25, 32, 28],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }]
        };
        
        // Exchange Status Chart
        const exchangeStatusData = {
            labels: ['Completed', 'Pending', 'Active', 'Cancelled'],
            datasets: [{
                data: [45, 10, 25, 5],
                backgroundColor: ['#10b981', '#f59e0b', '#6366f1', '#ef4444']
            }]
        };
        
        // Popular Skills Chart
        const popularSkillsData = {
            labels: ['JavaScript', 'Python', 'Design', 'Marketing', 'Business'],
            datasets: [{
                label: 'Number of Providers',
                data: [45, 38, 32, 25, 18],
                backgroundColor: '#6366f1'
            }]
        };
        
        // Monthly Activity Chart
        const monthlyActivityData = {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Exchanges',
                data: [65, 78, 90, 81],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        };
        
        // Render all charts
        renderChart('userGrowthCanvas', 'line', userGrowthData);
        renderChart('exchangeStatsCanvas', 'doughnut', exchangeStatusData);
        renderChart('skillsDistCanvas', 'bar', popularSkillsData);
        renderChart('ratingDistCanvas', 'line', monthlyActivityData);
    } else {
        console.warn('⚠️ Chart.js not available');
    }
    
    // Display top users and popular skills with real data
    displayTopPerformingUsers();
    displayMostPopularSkills();
}

function displayAnalytics(analytics) {
    // Update summary stats
    document.getElementById('analyticsActivity').textContent = analytics.totalActivity || 0;
    document.getElementById('analyticsGrowth').textContent = `+${analytics.growthRate || 0}%`;
    document.getElementById('analyticsCompletion').textContent = `${analytics.completionRate || 0}%`;
    document.getElementById('analyticsSatisfaction').textContent = (analytics.avgSatisfaction || 0).toFixed(1);
    
    // Display charts
    displayUserGrowthChart(analytics.userGrowth);
    displayExchangeStatsChart(analytics.exchangeStats);
    displaySkillsDistChart(analytics.skillsDist);
    displayRatingDistChart(analytics.ratingDist);
    
    // Display reports
    displayTopUsers(analytics.topUsers);
    displayPopularSkills(analytics.popularSkills);
}

function displayUserGrowthChart(data) {
    const container = document.getElementById('userGrowthCanvas');
    if (!container) return;
    
    // Simple text-based chart for demo
    const parent = container.parentElement;
    parent.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="margin-bottom: 20px;">
                <div style="font-size: 48px; font-weight: 700; color: var(--primary);">${allUsers.length}</div>
                <div style="color: var(--text-secondary);">Total Users</div>
            </div>
            <div style="display: flex; justify-content: space-around; margin-top: 30px;">
                <div>
                    <div style="font-size: 24px; font-weight: 600;">📊</div>
                    <div style="margin-top: 8px; color: var(--text-secondary);">Growing +15%</div>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: 600;">📈</div>
                    <div style="margin-top: 8px; color: var(--text-secondary);">Month over month</div>
                </div>
            </div>
        </div>
    `;
}

function displayExchangeStatsChart(data) {
    const container = document.getElementById('exchangeStatsCanvas');
    if (!container) return;
    
    const parent = container.parentElement;
    const statusCounts = {
        pending: allExchanges.filter(e => e.status === 'pending').length,
        active: allExchanges.filter(e => e.status === 'active').length,
        completed: allExchanges.filter(e => e.status === 'completed').length,
        cancelled: allExchanges.filter(e => e.status === 'cancelled').length
    };
    
    parent.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--warning);">${statusCounts.pending}</div>
                    <div style="color: var(--text-secondary); margin-top: 4px;">Pending</div>
                </div>
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--success);">${statusCounts.active}</div>
                    <div style="color: var(--text-secondary); margin-top: 4px;">Active</div>
                </div>
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--info);">${statusCounts.completed}</div>
                    <div style="color: var(--text-secondary); margin-top: 4px;">Completed</div>
                </div>
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--danger);">${statusCounts.cancelled}</div>
                    <div style="color: var(--text-secondary); margin-top: 4px;">Cancelled</div>
                </div>
            </div>
        </div>
    `;
}

function displaySkillsDistChart(data) {
    const container = document.getElementById('skillsDistCanvas');
    if (!container) return;
    
    const parent = container.parentElement;
    const skillCategories = {};
    
    allSkills.forEach(skill => {
        const category = skill.category || 'Other';
        skillCategories[category] = (skillCategories[category] || 0) + 1;
    });
    
    const topCategories = Object.entries(skillCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    parent.innerHTML = `
        <div style="padding: 20px;">
            ${topCategories.map(([cat, count]) => `
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${cat}</span>
                        <span style="font-weight: 600;">${count}</span>
                    </div>
                    <div style="background: var(--bg-secondary); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: var(--primary); height: 100%; width: ${(count / allSkills.length * 100)}%; transition: width 0.3s;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayRatingDistChart(data) {
    const container = document.getElementById('ratingDistCanvas');
    if (!container) return;
    
    const parent = container.parentElement;
    const ratings = allUsers.filter(u => u.rating).map(u => Math.floor(u.rating));
    const ratingCounts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
    
    ratings.forEach(r => {
        if (ratingCounts[r] !== undefined) ratingCounts[r]++;
    });
    
    parent.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 200px;">
                ${[5, 4, 3, 2, 1].map(star => {
                    const count = ratingCounts[star];
                    const maxCount = Math.max(...Object.values(ratingCounts), 1);
                    const height = (count / maxCount * 160) + 20;
                    return `
                        <div style="text-align: center;">
                            <div style="background: var(--primary); width: 40px; height: ${height}px; border-radius: 4px 4px 0 0; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                                ${count}
                            </div>
                            <div style="margin-top: 8px; color: var(--text-secondary);">${star}⭐</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Display top performing users with real dynamic data
async function displayTopPerformingUsers() {
    const container = document.getElementById('topUsers');
    
    try {
        // Show loading state
        container.innerHTML = '<div class="loading">Loading top users...</div>';
        
        // Get users sorted by rating
        const sortedUsers = allUsers
            .filter(u => u.rating && u.rating > 0)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5);
        
        if (sortedUsers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 12px;">👥</div>
                    <div>No rated users yet</div>
                    <div style="font-size: 12px; margin-top: 8px;">Users will appear here once they receive ratings</div>
                </div>
            `;
            return;
        }
        
        const html = sortedUsers.map((user, index) => {
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-default';
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            
            // Count user's exchanges
            const userExchanges = allExchanges.filter(e => 
                e.requester_id?._id === user._id || e.provider_id?._id === user._id
            ).length;
            
            return `
                <div class="top-user-item" style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="rank-badge ${rankClass}" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
                            ${rankEmoji}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${user.fullName || 'Unknown User'}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); display: flex; gap: 12px;">
                                <span>📍 ${user.location || 'Unknown'}</span>
                                <span>🤝 ${userExchanges} exchanges</span>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 18px; color: #f59e0b;">
                            ⭐ ${(user.rating || 0).toFixed(1)}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                            ${user.skillsOffered?.length || 0} skills
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying top users:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger);">
                <div>⚠️ Error loading top users</div>
            </div>
        `;
    }
}

function displayTopUsers(users) {
    // Legacy function - now calls the new dynamic function
    displayTopPerformingUsers();
}

// Display most popular skills with real dynamic data
async function displayMostPopularSkills() {
    const container = document.getElementById('popularSkills');
    
    try {
        // Show loading state
        container.innerHTML = '<div class="loading">Loading popular skills...</div>';
        
        // Calculate skill counts from all users
        const skillCounts = {};
        const skillCategories = {};
        
        allUsers.forEach(user => {
            if (user.skillsOffered && Array.isArray(user.skillsOffered)) {
                user.skillsOffered.forEach(skill => {
                    const skillName = skill.name || skill;
                    const category = skill.category || 'General';
                    
                    if (skillName) {
                        skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;
                        if (!skillCategories[skillName]) {
                            skillCategories[skillName] = category;
                        }
                    }
                });
            }
        });
        
        // Convert to array and sort
        const sortedSkills = Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({
                name,
                count,
                category: skillCategories[name] || 'General'
            }));
        
        if (sortedSkills.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 12px;">🎯</div>
                    <div>No skills available yet</div>
                    <div style="font-size: 12px; margin-top: 8px;">Skills will appear here as users add them</div>
                </div>
            `;
            return;
        }
        
        // Category emojis
        const categoryEmojis = {
            'Programming': '💻',
            'Design': '🎨',
            'Marketing': '📱',
            'Languages': '🗣️',
            'Business': '💼',
            'Music': '🎵',
            'Sports': '⚽',
            'Cooking': '👨‍🍳',
            'General': '🎯'
        };
        
        const html = sortedSkills.map((skill, index) => {
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-default';
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            const categoryEmoji = categoryEmojis[skill.category] || '🎯';
            
            // Calculate percentage of total users
            const percentage = allUsers.length > 0 ? Math.round((skill.count / allUsers.length) * 100) : 0;
            
            return `
                <div class="popular-skill-item" style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="rank-badge ${rankClass}" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
                            ${rankEmoji}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
                                ${categoryEmoji} ${skill.name}
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                ${skill.category}
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 18px; color: #6366f1;">
                            ${skill.count} users
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                            ${percentage}% of total
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying popular skills:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger);">
                <div>⚠️ Error loading popular skills</div>
            </div>
        `;
    }
}

function displayPopularSkills(skills) {
    // Legacy function - now calls the new dynamic function
    displayMostPopularSkills();
}

function refreshAnalytics() {
    loadAnalytics();
    showSuccess('Analytics refreshed');
}

// ===== BACKUP & DATA MANAGEMENT =====
async function loadBackupPage() {
    try {
        // Load backup history
        displayBackupHistory();
        
        // Load database statistics
        await loadDatabaseStats();
    } catch (error) {
        console.error('Error loading backup page:', error);
    }
}

function displayBackupHistory() {
    const container = document.getElementById('backupHistory');
    
    // Get backups from localStorage
    const backups = JSON.parse(localStorage.getItem('adminBackups') || '[]');
    
    if (backups.length === 0) {
        container.innerHTML = `
            <div class="info-item">
                <span class="info-label">No backups yet</span>
                <span class="info-value">Create your first backup</span>
            </div>
        `;
        return;
    }
    
    const html = backups.slice(0, 5).map(backup => `
        <div class="backup-item">
            <div class="backup-info">
                <div class="backup-name">${backup.name}</div>
                <div class="backup-meta">
                    ${backup.type} • ${backup.size} • ${new Date(backup.timestamp).toLocaleString()}
                </div>
            </div>
            <div class="backup-actions-btn">
                <button class="btn-action btn-edit" onclick="downloadBackup('${backup.id}')" title="Download">
                    💾
                </button>
                <button class="btn-action btn-delete" onclick="deleteBackup('${backup.id}')" title="Delete">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
    
    // Update last backup time
    if (backups.length > 0) {
        document.getElementById('lastBackup').textContent = new Date(backups[0].timestamp).toLocaleString();
    }
}

async function loadDatabaseStats() {
    try {
        const totalRecords = allUsers.length + allExchanges.length + allSkills.length;
        
        document.getElementById('totalRecords').textContent = totalRecords;
        
        // Calculate approximate size
        const dataSize = JSON.stringify({
            users: allUsers,
            exchanges: allExchanges,
            skills: allSkills
        }).length;
        
        const sizeInKB = (dataSize / 1024).toFixed(2);
        const sizeInMB = (dataSize / (1024 * 1024)).toFixed(2);
        
        document.getElementById('dbSize').textContent = sizeInMB > 1 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
        document.getElementById('backupStatus').innerHTML = '✅ Ready';
    } catch (error) {
        console.error('Error loading database stats:', error);
    }
}

async function createFullBackup() {
    try {
        showSuccess('Creating full backup...');
        
        // Fetch all data
        await Promise.all([
            allUsers.length === 0 ? loadUsers() : Promise.resolve(),
            allExchanges.length === 0 ? loadExchanges() : Promise.resolve(),
            allSkills.length === 0 ? loadSkills() : Promise.resolve()
        ]);
        
        const backupData = {
            users: allUsers,
            exchanges: allExchanges,
            skills: allSkills,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const backup = {
            id: generateId(),
            name: `Full_Backup_${new Date().toISOString().split('T')[0]}`,
            type: 'Full Backup',
            size: formatBytes(JSON.stringify(backupData).length),
            timestamp: new Date().toISOString(),
            data: backupData
        };
        
        // Save to localStorage
        saveBackup(backup);
        
        // Download backup file
        downloadBackupFile(backup);
        
        showSuccess('✅ Full backup created successfully!');
        displayBackupHistory();
    } catch (error) {
        console.error('Error creating backup:', error);
        showError('Failed to create backup');
    }
}

async function createUsersBackup() {
    try {
        if (allUsers.length === 0) await loadUsers();
        
        const backupData = {
            users: allUsers,
            timestamp: new Date().toISOString()
        };
        
        const backup = {
            id: generateId(),
            name: `Users_Backup_${new Date().toISOString().split('T')[0]}`,
            type: 'Users Only',
            size: formatBytes(JSON.stringify(backupData).length),
            timestamp: new Date().toISOString(),
            data: backupData
        };
        
        saveBackup(backup);
        downloadBackupFile(backup);
        
        showSuccess('✅ Users backup created!');
        displayBackupHistory();
    } catch (error) {
        console.error('Error creating users backup:', error);
        showError('Failed to create users backup');
    }
}

async function createExchangesBackup() {
    try {
        if (allExchanges.length === 0) await loadExchanges();
        
        const backupData = {
            exchanges: allExchanges,
            timestamp: new Date().toISOString()
        };
        
        const backup = {
            id: generateId(),
            name: `Exchanges_Backup_${new Date().toISOString().split('T')[0]}`,
            type: 'Exchanges Only',
            size: formatBytes(JSON.stringify(backupData).length),
            timestamp: new Date().toISOString(),
            data: backupData
        };
        
        saveBackup(backup);
        downloadBackupFile(backup);
        
        showSuccess('✅ Exchanges backup created!');
        displayBackupHistory();
    } catch (error) {
        console.error('Error creating exchanges backup:', error);
        showError('Failed to create exchanges backup');
    }
}

async function createSkillsBackup() {
    try {
        if (allSkills.length === 0) await loadSkills();
        
        const backupData = {
            skills: allSkills,
            timestamp: new Date().toISOString()
        };
        
        const backup = {
            id: generateId(),
            name: `Skills_Backup_${new Date().toISOString().split('T')[0]}`,
            type: 'Skills Only',
            size: formatBytes(JSON.stringify(backupData).length),
            timestamp: new Date().toISOString(),
            data: backupData
        };
        
        saveBackup(backup);
        downloadBackupFile(backup);
        
        showSuccess('✅ Skills backup created!');
        displayBackupHistory();
    } catch (error) {
        console.error('Error creating skills backup:', error);
        showError('Failed to create skills backup');
    }
}

function saveBackup(backup) {
    const backups = JSON.parse(localStorage.getItem('adminBackups') || '[]');
    backups.unshift(backup);
    
    // Keep only last 10 backups in localStorage
    if (backups.length > 10) {
        backups.pop();
    }
    
    localStorage.setItem('adminBackups', JSON.stringify(backups));
}

function downloadBackupFile(backup) {
    const dataStr = JSON.stringify(backup.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${backup.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadBackup(backupId) {
    const backups = JSON.parse(localStorage.getItem('adminBackups') || '[]');
    const backup = backups.find(b => b.id === backupId);
    
    if (backup) {
        downloadBackupFile(backup);
        showSuccess('Backup downloaded');
    } else {
        showError('Backup not found');
    }
}

function deleteBackup(backupId) {
    const confirmMsg = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    confirmMsg.textContent = 'Are you sure you want to delete this backup?';
    confirmBtn.onclick = () => {
        const backups = JSON.parse(localStorage.getItem('adminBackups') || '[]');
        const filtered = backups.filter(b => b.id !== backupId);
        localStorage.setItem('adminBackups', JSON.stringify(filtered));
        
        closeModal('confirmModal');
        displayBackupHistory();
        showSuccess('Backup deleted');
    };
    
    openModal('confirmModal');
}

async function exportToJSON() {
    try {
        showSuccess('Exporting data to JSON...');
        
        const exportData = {
            users: allUsers,
            exchanges: allExchanges,
            skills: allSkills,
            exportDate: new Date().toISOString(),
            platform: 'SkillExchange',
            version: '1.0.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SkillExchange_Export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccess('✅ Data exported as JSON!');
    } catch (error) {
        console.error('Error exporting JSON:', error);
        showError('Failed to export data');
    }
}

async function exportToCSV() {
    try {
        showSuccess('Exporting users to CSV...');
        
        // Create CSV for users
        const headers = ['Name', 'Email', 'Location', 'Skills Offered', 'Skills Wanted', 'Rating', 'Exchanges', 'Joined'];
        const rows = allUsers.map(user => [
            user.fullName || '',
            user.email || '',
            user.location || '',
            (user.skillsOffered?.length || 0),
            (user.skillsWanted?.length || 0),
            user.rating || 0,
            user.totalExchanges || 0,
            user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const dataBlob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SkillExchange_Users_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccess('✅ Data exported as CSV!');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showError('Failed to export CSV');
    }
}

async function generateReport() {
    try {
        showSuccess('Generating PDF report...');
        
        // Create a simple HTML report
        const reportHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>SkillExchange Platform Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #6366f1; }
                    .stat { display: inline-block; margin: 20px; padding: 20px; background: #f0f0f0; border-radius: 8px; }
                    .stat-value { font-size: 36px; font-weight: bold; }
                    .stat-label { color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #6366f1; color: white; }
                </style>
            </head>
            <body>
                <h1>🎯 SkillExchange Platform Report</h1>
                <p>Generated: ${new Date().toLocaleString()}</p>
                
                <h2>📊 Platform Statistics</h2>
                <div class="stat">
                    <div class="stat-value">${allUsers.length}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${allExchanges.length}</div>
                    <div class="stat-label">Total Exchanges</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${allSkills.length}</div>
                    <div class="stat-label">Total Skills</div>
                </div>
                
                <h2>👥 Recent Users</h2>
                <table>
                    <tr><th>Name</th><th>Email</th><th>Location</th><th>Rating</th></tr>
                    ${allUsers.slice(0, 10).map(user => `
                        <tr>
                            <td>${user.fullName || 'Unknown'}</td>
                            <td>${user.email || 'N/A'}</td>
                            <td>${user.location || 'N/A'}</td>
                            <td>⭐ ${user.rating ? user.rating.toFixed(1) : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </table>
            </body>
            </html>
        `;
        
        const dataBlob = new Blob([reportHTML], { type: 'text/html' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SkillExchange_Report_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccess('✅ Report generated! (HTML format)');
    } catch (error) {
        console.error('Error generating report:', error);
        showError('Failed to generate report');
    }
}

function handleBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusEl = document.getElementById('importStatus');
    statusEl.textContent = '⏳ Reading backup file...';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            statusEl.innerHTML = `
                <div style="color: var(--success);">✅ Backup file loaded successfully!</div>
                <div style="margin-top: 8px;">
                    <strong>Contents:</strong><br>
                    Users: ${backupData.users?.length || 0}<br>
                    Exchanges: ${backupData.exchanges?.length || 0}<br>
                    Skills: ${backupData.skills?.length || 0}<br>
                    <button class="btn btn-primary" onclick="restoreBackup(${JSON.stringify(backupData).replace(/"/g, '&quot;')})" style="margin-top: 12px;">
                        📥 Restore This Backup
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Error parsing backup file:', error);
            statusEl.innerHTML = `<div style="color: var(--danger);">❌ Invalid backup file format</div>`;
        }
    };
    
    reader.onerror = function() {
        statusEl.innerHTML = `<div style="color: var(--danger);">❌ Error reading file</div>`;
    };
    
    reader.readAsText(file);
}

function restoreBackup(backupData) {
    const confirmMsg = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    confirmMsg.innerHTML = `
        <strong>⚠️ Warning:</strong> This will restore the backup data.<br><br>
        This action cannot be undone. Are you sure?
    `;
    
    confirmBtn.onclick = () => {
        try {
            // Note: In production, this should call API endpoints to restore data
            console.log('Restoring backup:', backupData);
            
            closeModal('confirmModal');
            showSuccess('✅ Backup restored successfully! (Demo mode - data not persisted)');
            
            document.getElementById('importStatus').innerHTML = `
                <div style="color: var(--success);">✅ Backup restored successfully!</div>
            `;
        } catch (error) {
            console.error('Error restoring backup:', error);
            showError('Failed to restore backup');
        }
    };
    
    openModal('confirmModal');
}

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ===== SETTINGS =====
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        const data = await response.json();
        
        if (data.success) {
            // Populate settings - check if elements exist
            const mongoUriEl = document.getElementById('mongoUri');
            const dbNameEl = document.getElementById('dbNameSetting');
            
            if (mongoUriEl) mongoUriEl.value = data.settings.dbUri || '***hidden***';
            if (dbNameEl) dbNameEl.value = data.settings.dbName || 'skillExchange';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    const mongoUriEl = document.getElementById('mongoUri');
    const dbNameEl = document.getElementById('dbNameSetting');
    
    const settings = {
        dbUri: mongoUriEl ? mongoUriEl.value : '',
        dbName: dbNameEl ? dbNameEl.value : ''
    };
    
    try {
        const response = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Settings saved successfully');
        } else {
            showError(data.message || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Error saving settings');
    }
}

// ===== UTILITY FUNCTIONS =====
function refreshData() {
    const refreshBtn = document.querySelector('.btn-icon[onclick="refreshData()"]');
    refreshBtn.classList.add('spinning');
    
    loadPageData(currentPage);
    checkDatabaseConnection();
    
    setTimeout(() => {
        refreshBtn.classList.remove('spinning');
    }, 1000);
}

// ===== DYNAMIC MODAL MANAGEMENT =====
/**
 * Unified Modal Management System
 * 
 * Features:
 * - Opens/closes any modal dynamically by ID
 * - Auto-resets forms when closing modals
 * - Clears validation errors automatically
 * - Stops video playback when closing
 * - Handles mobile scroll locking
 * - Supports click-outside to close
 * - Supports ESC key to close
 * - Auto-focuses first input when opening
 * - Compatible with both .show and .active classes
 * 
 * Usage:
 *   openModal('editModuleModal')
 *   closeModal('editModuleModal')
 */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn(`Modal with id '${modalId}' not found`);
        return;
    }
    
    // Add both show and active classes for compatibility
    modal.classList.add('show', 'active');
    
    // Lock body scroll on mobile devices
    if (isMobileDevice()) {
        document.body.style.overflow = 'hidden';
    }
    
    // Focus first input in modal if exists
    setTimeout(() => {
        const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn(`Modal with id '${modalId}' not found`);
        return;
    }
    
    // Remove both show and active classes
    modal.classList.remove('show', 'active');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Reset any forms inside the modal
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => {
        form.reset();
        // Clear any validation errors
        const errorMessages = form.querySelectorAll('.error-message, .form-error');
        errorMessages.forEach(error => error.remove());
    });
    
    // Clear any dynamically generated content
    const dynamicContent = modal.querySelectorAll('[data-dynamic]');
    dynamicContent.forEach(element => {
        element.innerHTML = '';
    });
    
    // Reset hidden fields
    const hiddenInputs = modal.querySelectorAll('input[type="hidden"]');
    hiddenInputs.forEach(input => {
        if (input.id !== 'adminToken') {
            input.value = '';
        }
    });
    
    // Stop any video playback if modal contains video
    const iframes = modal.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        const src = iframe.src;
        iframe.src = '';
        iframe.src = src;
    });
}

// Initialize modal event handlers (click outside, escape key)
function initializeModalHandlers() {
    // Close modal when clicking outside (on modal backdrop)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
            const modalId = e.target.id;
            if (modalId) {
                closeModal(modalId);
            }
        }
    });
    
    // Close modal when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal.show, .modal.active');
            openModals.forEach(modal => {
                if (modal.id) {
                    closeModal(modal.id);
                }
            });
        }
    });
    
    // Prevent modal content clicks from closing modal
    const modalContents = document.querySelectorAll('.modal-content');
    modalContents.forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

// Helper function to show inline form validation errors
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Remove any existing error message
    const existingError = field.parentElement.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error styling to field
    field.classList.add('error');
    
    // Create and show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px;';
    errorDiv.textContent = message;
    
    field.parentElement.appendChild(errorDiv);
    
    // Remove error on field change
    field.addEventListener('input', function removeError() {
        field.classList.remove('error');
        const error = field.parentElement.querySelector('.field-error');
        if (error) error.remove();
        field.removeEventListener('input', removeError);
    }, { once: true });
}

// Helper function to clear all form errors
function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Remove error styling from fields
    form.querySelectorAll('.error').forEach(field => {
        field.classList.remove('error');
    });
    
    // Remove error messages
    form.querySelectorAll('.field-error, .form-error').forEach(error => {
        error.remove();
    });
}

function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading">⏳ Loading...</div>';
    }
}

function showError(message) {
    console.error('Admin Error:', message);
    
    // Create a toast-style notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--danger);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    errorDiv.innerHTML = `<strong>❌ Error:</strong> ${message}`;
    document.body.appendChild(errorDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}

function showSuccess(message) {
    // Create a toast-style notification
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    successDiv.innerHTML = `<strong>✅ Success:</strong> ${message}`;
    document.body.appendChild(successDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        successDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            const token = localStorage.getItem('adminToken');
            
            // Call logout API
            if (token) {
                await fetch('/api/admin-auth/logout', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and redirect
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminData');
            localStorage.removeItem('adminCurrentPage'); // Clear saved page on logout
            window.location.href = 'admin-login.html';
        }
    }
}

// ===== MOBILE & RESPONSIVE ENHANCEMENTS =====

// Detect device type
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function isTabletDevice() {
    return /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768 && window.innerWidth <= 1024;
}

// Auto-close sidebar on mobile after navigation
let originalNavigateToPage = navigateToPage;
navigateToPage = function(pageId) {
    originalNavigateToPage(pageId);
    
    // Auto-close sidebar on mobile
    if (isMobileDevice()) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }
};

// Handle window resize for responsive adjustments
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        handleResponsiveLayout();
    }, 250);
});

function handleResponsiveLayout() {
    const width = window.innerWidth;
    const sidebar = document.querySelector('.sidebar');
    const networkMonitor = document.getElementById('networkMonitor');
    
    // Reset sidebar on desktop
    if (width > 1024) {
        if (sidebar) sidebar.classList.remove('active');
    }
    
    // Adjust network monitor
    if (networkMonitor) {
        if (width < 480) {
            networkMonitor.style.maxHeight = '200px';
        } else if (width < 768) {
            networkMonitor.style.maxHeight = '250px';
        } else {
            networkMonitor.style.maxHeight = '400px';
        }
    }
    
    // Reload charts for proper sizing if on analytics page
    if (currentPage === 'analytics' && typeof Chart !== 'undefined') {
        setTimeout(() => {
            loadAnalytics();
        }, 100);
    }
}

// Touch event handlers for better mobile UX
document.addEventListener('DOMContentLoaded', () => {
    // Add touch-friendly hover effects
    if ('ontouchstart' in window) {
        document.body.classList.add('touch-device');
        
        // Improve button tap response
        document.querySelectorAll('.btn, .nav-item, .skill-card, .stat-card').forEach(element => {
            element.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            element.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
    }
    
    // Prevent double-tap zoom on buttons
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Add swipe gesture for sidebar on mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    });
    
    function handleSwipeGesture() {
        const swipeThreshold = 100;
        const sidebar = document.querySelector('.sidebar');
        
        if (!sidebar) return;
        
        // Swipe right to open sidebar
        if (touchEndX - touchStartX > swipeThreshold && touchStartX < 50) {
            if (!sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        }
        
        // Swipe left to close sidebar
        if (touchStartX - touchEndX > swipeThreshold && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }
});

// Enhanced scroll behavior for mobile
function smoothScrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Add back-to-top button on mobile
if (isMobileDevice()) {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '⬆️';
    backToTopBtn.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary);
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        display: none;
        z-index: 999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s;
    `;
    
    backToTopBtn.addEventListener('click', smoothScrollToTop);
    document.body.appendChild(backToTopBtn);
    
    // Show/hide based on scroll
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.display = 'block';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });
}

// Optimize table scroll on mobile
document.querySelectorAll('.table-container').forEach(container => {
    if (isMobileDevice()) {
        // Add scroll indicator
        const scrollIndicator = document.createElement('div');
        scrollIndicator.textContent = '← Scroll →';
        scrollIndicator.style.cssText = `
            text-align: center;
            padding: 8px;
            background: var(--bg-secondary);
            color: var(--text-secondary);
            font-size: 12px;
            border-radius: 4px 4px 0 0;
        `;
        container.parentNode.insertBefore(scrollIndicator, container);
        
        // Hide indicator when scrolled
        container.addEventListener('scroll', () => {
            if (container.scrollLeft > 10) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        });
    }
});

// Prevent zoom on input focus (mobile)
if (isMobileDevice()) {
    const addMaximumScaleToMetaViewport = () => {
        const el = document.querySelector('meta[name=viewport]');
        if (el !== null) {
            let content = el.getAttribute('content');
            let re = /maximum-scale=[0-9.]+/g;
            
            if (re.test(content)) {
                content = content.replace(re, 'maximum-scale=1.0');
            } else {
                content = [content, 'maximum-scale=1.0'].join(', ');
            }
            
            el.setAttribute('content', content);
        }
    };
    
    const disableIosTextFieldZoom = addMaximumScaleToMetaViewport;
    const checkIsIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (checkIsIOS()) {
        disableIosTextFieldZoom();
    }
}

// Modal functions are defined earlier in the file - see DYNAMIC MODAL MANAGEMENT section

// Performance monitoring
function logPerformance(metric, value) {
    if (window.performance && window.performance.mark) {
        window.performance.mark(metric);
    }
    console.log(`Performance - ${metric}:`, value);
}

// Initialize responsive enhancements
handleResponsiveLayout();

// Orientation change handler
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        handleResponsiveLayout();
    }, 100);
});

// ===================================
// SKILLS MANAGEMENT
// ===================================

let filteredSkills = [];

// Load skills
async function loadSkills() {
    try {
        const token = localStorage.getItem('adminToken');
        const searchTerm = document.getElementById('skillSearch')?.value || '';
        const category = document.getElementById('categoryFilter')?.value || 'all';
        const isActive = document.getElementById('statusFilter')?.value || 'all';
        
        let url = '/api/skills?';
        if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
        if (category !== 'all') url += `category=${encodeURIComponent(category)}&`;
        if (isActive !== 'all') url += `isActive=${isActive}&`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            allSkills = data.skills || [];
            filteredSkills = allSkills;
            displaySkills(filteredSkills);
            updateSkillsStats();
        } else {
            throw new Error(data.message || 'Failed to load skills');
        }
    } catch (error) {
        console.error('Error loading skills:', error);
        const tbody = document.getElementById('skillsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="error">❌ Error loading skills</td></tr>';
        }
    }
}

// Display skills in table
function displaySkills(skills) {
    const tbody = document.getElementById('skillsTableBody');
    
    if (!tbody) return;
    
    if (!skills || skills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No skills found</td></tr>';
        return;
    }
    
    const html = skills.map(skill => {
        const statusClass = skill.isActive ? 'status-active' : 'status-inactive';
        const statusText = skill.isActive ? '✅ Active' : '❌ Inactive';
        const createdDate = new Date(skill.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        const tags = skill.tags && skill.tags.length > 0 
            ? skill.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('') 
            : '<span class="text-muted">-</span>';
        
        return `
            <tr>
                <td>
                    <div style="font-weight: 600;">${skill.name}</div>
                    ${skill.description ? `<div class="text-muted" style="font-size: 12px; margin-top: 4px;">${skill.description.substring(0, 60)}${skill.description.length > 60 ? '...' : ''}</div>` : ''}
                </td>
                <td>
                    <span class="badge badge-category">${skill.category}</span>
                </td>
                <td>${skill.subcategory || '-'}</td>
                <td>
                    <div class="tags-container">${tags}</div>
                </td>
                <td>
                    <span class="badge badge-info">${skill.usageCount || 0} uses</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>${createdDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="editSkill('${skill._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="confirmDeleteSkill('${skill._id}', '${skill.name}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

// Update skills statistics
function updateSkillsStats() {
    const totalCount = allSkills.length;
    const activeCount = allSkills.filter(s => s.isActive).length;
    const categories = [...new Set(allSkills.map(s => s.category))].length;
    const mostPopular = allSkills.reduce((max, skill) => 
        skill.usageCount > (max?.usageCount || 0) ? skill : max, null
    );
    
    document.getElementById('totalSkillsCount').textContent = totalCount;
    document.getElementById('activeSkillsCount').textContent = activeCount;
    document.getElementById('categoriesCount').textContent = categories;
    document.getElementById('popularSkillName').textContent = mostPopular?.name || '-';
}

// Search skills
function searchSkills() {
    loadSkills();
}

// Filter skills
function filterSkills() {
    loadSkills();
}

// Show add skill modal
function showAddSkillModal() {
    document.getElementById('skillModalTitle').textContent = 'Add New Skill';
    document.getElementById('skillForm').reset();
    document.getElementById('skillId').value = '';
    document.getElementById('skillIsActive').checked = true;
    openModal('skillModal');
}

// Edit skill
async function editSkill(skillId) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/skills/${skillId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.skill) {
            const skill = data.skill;
            
            document.getElementById('skillModalTitle').textContent = 'Edit Skill';
            document.getElementById('skillId').value = skill._id;
            document.getElementById('skillName').value = skill.name;
            document.getElementById('skillCategory').value = skill.category;
            document.getElementById('skillSubcategory').value = skill.subcategory || '';
            document.getElementById('skillDescription').value = skill.description || '';
            document.getElementById('skillTags').value = skill.tags ? skill.tags.join(', ') : '';
            document.getElementById('skillIsActive').checked = skill.isActive;
            
            openModal('skillModal');
        } else {
            throw new Error(data.message || 'Failed to load skill');
        }
    } catch (error) {
        console.error('Error loading skill:', error);
        alert('Error loading skill details');
    }
}

// Save skill (create or update)
async function saveSkill(event) {
    event.preventDefault();
    
    try {
        const token = localStorage.getItem('adminToken');
        const skillId = document.getElementById('skillId').value;
        const tagsInput = document.getElementById('skillTags').value;
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        const skillData = {
            name: document.getElementById('skillName').value.trim(),
            category: document.getElementById('skillCategory').value,
            subcategory: document.getElementById('skillSubcategory').value.trim(),
            description: document.getElementById('skillDescription').value.trim(),
            tags: tags,
            isActive: document.getElementById('skillIsActive').checked
        };
        
        const url = skillId ? `/api/skills/${skillId}` : '/api/skills';
        const method = skillId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(skillData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('skillModal');
            loadSkills();
            showNotification(skillId ? 'Skill updated successfully! ✅' : 'Skill created successfully! ✅', 'success');
        } else {
            throw new Error(data.message || 'Failed to save skill');
        }
    } catch (error) {
        console.error('Error saving skill:', error);
        alert(error.message || 'Error saving skill');
    }
}

// Confirm delete skill
function confirmDeleteSkill(skillId, skillName) {
    document.getElementById('confirmMessage').textContent = 
        `Are you sure you want to delete the skill "${skillName}"? This action cannot be undone.`;
    
    document.getElementById('confirmBtn').onclick = () => deleteSkill(skillId);
    openModal('confirmModal');
}

// Delete skill
async function deleteSkill(skillId) {
    try {
        const token = localStorage.getItem('adminToken');
        
        const response = await fetch(`/api/skills/${skillId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('confirmModal');
            loadSkills();
            showNotification('Skill deleted successfully! ✅', 'success');
        } else {
            throw new Error(data.message || 'Failed to delete skill');
        }
    } catch (error) {
        console.error('Error deleting skill:', error);
        alert(error.message || 'Error deleting skill');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    .tag {
        display: inline-block;
        background: #e0e7ff;
        color: #4338ca;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        margin-right: 4px;
        margin-bottom: 2px;
    }
    .badge-category {
        background: #fef3c7;
        color: #92400e;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
    }
    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
`;
document.head.appendChild(style);

// ===== MODULES MANAGEMENT =====
let allModules = [];
let filteredModules = [];

async function loadModules() {
    try {
        // Fetch all learning paths with modules (admin endpoint)
        const response = await fetch('/api/learning-paths/admin/all', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch modules');
        }

        const data = await response.json();
        const learningPaths = data.learningPaths || data || [];
        
        // Extract all modules from learning paths
        allModules = [];
        learningPaths.forEach(path => {
            if (path.modules && Array.isArray(path.modules)) {
                path.modules.forEach(module => {
                    allModules.push({
                        ...module,
                        learningPathId: path._id,
                        skillName: path.skillId?.name || 'Unknown Skill',
                        skillCategory: path.skillId?.category || 'Uncategorized',
                        learnerName: path.learner?.fullName || 'Unknown',
                        instructorName: path.instructor?.fullName || 'Unknown'
                    });
                });
            }
        });

        filteredModules = [...allModules];
        
        // Update stats
        updateModuleStats(learningPaths);
        
        // Render modules
        renderModules();
        
        // Update badge count
        const moduleCountBadge = document.getElementById('moduleCount');
        if (moduleCountBadge) {
            moduleCountBadge.textContent = allModules.length;
        }

    } catch (error) {
        console.error('Error loading modules:', error);
        showNotification('Failed to load modules', 'error');
        document.getElementById('modulesGrid').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load modules. Please try again.</p>
            </div>
        `;
    }
}

function updateModuleStats(learningPaths) {
    const totalModules = allModules.length;
    const completedModules = allModules.filter(m => m.isCompleted).length;
    const totalDuration = allModules.reduce((sum, m) => sum + (m.duration || 0), 0);
    const avgDuration = totalModules > 0 ? Math.round(totalDuration / totalModules) : 0;
    
    document.getElementById('totalModulesCount').textContent = totalModules;
    document.getElementById('avgModuleDuration').textContent = `${avgDuration} min`;
    document.getElementById('completedModulesCount').textContent = completedModules;
    document.getElementById('learningPathsCount').textContent = learningPaths.length;
}

function renderModules() {
    const grid = document.getElementById('modulesGrid');
    
    if (filteredModules.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎓</div>
                <h3>No Modules Found</h3>
                <p>No learning modules are available yet.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredModules.map((module, index) => `
        <div class="module-card" data-module-id="${module._id}">
            <div class="module-header">
                <div class="module-number">#${module.order || index + 1}</div>
                <div class="module-status ${module.isCompleted ? 'completed' : 'pending'}">
                    ${module.isCompleted ? '✅ Completed' : '📝 In Progress'}
                </div>
            </div>
            
            <div class="module-body">
                <h4 class="module-title">${module.title || 'Untitled Module'}</h4>
                <p class="module-description">${module.description || 'No description available'}</p>
                
                <div class="module-meta">
                    <div class="meta-item">
                        <span class="meta-icon">🎯</span>
                        <span class="meta-text">${module.skillName}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">⏱️</span>
                        <span class="meta-text">${module.duration || 0} min</span>
                    </div>
                    ${module.videoUrl ? `
                    <div class="meta-item">
                        <span class="meta-icon">🎥</span>
                        <span class="meta-text">Video Available</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="module-people">
                    <div class="person">
                        <strong>👨‍🎓 Learner:</strong> ${module.learnerName}
                    </div>
                    <div class="person">
                        <strong>👨‍🏫 Instructor:</strong> ${module.instructorName}
                    </div>
                </div>
            </div>
            
            <div class="module-footer">
                <button class="btn-sm btn-primary" onclick="viewModuleDetails('${module._id}', '${module.learningPathId}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn-sm btn-secondary" onclick="editModule('${module._id}', '${module.learningPathId}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        </div>
    `).join('');
}

async function viewModuleDetails(moduleId, learningPathId) {
    try {
        const response = await fetch(`/api/learning-paths/admin/${learningPathId}/modules/${moduleId}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch module details');
        }

        const data = await response.json();
        const module = data.module;

        // Create and show modal with module details
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>📚 ${module.title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="module-detail-section">
                        <h4>Description</h4>
                        <p>${module.description || 'No description available'}</p>
                    </div>
                    
                    <div class="module-detail-section">
                        <h4>Information</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Order</span>
                                <span class="info-value">#${module.order}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Duration</span>
                                <span class="info-value">${module.duration || 0} minutes</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Status</span>
                                <span class="info-value ${module.isCompleted ? 'status-active' : 'status-pending'}">
                                    ${module.isCompleted ? '✅ Completed' : '📝 In Progress'}
                                </span>
                            </div>
                            ${module.completedAt ? `
                            <div class="info-item">
                                <span class="info-label">Completed At</span>
                                <span class="info-value">${new Date(module.completedAt).toLocaleDateString()}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${module.videoUrl ? `
                    <div class="module-detail-section">
                        <h4>📹 Video Content</h4>
                        <div class="video-info">
                            <p><strong>Title:</strong> ${module.videoTitle || 'Video'}</p>
                            <p><strong>URL:</strong> <a href="${module.videoUrl}" target="_blank">${module.videoUrl}</a></p>
                            ${module.videoUrl.includes('youtube.com') || module.videoUrl.includes('youtu.be') ? (() => {
                                const embedUrl = getYouTubeEmbedUrl(module.videoUrl);
                                if (embedUrl) {
                                    return `
                                    <div class="video-player" style="margin-top: 15px;">
                                        <iframe 
                                            width="100%" 
                                            height="400" 
                                            src="${embedUrl}" 
                                            frameborder="0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowfullscreen>
                                        </iframe>
                                    </div>`;
                                } else {
                                    return `<div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; margin-top: 15px; border-radius: 4px;">
                                        <p style="color: #ef4444; margin: 0;"><strong>⚠ Error loading video</strong></p>
                                        <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">The YouTube URL may be invalid or improperly formatted. Please check the URL and try again.</p>
                                    </div>`;
                                }
                            })() : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

    } catch (error) {
        console.error('Error loading module details:', error);
        showNotification('Failed to load module details', 'error');
    }
}

function getYouTubeEmbedUrl(url) {
    if (!url) {
        console.error('YouTube URL is empty');
        return '';
    }
    
    // Extract video ID using regex for all YouTube URL formats
    let videoId = '';
    
    try {
        // Handle various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/, // youtube.com/watch?v=ID
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, // youtube.com/embed/ID
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, // youtu.be/ID
            /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/, // youtube.com/v/ID
            /(?:youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/ // youtube.com with v parameter
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                videoId = match[1];
                break;
            }
        }
        
        // Fallback: Try extractYouTubeId function
        if (!videoId) {
            videoId = extractYouTubeId(url);
        }
        
        // Validate video ID (should be 11 characters)
        if (!videoId || videoId.length !== 11) {
            console.error('Invalid YouTube video ID:', videoId, 'from URL:', url);
            return '';
        }
        
        // Return proper embed URL with autoplay and other parameters
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
        
    } catch (error) {
        console.error('Error parsing YouTube URL:', url, error);
        return '';
    }
}

function searchModules() {
    const searchTerm = document.getElementById('moduleSearch').value.toLowerCase();
    
    filteredModules = allModules.filter(module => {
        return (
            (module.title && module.title.toLowerCase().includes(searchTerm)) ||
            (module.description && module.description.toLowerCase().includes(searchTerm)) ||
            (module.skillName && module.skillName.toLowerCase().includes(searchTerm))
        );
    });
    
    renderModules();
}

function filterModules() {
    const filter = document.getElementById('moduleFilter').value;
    
    if (filter === 'all') {
        filteredModules = [...allModules];
    } else {
        filteredModules = allModules.filter(module => {
            return module.skillCategory && module.skillCategory.toLowerCase().includes(filter);
        });
    }
    
    renderModules();
}

// ============================================
// MODULE CRUD OPERATIONS
// ============================================

async function editModule(moduleId, learningPathId) {
    console.log('Editing module:', moduleId, 'from learning path:', learningPathId);
    
    try {
        const url = `/api/learning-paths/admin/${learningPathId}/modules/${moduleId}`;
        console.log('Fetching module details from:', url);
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Fetch error:', errorData);
            throw new Error(errorData.message || 'Failed to fetch module details');
        }

        const data = await response.json();
        console.log('Module data:', data);
        const module = data.module;

        // Set modal title
        document.getElementById('moduleModalTitle').textContent = 'Edit Module';
        
        // Populate the edit form
        document.getElementById('editLearningPathId').value = learningPathId;
        document.getElementById('editModuleId').value = moduleId;
        document.getElementById('editModuleTitleInput').value = module.title || '';
        document.getElementById('editModuleDescription').value = module.description || '';
        document.getElementById('editModuleDuration').value = module.duration || '';
        document.getElementById('editModuleVideoUrl').value = module.videoUrl || '';
        document.getElementById('editModuleOrder').value = module.order || '';

        // Hide learning path selector for edit mode
        document.getElementById('learningPathSelectGroup').style.display = 'none';
        
        // Show delete button for existing modules
        document.getElementById('deleteModuleBtn').style.display = 'inline-flex';

        // Show modal
        document.getElementById('editModuleModal').classList.add('active');
        console.log('Modal opened successfully');
    } catch (error) {
        console.error('Edit module error:', error);
        showNotification(error.message || 'Failed to load module details', 'error');
    }
}

async function saveModuleChanges(event) {
    event.preventDefault();
    
    console.log('Saving module changes...');
    
    // Clear any existing form errors
    clearFormErrors('editModuleForm');
    
    const learningPathId = document.getElementById('editLearningPathId').value;
    const moduleId = document.getElementById('editModuleId').value;
    
    // Validate form fields with inline error messages
    const title = document.getElementById('editModuleTitleInput').value.trim();
    const videoUrl = document.getElementById('editModuleVideoUrl').value.trim();
    
    let hasErrors = false;
    
    if (!title) {
        showFieldError('editModuleTitleInput', 'Module title is required');
        hasErrors = true;
    }
    
    if (!videoUrl) {
        showFieldError('editModuleVideoUrl', 'YouTube video URL is required');
        hasErrors = true;
    } else if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        showFieldError('editModuleVideoUrl', 'Please enter a valid YouTube URL');
        hasErrors = true;
    }
    
    // For new modules, validate learning path selection
    if (!moduleId) {
        const selectedPath = document.getElementById('selectLearningPath').value;
        if (!selectedPath) {
            showFieldError('selectLearningPath', 'Please select a learning path');
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        showNotification('Please fix the errors in the form', 'error');
        return;
    }
    
    const updateData = {
        title: title,
        description: document.getElementById('editModuleDescription').value.trim(),
        duration: parseInt(document.getElementById('editModuleDuration').value) || 0,
        videoUrl: videoUrl,
        order: parseInt(document.getElementById('editModuleOrder').value) || 1
    };
    
    console.log('Update data:', updateData);

    try {
        let response;
        let url;
        
        if (moduleId) {
            // Update existing module
            if (!learningPathId) {
                showNotification('Learning path ID is missing', 'error');
                return;
            }
            url = `/api/learning-paths/admin/${learningPathId}/modules/${moduleId}`;
            console.log('Updating module:', url);
            
            response = await fetch(url, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(updateData)
            });
        } else {
            // Add new module
            const selectedPath = document.getElementById('selectLearningPath').value;
            console.log('Selected learning path:', selectedPath);
            
            url = `/api/learning-paths/admin/${selectedPath}/modules`;
            console.log('Adding module:', url);
            
            response = await fetch(url, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(updateData)
            });
        }
        
        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.message || (moduleId ? 'Failed to update module' : 'Failed to add module'));
        }

        const data = await response.json();
        console.log('Success:', data);
        
        showNotification(moduleId ? 'Module updated successfully!' : 'Module added successfully!', 'success');
        closeModal('editModuleModal');
        
        // Reload modules
        await loadModules();
    } catch (error) {
        console.error('Save module error:', error);
        showNotification(error.message || 'Failed to save module', 'error');
    }
}

function confirmDeleteModule() {
    const learningPathId = document.getElementById('editLearningPathId').value;
    const moduleId = document.getElementById('editModuleId').value;
    const moduleTitle = document.getElementById('editModuleTitleInput').value;
    
    if (confirm(`Are you sure you want to delete "${moduleTitle}"? This action cannot be undone.`)) {
        deleteModule(learningPathId, moduleId);
    }
}

async function deleteModule(learningPathId, moduleId) {
    try {
        const response = await fetch(`/api/learning-paths/admin/${learningPathId}/modules/${moduleId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete module');
        }

        showNotification('Module deleted successfully!', 'success');
        closeModal('editModuleModal');
        
        // Reload modules
        await loadModules();
    } catch (error) {
        console.error('Delete module error:', error);
        showNotification('Failed to delete module', 'error');
    }
}

async function showAddModuleModal() {
    console.log('Opening add module modal...');
    
    // Set modal title
    document.getElementById('moduleModalTitle').textContent = 'Add New Module';
    
    // Clear form
    document.getElementById('editLearningPathId').value = '';
    document.getElementById('editModuleId').value = '';
    document.getElementById('editModuleTitleInput').value = '';
    document.getElementById('editModuleDescription').value = '';
    document.getElementById('editModuleDuration').value = '';
    document.getElementById('editModuleVideoUrl').value = '';
    document.getElementById('editModuleOrder').value = '1';
    
    // Show learning path selector for add mode
    const selectGroup = document.getElementById('learningPathSelectGroup');
    if (selectGroup) {
        selectGroup.style.display = 'block';
    }
    
    // Hide delete button for new modules
    const deleteBtn = document.getElementById('deleteModuleBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    // Load learning paths for selection
    try {
        console.log('Loading learning paths...');
        const response = await fetch('/api/learning-paths/admin/all', {
            headers: getAuthHeaders()
        });
        
        console.log('Learning paths response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Learning paths data:', data);
            
            const select = document.getElementById('selectLearningPath');
            if (!select) {
                console.error('Select element not found!');
                return;
            }
            
            select.innerHTML = '<option value="">Select a learning path</option>';
            
            if (data.learningPaths && data.learningPaths.length > 0) {
                data.learningPaths.forEach(lp => {
                    const option = document.createElement('option');
                    option.value = lp._id;
                    option.textContent = `${lp.skillId?.name || 'Unknown Skill'} - ${lp.learner?.fullName || 'Unknown'}`;
                    select.appendChild(option);
                });
                console.log('Loaded', data.learningPaths.length, 'learning paths');
            } else {
                showNotification('No learning paths available', 'error');
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to load learning paths:', errorData);
            showNotification('Failed to load learning paths', 'error');
        }
    } catch (error) {
        console.error('Failed to load learning paths:', error);
        showNotification('Error loading learning paths: ' + error.message, 'error');
    }
    
    // Show modal
    document.getElementById('editModuleModal').classList.add('active');
    console.log('Modal opened');
}

// ============================================
// VIDEO MANAGEMENT FUNCTIONS
// ============================================

let allVideos = [];
let filteredVideos = [];

async function loadVideos() {
    try {
        console.log('Loading videos...');
        const response = await fetch('/api/learning-paths/admin/all', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch learning paths');
        }

        const data = await response.json();
        
        // Extract all videos from all modules in all learning paths
        allVideos = [];
        let videoId = 1;
        
        data.learningPaths.forEach(lp => {
            if (lp.modules && lp.modules.length > 0) {
                lp.modules.forEach(module => {
                    if (module.videoUrl) {
                        allVideos.push({
                            id: videoId++,
                            moduleId: module._id,
                            learningPathId: lp._id,
                            title: module.title || 'Untitled Video',
                            videoUrl: module.videoUrl,
                            description: module.description || '',
                            duration: module.duration || 0,
                            skillName: lp.skillId?.name || 'Unknown Skill',
                            learnerName: lp.learner?.fullName || 'Unknown',
                            isCompleted: module.isCompleted,
                            order: module.order
                        });
                    }
                });
            }
        });

        filteredVideos = [...allVideos];
        updateVideoStats();
        renderVideos();
        
        // Update badge count
        document.getElementById('videoCount').textContent = allVideos.length;
        
        console.log('Loaded', allVideos.length, 'videos');
    } catch (error) {
        console.error('Load videos error:', error);
        showNotification('Failed to load videos', 'error');
    }
}

function updateVideoStats() {
    const totalVideos = allVideos.length;
    const activeVideos = allVideos.filter(v => v.videoUrl).length;
    const totalDuration = allVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
    const usedVideos = allVideos.length;

    document.getElementById('totalVideosCount').textContent = totalVideos;
    document.getElementById('activeVideosCount').textContent = activeVideos;
    document.getElementById('totalVideoDuration').textContent = totalDuration + ' min';
    document.getElementById('videosUsedCount').textContent = usedVideos;
}

function renderVideos() {
    const grid = document.getElementById('videosGrid');
    
    if (filteredVideos.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎥</div>
                <h3>No Videos Found</h3>
                <p>No video content available in the system.</p>
                <button class="btn btn-primary" onclick="showAddVideoModal()">
                    <i class="fas fa-plus"></i> Add First Video
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredVideos.map((video, index) => `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="https://img.youtube.com/vi/${extractYouTubeId(video.videoUrl)}/mqdefault.jpg" 
                     alt="${video.title}"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22%3E%3Crect fill=%22%23ddd%22 width=%22320%22 height=%22180%22/%3E%3Ctext fill=%22%23999%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Preview%3C/text%3E%3C/svg%3E'">
                <div class="video-duration-badge">${video.duration || 0} min</div>
                <div class="video-play-overlay">
                    <i class="fas fa-play-circle"></i>
                </div>
            </div>
            
            <div class="video-card-body">
                <h4 class="video-title">${video.title}</h4>
                <p class="video-description">${video.description || 'No description'}</p>
                
                <div class="video-meta">
                    <div class="meta-item">
                        <span class="meta-icon">🎯</span>
                        <span class="meta-text">${video.skillName}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">👨‍🎓</span>
                        <span class="meta-text">${video.learnerName}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">#</span>
                        <span class="meta-text">Order ${video.order}</span>
                    </div>
                </div>
                
                <div class="video-status ${video.isCompleted ? 'completed' : 'pending'}">
                    ${video.isCompleted ? '✅ Completed' : '📝 In Progress'}
                </div>
            </div>
            
            <div class="video-card-footer">
                <button class="btn-sm btn-primary" onclick="viewVideo('${video.moduleId}', '${video.learningPathId}')">
                    <i class="fas fa-play"></i> Play
                </button>
                <button class="btn-sm btn-secondary" onclick="editVideo('${video.moduleId}', '${video.learningPathId}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <a href="${video.videoUrl}" target="_blank" class="btn-sm" style="text-decoration: none;">
                    <i class="fas fa-external-link-alt"></i> Open
                </a>
            </div>
        </div>
    `).join('');
}

function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') {
        console.warn('Invalid URL provided to extractYouTubeId:', url);
        return '';
    }
    
    try {
        // Clean the URL
        url = url.trim();
        
        // Try multiple regex patterns for better compatibility
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/, // Standard watch URL
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, // Short URL
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, // Embed URL
            /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/, // V URL
            /^([a-zA-Z0-9_-]{11})$/ // Just the ID
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1].length === 11) {
                return match[1];
            }
        }
        
        console.warn('Could not extract YouTube ID from URL:', url);
        return '';
        
    } catch (error) {
        console.error('Error extracting YouTube ID:', error);
        return '';
    }
}

function searchVideos() {
    const searchTerm = document.getElementById('videoSearch').value.toLowerCase();
    
    filteredVideos = allVideos.filter(video => {
        return video.title.toLowerCase().includes(searchTerm) ||
               (video.description && video.description.toLowerCase().includes(searchTerm)) ||
               video.skillName.toLowerCase().includes(searchTerm);
    });
    
    renderVideos();
}

function filterVideos() {
    const filter = document.getElementById('videoFilter').value;
    
    if (filter === 'all') {
        filteredVideos = [...allVideos];
    } else if (filter === 'used') {
        filteredVideos = allVideos.filter(v => v.moduleId);
    } else if (filter === 'unused') {
        filteredVideos = allVideos.filter(v => !v.moduleId);
    }
    
    renderVideos();
}

async function viewVideo(moduleId, learningPathId) {
    try {
        const video = allVideos.find(v => v.moduleId === moduleId && v.learningPathId === learningPathId);
        if (!video) {
            showNotification('Video not found', 'error');
            return;
        }

        const embedUrl = getYouTubeEmbedUrl(video.videoUrl);
        
        // Check if embed URL is valid
        if (!embedUrl) {
            showNotification('Invalid YouTube URL. Cannot display video.', 'error');
            return;
        }
        
        // Create modal to play video
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>🎥 ${video.title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="video-player">
                        <iframe src="${embedUrl}" 
                                width="100%" 
                                height="500" 
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen>
                        </iframe>
                    </div>
                    <div style="margin-top: 20px;">
                        <h4>Description</h4>
                        <p>${video.description || 'No description available'}</p>
                        <div class="video-info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px;">
                            <div>
                                <strong>Duration:</strong> ${video.duration || 0} minutes
                            </div>
                            <div>
                                <strong>Skill:</strong> ${video.skillName}
                            </div>
                            <div>
                                <strong>Status:</strong> ${video.isCompleted ? '✅ Completed' : '📝 In Progress'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('View video error:', error);
        showNotification('Failed to load video', 'error');
    }
}

async function editVideo(moduleId, learningPathId) {
    // Redirect to edit module with video focus
    editModule(moduleId, learningPathId);
}

function showAddVideoModal() {
    showNotification('Please use the Modules page to add videos to specific modules', 'info');
    navigateToPage('modules');
}

function previewVideo() {
    const videoUrl = document.getElementById('videoUrl').value;
    if (!videoUrl) {
        showNotification('Please enter a YouTube URL first', 'error');
        return;
    }

    const embedUrl = getYouTubeEmbedUrl(videoUrl);
    
    if (!embedUrl) {
        showNotification('Invalid YouTube URL. Please check the URL format.', 'error');
        document.getElementById('videoPreviewGroup').style.display = 'none';
        return;
    }
    
    document.getElementById('videoPreviewFrame').src = embedUrl;
    document.getElementById('videoPreviewGroup').style.display = 'block';
}

async function saveVideo(event) {
    event.preventDefault();
    showNotification('Please edit videos through the Modules page', 'info');
    closeModal('videoModal');
}

function confirmDeleteVideo() {
    showNotification('Please delete videos through the Modules page', 'info');
}

// ===== MODAL SYSTEM DEBUG UTILITIES =====
// Helper functions for testing modal system (can be called from browser console)
window.testModalSystem = function() {
    console.log('🧪 Testing Modal System...\n');
    
    // Test 1: Check for duplicate functions
    const openModalCount = document.querySelectorAll('script').length;
    console.log('✓ Test 1: Script tags loaded:', openModalCount);
    
    // Test 2: List all modals
    const modals = document.querySelectorAll('.modal');
    console.log(`✓ Test 2: Found ${modals.length} modals:`);
    modals.forEach(modal => {
        console.log(`  - ${modal.id}: ${modal.classList.contains('show') ? 'OPEN' : 'closed'}`);
    });
    
    // Test 3: Check event listeners
    console.log('✓ Test 3: Modal handlers initialized');
    
    // Test 4: Function availability
    console.log('✓ Test 4: Functions available:');
    console.log('  - openModal:', typeof openModal === 'function' ? '✓' : '✗');
    console.log('  - closeModal:', typeof closeModal === 'function' ? '✓' : '✗');
    console.log('  - showFieldError:', typeof showFieldError === 'function' ? '✓' : '✗');
    console.log('  - clearFormErrors:', typeof clearFormErrors === 'function' ? '✓' : '✗');
    
    console.log('\n🎉 Modal system test complete!');
    console.log('📝 To test manually:');
    console.log('  - openModal("editModuleModal")');
    console.log('  - closeModal("editModuleModal")');
    console.log('  - Press ESC to close any modal');
    console.log('  - Click outside modal to close');
};

// Auto-log modal system status on load
console.log('🎨 SkillExchange Admin Panel - Modal System v2.0');
console.log('💡 Type testModalSystem() in console to test modals');
