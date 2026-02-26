const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const exchangeSchema = new mongoose.Schema({
  requester_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester ID is required']
  },
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Provider ID is required']
  },
  requested_skill: {
    type: String,
    required: [true, 'Requested skill is required'],
    trim: true
  },
  offered_skill: {
    type: String,
    required: [true, 'Offered skill is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  messages: [messageSchema],
  created_date: {
    type: Date,
    default: Date.now
  },
  accepted_date: {
    type: Date
  },
  completed_date: {
    type: Date
  },
  // Ratings from both parties
  requester_rating: {
    type: Number,
    min: 1,
    max: 5
  },
  requester_review: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },
  provider_rating: {
    type: Number,
    min: 1,
    max: 5
  },
  provider_review: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },
  // Legacy single rating field (for backward compatibility)
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },
  sessions_completed: {
    type: Number,
    default: 0,
    min: 0
  },
  total_hours: {
    type: Number,
    default: 0,
    min: 0
  },
  // BIDIRECTIONAL LEARNING PATHS - One for each person's learning
  // Requester learns the requested_skill with this path
  requester_learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath'
  },
  requester_learningCompleted: {
    type: Boolean,
    default: false
  },
  requester_learningCompletedAt: {
    type: Date
  },
  // Provider learns the offered_skill with this path
  provider_learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath'
  },
  provider_learningCompleted: {
    type: Boolean,
    default: false
  },
  provider_learningCompletedAt: {
    type: Date
  },
  // Legacy single learning path (for backward compatibility)
  learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath'
  },
  learningCompleted: {
    type: Boolean,
    default: false
  },
  learningCompletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
exchangeSchema.index({ requester_id: 1, status: 1 });
exchangeSchema.index({ provider_id: 1, status: 1 });
exchangeSchema.index({ status: 1, created_date: -1 });

// Virtual for conversation participants
exchangeSchema.virtual('participants').get(function() {
  return [this.requester_id, this.provider_id];
});

// Method to add message
exchangeSchema.methods.addMessage = function(userId, messageText) {
  this.messages.push({
    user_id: userId,
    message: messageText,
    timestamp: new Date()
  });
  return this.save();
};

// Method to update status
exchangeSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === 'active' && !this.accepted_date) {
    this.accepted_date = new Date();
  } else if (newStatus === 'completed' && !this.completed_date) {
    this.completed_date = new Date();
  }
  
  return this.save();
};

const Exchange = mongoose.model('Exchange', exchangeSchema);

module.exports = Exchange;
