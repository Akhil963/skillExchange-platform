const mongoose = require('mongoose');

const learningMaterialSchema = new mongoose.Schema({
  learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['video', 'pdf'],
    required: true
  },
  cloudinaryPublicId: {
    type: String
  },
  fileSize: {
    type: Number // bytes
  },
  videoThumbnail: {
    type: String // thumbnail URL for external video materials
  },
  duration: {
    type: Number // duration in minutes
  },
  isExternalLink: {
    type: Boolean,
    default: false
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  materialCategory: {
    type: String,
    enum: ['teaching', 'learning'],
    default: 'teaching'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

learningMaterialSchema.index({ learningPathId: 1, createdAt: -1 });

module.exports = mongoose.model('LearningMaterial', learningMaterialSchema);
