const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const moduleSchema = new Schema({
  moduleId: {
    type: mongoose.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  videoId: mongoose.ObjectId,
  videoTitle: String,
  videoUrl: String, // YouTube embed URL
  duration: Number, // in minutes
  order: {
    type: Number,
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const learningPathSchema = new Schema({
  exchangeId: {
    type: mongoose.ObjectId,
    ref: 'Exchange',
    required: true
  },
  skillId: {
    type: mongoose.ObjectId,
    ref: 'Skill',
    required: true
  },
  learner: {
    type: mongoose.ObjectId,
    ref: 'User',
    required: true
  },
  instructor: {
    type: mongoose.ObjectId,
    ref: 'User',
    required: true
  },
  modules: [moduleSchema],
  totalModules: {
    type: Number,
    default: 0
  },
  completedModules: {
    type: Number,
    default: 0
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'cancelled'],
    default: 'not-started'
  },
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  estimatedDuration: Number, // in minutes, sum of all module durations
  actualDuration: Number, // in minutes
  averageScore: Number, // average of all module scores
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
// Compound unique index: one learning path per learner per exchange
learningPathSchema.index({ exchangeId: 1, learner: 1 }, { unique: true });
learningPathSchema.index({ learner: 1 });
learningPathSchema.index({ instructor: 1 });
learningPathSchema.index({ skillId: 1 });
learningPathSchema.index({ status: 1 });

// Update updatedAt on save
learningPathSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LearningPath', learningPathSchema);
