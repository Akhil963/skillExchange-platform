const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Protect user routes — require valid JWT and active account
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found. Please login again.' });
      }

      // Reject deactivated / banned accounts immediately regardless of token validity
      if (user.isActive === false) {
        return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact support.' });
      }

      req.user = user;
      next();
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token. Please login again.' });
    }
  } catch (error) {
    // Avoid leaking internal error details
    return res.status(500).json({ success: false, message: 'Authentication error. Please try again.' });
  }
};

// Generate JWT token
exports.generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};
