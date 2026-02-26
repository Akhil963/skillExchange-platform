const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const { protect: adminProtect } = require('../middleware/adminAuth');

// Public routes
router.get('/popular', skillController.getPopularSkills);
router.get('/categories', skillController.getCategories);
router.get('/category/:category', skillController.getSkillsByCategory);

// Protected admin routes
router.get('/', adminProtect, skillController.getAllSkills);
router.get('/:id', adminProtect, skillController.getSkillById);
router.post('/', adminProtect, skillController.createSkill);
router.put('/:id', adminProtect, skillController.updateSkill);
router.delete('/:id', adminProtect, skillController.deleteSkill);
router.post('/bulk', adminProtect, skillController.bulkCreateSkills);

module.exports = router;
