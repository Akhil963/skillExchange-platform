const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../client/admin/.env.admin') });

// Protect admin routes
exports.protect = async (req, res, next) => {
    try {
        let token;
        
        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        // Make sure token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route. Please login.'
            });
        }
        
        try {
            // Verify token
            const adminSecret = process.env.ADMIN_JWT_SECRET;
            
            if (!adminSecret) {
                throw new Error('ADMIN_JWT_SECRET is not configured');
            }
            
            const decoded = jwt.verify(token, adminSecret);
            
            // Get admin from token
            const admin = await Admin.findById(decoded.id);
            
            if (!admin) {
                return res.status(401).json({
                    success: false,
                    message: 'Admin not found'
                });
            }
            
            if (!admin.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Admin account is deactivated'
                });
            }
            
            req.admin = admin;
            next();
            
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. Invalid token.'
            });
        }
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error in authentication'
        });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.admin.role}' is not authorized to access this route`
            });
        }
        next();
    };
};
