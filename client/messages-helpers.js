// ============================================
// MESSAGING HELPER FUNCTIONS
// WhatsApp-Inspired Modern Features
// ============================================

// Back to conversations list (mobile)
function backToConversationsList() {
  const messagesSidebar = document.querySelector('.messages-sidebar');
  const messagesMain = document.querySelector('.messages-main');
  if (messagesSidebar) messagesSidebar.classList.remove('hidden');
  if (messagesMain) messagesMain.classList.remove('active');
}

// View user profile
function viewUserProfile() {
  if (AppState.activeConversation) {
    const otherUser = AppState.activeConversation.participants.find(p => p._id !== AppState.currentUser._id);
    if (otherUser && otherUser._id) {
      // Navigate to user profile or show modal
      showPage('profilePage');
      // You can implement showUserProfile(otherUser._id) here
      console.log('View profile:', otherUser._id);
    }
  }
}

// Toggle chat search
function toggleChatSearch() {
  console.log('Toggle chat search');
  // Implement search in chat functionality
  showNotification('Search feature coming soon', 'info');
}

// Toggle chat menu
function toggleChatMenu() {
  console.log('Toggle chat menu');
  // Implement chat options menu
  showNotification('Menu options coming soon', 'info');
}

// Show new conversation modal
async function showNewConversationModal() {
  // Navigate to marketplace or exchanges page where users can start conversations
  showNotification('Visit the Marketplace or My Exchanges to start chatting with skill partners', 'info');
  
  // Optionally navigate to marketplace after a delay
  setTimeout(() => {
    if (typeof showPage === 'function') {
      showPage('marketplace');
    }
  }, 1500);
}

// Toggle emoji picker
function toggleEmojiPicker() {
  console.log('Toggle emoji picker');
  // Implement emoji picker functionality
  const commonEmojis = ['😊', '👍', '❤️', '😂', '🎉', '👏', '🔥', '💯'];
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    // For now, just show a simple emoji menu
    const emoji = prompt('Choose emoji:\n' + commonEmojis.join(' '));
    if (emoji) {
      messageInput.value += emoji;
      messageInput.focus();
    }
  }
}

// Format message time (relative)
function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  
  const now = Date.now();
  const msgTime = new Date(timestamp).getTime();
  const diff = now - msgTime;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}

// Search conversations
function initConversationSearch() {
  const searchInput = document.getElementById('conversationSearch');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    const conversations = document.querySelectorAll('.conversation-item');
    
    conversations.forEach(conv => {
      const userName = conv.querySelector('.conversation-name')?.textContent?.toLowerCase() || '';
      const preview = conv.querySelector('.conversation-preview')?.textContent?.toLowerCase() || '';
      const skill = conv.querySelector('.conversation-skill')?.textContent?.toLowerCase() || '';
      
      const matches = userName.includes(searchTerm) || 
                     preview.includes(searchTerm) || 
                     skill.includes(searchTerm);
      
      conv.style.display = matches ? 'flex' : 'none';
    });
    
    // Show "no results" message if needed
    const visibleConvs = Array.from(conversations).filter(c => c.style.display !== 'none');
    const conversationsList = document.getElementById('conversationsList');
    
    if (searchTerm && visibleConvs.length === 0 && conversationsList) {
      const existingMsg = conversationsList.querySelector('.no-results-message');
      if (!existingMsg) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results-message';
        noResults.style.cssText = 'padding: 32px 20px; text-align: center; color: var(--color-text-secondary);';
        noResults.innerHTML = `
          <div style="font-size: 48px; opacity: 0.5; margin-bottom: 12px;">🔍</div>
          <p style="margin: 0;">No conversations found</p>
          <p style="margin: 8px 0 0 0; font-size: 13px;">Try a different search term</p>
        `;
        conversationsList.appendChild(noResults);
      }
    } else {
      const existingMsg = conversationsList?.querySelector('.no-results-message');
      if (existingMsg) existingMsg.remove();
    }
  });
}

// Auto-scroll to bottom of chat
function scrollToBottom(smooth = true) {
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    const scrollOptions = {
      top: chatMessages.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    };
    chatMessages.scrollTo(scrollOptions);
  }
}

// Show typing indicator
function showTypingIndicator(userName) {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    const typingText = typingIndicator.querySelector('.typing-text');
    if (typingText) {
      typingText.textContent = `${userName} is typing...`;
    }
    typingIndicator.style.display = 'block';
  }
}

// Hide typing indicator
function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.style.display = 'none';
  }
}

// Initialize message features
function initMessageFeatures() {
  // Initialize conversation search
  initConversationSearch();
  
  // Handle Enter key to send message
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keydown', function(e) {
      // Send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn && !sendBtn.disabled) {
          sendMessage();
        }
      }
    });
  }
  
  console.log('Message features initialized');
}

// Call init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMessageFeatures);
} else {
  initMessageFeatures();
}
