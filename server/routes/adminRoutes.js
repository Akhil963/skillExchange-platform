const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// System status and stats
router.get('/status', adminController.getSystemStatus);
router.get('/stats', adminController.getStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Exchange management
router.get('/exchanges', adminController.getAllExchanges);
router.get('/exchanges/:id', adminController.getExchangeById);
router.put('/exchanges/:id', adminController.updateExchange);
router.delete('/exchanges/:id', adminController.deleteExchange);

// Skills management
router.get('/skills', adminController.getAllSkills);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Backup & Data Management
router.post('/backup/create', adminController.createBackup);
router.post('/backup/restore', adminController.restoreBackup);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
