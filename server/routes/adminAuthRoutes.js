const express = require('express');
const router = express.Router();
const {
    signup,
    login,
    forgotPassword,
    resetPassword,
    getMe,
    verifyToken,
    logout
} = require('../controllers/adminAuthController');
const { protect } = require('../middleware/adminAuth');

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/verify-token', verifyToken);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
