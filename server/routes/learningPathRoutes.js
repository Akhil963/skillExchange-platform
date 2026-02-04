const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const learningPathController = require('../controllers/learningPathController');

// Admin Routes
// GET /api/learning-paths/admin/all - Get all learning paths (Admin only)
router.get('/admin/all', adminAuth.protect, learningPathController.getAllLearningPaths);

// GET /api/learning-paths/admin/:learningPathId/modules/:moduleId - Get module details (Admin only)
router.get('/admin/:learningPathId/modules/:moduleId', adminAuth.protect, learningPathController.getModuleDetailsAdmin);

// PUT /api/learning-paths/admin/:learningPathId/modules/:moduleId - Update module (Admin only)
router.put('/admin/:learningPathId/modules/:moduleId', adminAuth.protect, learningPathController.updateModule);

// DELETE /api/learning-paths/admin/:learningPathId/modules/:moduleId - Delete module (Admin only)
router.delete('/admin/:learningPathId/modules/:moduleId', adminAuth.protect, learningPathController.deleteModule);

// POST /api/learning-paths/admin/:learningPathId/modules - Add new module (Admin only)
router.post('/admin/:learningPathId/modules', adminAuth.protect, learningPathController.addModule);

// POST /api/learning-paths/admin/create-missing - Create missing learning paths (Admin only)
router.post('/admin/create-missing', adminAuth.protect, learningPathController.createMissingLearningPaths);

// POST /api/learning-paths/admin/seed-modules - Seed modules for all learning paths (Admin only)
router.post('/admin/seed-modules', adminAuth.protect, learningPathController.seedModulesForAllPaths);

// User Routes
// POST /api/learning-paths - Create a new learning path
router.post('/', protect, learningPathController.createLearningPath);

// GET /api/learning-paths/user/:userId - Get all learning paths for a user
router.get('/user/:userId', protect, learningPathController.getUserLearningPaths);

// GET /api/learning-paths/exchange/:exchangeId - Get learning paths for an exchange by current user
router.get('/exchange/:exchangeId', protect, learningPathController.getLearningPathsByExchange);

// GET /api/learning-paths/debug/exchange/:exchangeId - Debug endpoint to see status of both learning paths
router.get('/debug/exchange/:exchangeId', protect, learningPathController.debugExchangeLearningPaths);

// GET /api/learning-paths/:learningPathId/progress - Get learning path progress
router.get('/:learningPathId/progress', protect, learningPathController.getProgress);

// GET /api/learning-paths/:learningPathId - Get a specific learning path
router.get('/:learningPathId', protect, learningPathController.getLearningPath);

// PUT /api/learning-paths/:learningPathId/modules/:moduleId/complete - Complete a module
router.put('/:learningPathId/modules/:moduleId/complete', protect, learningPathController.completeModule);

// GET /api/learning-paths/:learningPathId/modules/:moduleId - Get module details
router.get('/:learningPathId/modules/:moduleId', protect, learningPathController.getModuleDetails);

// PUT /api/learning-paths/:learningPathId/modules/:moduleId/incomplete - Mark module as incomplete
router.put('/:learningPathId/modules/:moduleId/incomplete', protect, learningPathController.incompleteModule);

// PUT /api/learning-paths/:learningPathId/complete - Complete entire learning path
router.put('/:learningPathId/complete', protect, learningPathController.completeLearning);

module.exports = router;
