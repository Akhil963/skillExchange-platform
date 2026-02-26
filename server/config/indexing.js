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

    // Helper function to safely create indexes
    const safeCreateIndex = async (collection, keys, options = {}) => {
      try {
        await collection.createIndex(keys, options);
      } catch (error) {
        if (error.code === 86) {
          // IndexKeySpecsConflict - index exists with different options
          // Extract index name from keys
          const indexName = Object.keys(keys).join('_') + '_' + 
            Object.values(keys).toString().replace(/[,\s]/g, '');
          try {
            await collection.dropIndex(indexName);
            console.log(`  ↻ Dropped conflicting index: ${indexName}`);
            // Retry creating the index
            await collection.createIndex(keys, options);
          } catch (dropError) {
            console.warn(`  ⚠️  Could not drop index: ${indexName}`, dropError.message);
          }
        } else {
          throw error;
        }
      }
    };

    // User indexes
    await safeCreateIndex(User.collection, { email: 1 }, { unique: true, sparse: true });
    await safeCreateIndex(User.collection, { username: 1 }, { unique: true, sparse: true });
    await safeCreateIndex(User.collection, { isActive: 1 });
    await safeCreateIndex(User.collection, { createdAt: -1 });
    await safeCreateIndex(User.collection, { skills: 1 });
    console.log('✓ User indexes created');

    // Exchange indexes
    await safeCreateIndex(Exchange.collection, { offererSkillId: 1 });
    await safeCreateIndex(Exchange.collection, { requesterSkillId: 1 });
    await safeCreateIndex(Exchange.collection, { status: 1 });
    await safeCreateIndex(Exchange.collection, { offerer: 1, status: 1 });
    await safeCreateIndex(Exchange.collection, { requester: 1, status: 1 });
    await safeCreateIndex(Exchange.collection, { createdAt: -1 });
    await safeCreateIndex(Exchange.collection, { completedAt: -1 });
    console.log('✓ Exchange indexes created');

    // Conversation indexes
    await safeCreateIndex(Conversation.collection, { participants: 1 });
    await safeCreateIndex(Conversation.collection, { exchange: 1 });
    await safeCreateIndex(Conversation.collection, { createdAt: -1 });
    await safeCreateIndex(Conversation.collection, { updatedAt: -1 });
    console.log('✓ Conversation indexes created');

    // Skill indexes
    await safeCreateIndex(Skill.collection, { category: 1 });
    await safeCreateIndex(Skill.collection, { name: 1 });
    await safeCreateIndex(Skill.collection, { level: 1 });
    await safeCreateIndex(Skill.collection, { createdAt: -1 });
    console.log('✓ Skill indexes created');

    // Learning Path indexes
    await safeCreateIndex(LearningPath.collection, { exchange: 1 });
    await safeCreateIndex(LearningPath.collection, { userId: 1 });
    await safeCreateIndex(LearningPath.collection, { skillId: 1 });
    await safeCreateIndex(LearningPath.collection, { status: 1 });
    await safeCreateIndex(LearningPath.collection, { createdAt: -1 });
    console.log('✓ LearningPath indexes created');

    console.log('✅ All database indexes initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing indexes:', error.message);
    // Don't throw - allow app to continue even if indexes fail
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
