const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/adminEmailService');
require('dotenv').config({ path: path.join(__dirname, '../../client/admin/.env.admin') });

// Generate JWT Token
const generateToken = (adminId) => {
    return jwt.sign(
        { id: adminId },
        process.env.ADMIN_JWT_SECRET || 'admin-secret-key',
        { expiresIn: process.env.ADMIN_JWT_EXPIRE || '7d' }
    );
};

// @desc    Register new admin
// @route   POST /api/admin-auth/signup
// @access  Public (can be restricted later)
exports.signup = async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body;
        
        // Validate input
        if (!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, password, and full name'
            });
        }
        
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'An admin with this email already exists'
            });
        }
        
        // Generate unique ID
        const uniqueId = await Admin.generateUniqueId();
        
        // Create admin
        const admin = await Admin.create({
            email: email.toLowerCase(),
            password,
            fullName,
            uniqueId,
            role: role || 'admin'
        });
        
        // Generate token
        const token = generateToken(admin._id);
        
        // Send welcome email (async, don't wait)
        sendWelcomeEmail(admin).catch(err => 
            console.error('Failed to send welcome email:', err)
        );
        
        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            data: {
                admin: {
                    id: admin._id,
                    uniqueId: admin.uniqueId,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    createdAt: admin.createdAt
                },
                token
            }
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating admin account',
            error: error.message
        });
    }
};

// @desc    Login admin
// @route   POST /api/admin-auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { identifier, password, rememberMe } = req.body;
        
        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email/unique ID and password'
            });
        }
        
        // Find admin by email or uniqueId
        const admin = await Admin.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { uniqueId: identifier.toUpperCase() }
            ],
            isActive: true
        }).select('+password');
        
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Check password
        const isMatch = await admin.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Update last login
        await admin.updateLastLogin();
        
        // Generate token with different expiry based on rememberMe
        const tokenExpiry = rememberMe ? '30d' : '7d';
        const token = jwt.sign(
            { id: admin._id },
            process.env.ADMIN_JWT_SECRET || 'admin-secret-key',
            { expiresIn: tokenExpiry }
        );
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                admin: {
                    id: admin._id,
                    uniqueId: admin.uniqueId,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    lastLogin: admin.lastLogin
                },
                token
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
};

// @desc    Forgot password - send reset email
// @route   POST /api/admin-auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { identifier } = req.body;
        
        if (!identifier) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your email or unique ID'
            });
        }
        
        // Find admin
        const admin = await Admin.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { uniqueId: identifier.toUpperCase() }
            ],
            isActive: true
        });
        
        // Always return success to prevent email enumeration
        if (!admin) {
            return res.json({
                success: true,
                message: 'If an account exists with that email/ID, a password reset link has been sent'
            });
        }
        
        // Generate reset token
        const resetToken = admin.getResetPasswordToken();
        await admin.save({ validateBeforeSave: false });
        
        // Send email
        try {
            await sendPasswordResetEmail(admin, resetToken);
            
            res.json({
                success: true,
                message: 'Password reset link has been sent to your email'
            });
        } catch (error) {
            admin.resetPasswordToken = undefined;
            admin.resetPasswordExpire = undefined;
            await admin.save({ validateBeforeSave: false });
            
            return res.status(500).json({
                success: false,
                message: 'Error sending password reset email. Please try again later.'
            });
        }
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing request',
            error: error.message
        });
    }
};

// @desc    Reset password
// @route   POST /api/admin-auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;
        
        // Validate input
        if (!password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide password and confirm password'
            });
        }
        
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }
        
        // Hash token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
        
        // Find admin with valid token
        const admin = await Admin.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() },
            isActive: true
        });
        
        if (!admin) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }
        
        // Set new password
        admin.password = password;
        admin.resetPasswordToken = undefined;
        admin.resetPasswordExpire = undefined;
        await admin.save();
        
        // Generate new token
        const authToken = generateToken(admin._id);
        
        res.json({
            success: true,
            message: 'Password reset successful',
            data: {
                token: authToken
            }
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

// @desc    Get current admin profile
// @route   GET /api/admin-auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id);
        
        res.json({
            success: true,
            data: {
                admin: {
                    id: admin._id,
                    uniqueId: admin.uniqueId,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    lastLogin: admin.lastLogin,
                    createdAt: admin.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: error.message
        });
    }
};

// @desc    Verify token
// @route   POST /api/admin-auth/verify-token
// @access  Public
exports.verifyToken = async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.ADMIN_JWT_SECRET || 'admin-secret-key'
        );
        
        // Check if admin exists and is active
        const admin = await Admin.findById(decoded.id);
        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                admin: {
                    id: admin._id,
                    uniqueId: admin.uniqueId,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role
                }
            }
        });
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// @desc    Logout admin (client-side token removal)
// @route   POST /api/admin-auth/logout
// @access  Private
exports.logout = async (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
};
