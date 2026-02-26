const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateProfile,
  getAllSkills,
  getCategories,
  getMatches,
  updateUserStats,
  getTokenHistory,
  updateEmailPreferences,
  addSkill,
  updateSkill,
  deleteSkill,
  endorseSkill,
  verifySkill,
  getSkillRecommendations
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { protect: adminProtect } = require('../middleware/adminAuth');

// Public routes
router.get('/', getAllUsers);
router.get('/skills/all', getAllSkills);
router.get('/categories', getCategories);
router.get('/:id', getUserById);

// Protected routes
router.put('/:id/profile', protect, updateProfile);
router.get('/matches/recommendations', protect, getMatches);
router.get('/:id/tokens', protect, getTokenHistory);
router.put('/:id/stats', protect, updateUserStats);
router.put('/:id/email-preferences', protect, updateEmailPreferences);

// Skill management routes
router.post('/:id/skills', protect, addSkill);
router.put('/:id/skills/:skillId', protect, updateSkill);
router.delete('/:id/skills/:skillId', protect, deleteSkill);
router.post('/:id/skills/:skillId/endorse', protect, endorseSkill);
router.put('/:id/skills/:skillId/verify', adminProtect, verifySkill);
router.get('/:id/skills/recommendations', protect, getSkillRecommendations);

module.exports = router;
