const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const learningPathController = require('../controllers/learningPathController');

// Admin Routes
// GET /api/learning-paths/admin/all - Get all learning paths (Admin only)
router.get('/admin/all', adminAuth.protect, learningPathController.getAllLearningPaths);

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

// PUT /api/learning-paths/:learningPathId/complete - Complete entire learning path
router.put('/:learningPathId/complete', protect, learningPathController.completeLearning);

// Materials routes
// POST /api/learning-paths/:learningPathId/materials - Upload a material (instructor only)
router.post('/:learningPathId/materials', protect, learningPathController.uploadMaterialToPath);

// GET /api/learning-paths/:learningPathId/materials - Get all materials
router.get('/:learningPathId/materials', protect, learningPathController.getMaterials);

// DELETE /api/learning-paths/:learningPathId/materials/:materialId - Delete a material
router.delete('/:learningPathId/materials/:materialId', protect, learningPathController.deleteMaterial);

// Task routes
// POST /api/learning-paths/:learningPathId/tasks - Add a task
router.post('/:learningPathId/tasks', protect, learningPathController.addTask);

// PUT /api/learning-paths/:learningPathId/tasks/:taskId - Update a task
router.put('/:learningPathId/tasks/:taskId', protect, learningPathController.updateTask);

// DELETE /api/learning-paths/:learningPathId/tasks/:taskId - Delete a task
router.delete('/:learningPathId/tasks/:taskId', protect, learningPathController.deleteTask);

module.exports = router;
