const Conversation = require('../models/Conversation');
const Exchange = require('../models/Exchange');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');

// Get base URL for emails
const getBaseUrl = () => {
  return process.env.CLIENT_URL || 'http://localhost:5000';
};

// @desc    Get all conversations for current user
// @route   GET /api/conversations
// @access  Private
exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true
    })
      .populate('participants', 'name avatar email')
      .populate('exchange_id', 'requested_skill offered_skill status')
      .populate('lastMessage.sender', 'name avatar')
      .sort({ 'lastMessage.timestamp': -1 })
      .lean();

    // Filter out conversations with missing data
    const validConversations = conversations.filter(conv => {
      // Ensure participants are populated
      if (!conv.participants || conv.participants.length < 2) return false;
      
      // Ensure all participants have required fields
      const allParticipantsValid = conv.participants.every(p => p && p.name && p._id);
      if (!allParticipantsValid) return false;
      
      // Ensure exchange_id is populated
      if (!conv.exchange_id) return false;
      
      return true;
    });

    res.status(200).json({
      success: true,
      count: validConversations.length,
      conversations: validConversations
    });
  } catch (error) {
    console.error('Error loading conversations:', error);
    next(error);
  }
};

// @desc    Get conversation by ID
// @route   GET /api/conversations/:id
// @access  Private
exports.getConversationById = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'name email avatar')
      .populate('exchange_id')
      .populate('lastMessage.sender', 'name');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is part of conversation
    if (!conversation.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation'
      });
    }

    // Mark as read for current user
    await conversation.markAsRead(req.user._id);

    res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages from exchange
// @route   GET /api/conversations/exchange/:exchangeId
// @access  Private
exports.getMessagesByExchange = async (req, res, next) => {
  try {
    const exchange = await Exchange.findById(req.params.exchangeId)
      .populate('messages.user_id', 'name avatar');

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Check authorization
    if (
      exchange.requester_id.toString() !== req.user._id.toString() &&
      exchange.provider_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these messages'
      });
    }

    // Mark incoming (not sent by current user) messages as read
    let updated = false;
    exchange.messages.forEach(m => {
      const isIncoming = m.user_id && m.user_id._id
        ? m.user_id._id.toString() !== req.user._id.toString()
        : m.user_id.toString() !== req.user._id.toString();
      if (isIncoming && !m.read) {
        m.read = true;
        updated = true;
      }
    });

    if (updated) {
      try {
        await exchange.save();
      } catch (saveErr) {
        // Do not block response if save fails; log for debugging
        console.error('Failed to update message read flags:', saveErr);
      }
    }

    res.status(200).json({
      success: true,
      messages: exchange.messages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark conversation as read
// @route   PUT /api/conversations/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    await conversation.markAsRead(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread count
// @route   GET /api/conversations/unread/count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true
    });

    let totalUnread = 0;
    conversations.forEach(conv => {
      const count = conv.unreadCount.get(req.user._id.toString()) || 0;
      totalUnread += count;
    });

    res.status(200).json({
      success: true,
      unreadCount: totalUnread
    });
  } catch (error) {
    next(error);
  }
};
