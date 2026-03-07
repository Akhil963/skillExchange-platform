const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const learningPathSchema = new Schema({
  exchangeId: {
    type: mongoose.ObjectId,
    ref: 'Exchange',
    required: true
  },
  skillId: {
    type: mongoose.ObjectId,
    ref: 'Skill'
    // Not required — skill may not be found in the Skill collection
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
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'cancelled'],
    default: 'not-started'
  },
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  tasks: [
    {
      title: { type: String, required: true, trim: true, maxlength: 300 },
      completed: { type: Boolean, default: false },
      createdBy: { type: mongoose.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

// Indexes for performance
// Compound unique index: one learning path per learner per exchange
learningPathSchema.index({ exchangeId: 1, learner: 1 }, { unique: true });
learningPathSchema.index({ learner: 1 });
learningPathSchema.index({ instructor: 1 });
learningPathSchema.index({ skillId: 1 });
learningPathSchema.index({ status: 1 });

module.exports = mongoose.model('LearningPath', learningPathSchema);
