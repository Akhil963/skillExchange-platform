/**
 * ========================================
 * DATABASE INDEXING & QUERY OPTIMIZATION
 * ========================================
 * This module sets up MongoDB indexes for optimal query performance
 */

const User = require('../models/User');
const Exchange = require('../models/Exchange');
const Conversation = require('../models/Conversation');
const Skill = require('../models/Skill');
const LearningPath = require('../models/LearningPath');

/**
 * Initialize all database indexes
 * Run this once when the application starts
 */
async function initializeIndexes() {
  try {
    console.log('🔄 Initializing database indexes...');

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    await User.collection.createIndex({ username: 1 }, { unique: true, sparse: true });
    await User.collection.createIndex({ isActive: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ skills: 1 });
    console.log('✓ User indexes created');

    // Exchange indexes
    await Exchange.collection.createIndex({ offererSkillId: 1 });
    await Exchange.collection.createIndex({ requesterSkillId: 1 });
    await Exchange.collection.createIndex({ status: 1 });
    await Exchange.collection.createIndex({ offerer: 1, status: 1 });
    await Exchange.collection.createIndex({ requester: 1, status: 1 });
    await Exchange.collection.createIndex({ createdAt: -1 });
    await Exchange.collection.createIndex({ completedAt: -1 });
    console.log('✓ Exchange indexes created');

    // Conversation indexes
    await Conversation.collection.createIndex({ participants: 1 });
    await Conversation.collection.createIndex({ exchange: 1 });
    await Conversation.collection.createIndex({ createdAt: -1 });
    await Conversation.collection.createIndex({ updatedAt: -1 });
    console.log('✓ Conversation indexes created');

    // Skill indexes
    await Skill.collection.createIndex({ category: 1 });
    await Skill.collection.createIndex({ name: 1 });
    await Skill.collection.createIndex({ level: 1 });
    await Skill.collection.createIndex({ createdAt: -1 });
    console.log('✓ Skill indexes created');

    // Learning Path indexes
    await LearningPath.collection.createIndex({ exchange: 1 });
    await LearningPath.collection.createIndex({ userId: 1 });
    await LearningPath.collection.createIndex({ skillId: 1 });
    await LearningPath.collection.createIndex({ status: 1 });
    await LearningPath.collection.createIndex({ createdAt: -1 });
    console.log('✓ LearningPath indexes created');

    console.log('✅ All database indexes initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing indexes:', error);
    // Don't throw - indexes might already exist
    return false;
  }
}

/**
 * Optimize common queries with proper field selection
 */
const queryOptimizations = {
  // Get user with minimal fields
  getUserMinimal: (userId, fields = 'username email rating isActive') => ({
    _id: userId,
    fields
  }),

  // Get exchange details
  getExchangeDetails: (exchangeId) => ({
    _id: exchangeId,
    fields: 'offerer requester offererSkillId requesterSkillId status createdAt'
  }),

  // Get active exchanges only
  getActiveExchanges: () => ({
    filters: { status: { $in: ['pending', 'active'] } },
    fields: 'offerer requester status createdAt'
  }),

  // Get user skills
  getUserSkills: (userId) => ({
    filters: { _id: userId },
    fields: 'skills'
  })
};

/**
 * Pagination helper with cursor-based pagination support
 */
function getPaginationOptions(page = 1, limit = 20) {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  return {
    skip: (page - 1) * limit,
    limit,
    page
  };
}

/**
 * Get suggested indexes to add based on slow queries
 */
const suggestedIndexes = [
  { collection: 'users', fields: { email: 1 }, options: { unique: true } },
  { collection: 'exchanges', fields: { status: 1, createdAt: -1 } },
  { collection: 'conversations', fields: { participants: 1, createdAt: -1 } },
  { collection: 'skills', fields: { category: 1, createdAt: -1 } },
  { collection: 'learningpaths', fields: { exchange: 1, status: 1 } }
];

module.exports = {
  initializeIndexes,
  queryOptimizations,
  getPaginationOptions,
  suggestedIndexes
};
