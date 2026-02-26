const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversationById,
  getMessagesByExchange,
  markAsRead,
  getUnreadCount
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.get('/', getConversations);
router.get('/unread/count', getUnreadCount);
router.get('/exchange/:exchangeId', getMessagesByExchange);
router.get('/:id', getConversationById);
router.put('/:id/read', markAsRead);

module.exports = router;
