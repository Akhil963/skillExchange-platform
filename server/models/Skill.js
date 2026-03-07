const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Skill name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: [
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
    ]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: [100, 'Subcategory cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true
});

// Index for searching and filtering
skillSchema.index({ name: 'text', description: 'text', tags: 'text' });
skillSchema.index({ category: 1, isActive: 1 });
skillSchema.index({ usageCount: -1 });

// Method to increment usage count
skillSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
  return this;
};

// Static method to get popular skills
skillSchema.statics.getPopularSkills = async function(limit = 10) {
  return await this.find({ isActive: true })
    .sort({ usageCount: -1 })
    .limit(limit);
};

// Static method to get skills by category
skillSchema.statics.getByCategory = async function(category) {
  return await this.find({ category, isActive: true })
    .sort({ name: 1 });
};

const Skill = mongoose.model('Skill', skillSchema);

module.exports = Skill;
