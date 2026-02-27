const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/emailService');

// Get base URL for emails
const getBaseUrl = () => {
  return process.env.CLIENT_URL || 'http://localhost:5000';
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, location } = req.body;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      location: location ? location.trim() : '',
      badges: ['New Member']
    });

    // Generate token
    const token = generateToken(user._id);

    // Send welcome email (non-blocking)
    if (user.email) {
      sendEmail(user.email, 'welcomeEmail', {
        userName: user.name,
        dashboardUrl: `${getBaseUrl()}/#dashboard`
      }).catch(err => console.error('Welcome email error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Get user with password
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      console.warn(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      console.warn(`Login failed - password mismatch for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log(`✓ Login successful for user: ${email}`);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Login error:', error.message);
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio, location, avatar, profilePicture, skills_offered, skills_wanted } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (bio) updateFields.bio = bio;
    if (location) updateFields.location = location;
    
    // Handle profile picture (uploaded file takes priority)
    if (profilePicture) {
      updateFields.profilePicture = profilePicture;
      updateFields.avatar = profilePicture; // Also update avatar field for backward compatibility
    } else if (avatar) {
      updateFields.avatar = avatar;
      updateFields.profilePicture = avatar;
    }
    
    if (skills_offered) updateFields.skills_offered = skills_offered;
    if (skills_wanted) updateFields.skills_wanted = skills_wanted;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Check if passwords are the same
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as current password'
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - Send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body; // Can be email, username, or phone

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email, username, or phone number'
      });
    }

    // Find user by email, username, or phone
    const user = await User.findByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that information'
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    
    // For local development, also show the direct link
    const clientResetUrl = process.env.CLIENT_URL 
      ? `${process.env.CLIENT_URL}/reset-password/${resetToken}`
      : `http://localhost:5000?reset=${resetToken}`;

    // Determine contact method (prioritize email, then phone)
    let contactInfo = {
      method: 'email',
      value: user.email
    };
    
    if (!user.email && user.phone) {
      contactInfo = {
        method: 'phone',
        value: user.phone
      };
    }

    try {
      const { sendEmail, getResetPasswordEmail } = require('../config/email');
      
      if (contactInfo.method === 'email') {
        await sendEmail({
          email: user.email,
          subject: 'Password Reset Request - SkillExchange',
          html: getResetPasswordEmail(clientResetUrl, user.name)
        });
      }

      res.status(200).json({
        success: true,
        message: `Password reset link sent to your ${contactInfo.method === 'email' ? 'email' : 'phone'}`,
        contactMethod: contactInfo.method,
        maskedContact: contactInfo.method === 'email' 
          ? `${contactInfo.value.substring(0, 3)}***@${contactInfo.value.split('@')[1]}`
          : `***${contactInfo.value.slice(-4)}`,
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Clear reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      // For development, still return success with token
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          success: true,
          message: 'Email service not configured. Use this reset link:',
          resetUrl: clientResetUrl,
          resetToken: resetToken,
          note: 'In development mode - configure SMTP for production'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent. Please contact support.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide new password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find user by reset token (with password field selected)
    const user = await User.findByResetToken(resetToken);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    console.log(`Reset password initiated for user: ${user.email}`);

    // Set new password (this will trigger pre-save middleware to hash it)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Mark password as modified explicitly to ensure pre-save hook runs
    user.markModified('password');
    
    // Save with validation enabled
    const savedUser = await user.save({ validateBeforeSave: true });
    
    if (!savedUser) {
      throw new Error('Failed to save user with new password');
    }

    console.log(`✓ Password reset successful for user: ${savedUser.email}`);
    
    // Verify the password was actually hashed by attempting comparison
    const testCompare = await savedUser.comparePassword(password);
    if (testCompare) {
      console.log(`✓ Password verification successful - new password can be used to login`);
    } else {
      console.error(`✗ Password verification FAILED - password may not have been hashed correctly`);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error.message);
    console.error('Stack:', error.stack);
    next(error);
  }
};

// @desc    Request email verification before password reset
// @route   POST /api/auth/request-email-verification
// @access  Public
exports.requestEmailVerification = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, username, or phone'
      });
    }

    // Find user
    const user = await User.findByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that information'
      });
    }

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/verify-email/${verificationToken}`;

    try {
      const { getEmailVerificationEmail } = require('../config/email');
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Email - SkillExchange Password Reset',
        html: getEmailVerificationEmail(verificationUrl, user.name)
      });

      res.status(200).json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
        maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      });
    } catch (emailError) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw emailError;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email and generate reset OTP
// @route   POST /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { method = 'email' } = req.body; // 'email' or 'sms'

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Find user by email verification token
    const user = await User.findByEmailVerificationToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link'
      });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;

    // Generate OTP
    const otp = user.generateResetOTP();
    user.resetMethod = method;
    await user.save({ validateBeforeSave: false });

    try {
      if (method === 'sms' && user.phone) {
        // Send OTP via SMS
        const { sendOTPSMS } = require('../utils/smsService');
        await sendOTPSMS(user.phone, otp);
        
        res.status(200).json({
          success: true,
          message: 'OTP sent to your phone',
          method: 'sms',
          maskedPhone: user.phone.replace(/(.{2})(.*)(.{2})/, '$1***$3')
        });
      } else {
        // Send OTP via email
        const { getOTPEmail } = require('../config/email');
        await sendEmail({
          email: user.email,
          subject: '🔐 Your SkillExchange Password Reset Code',
          html: getOTPEmail(otp, user.name)
        });

        res.status(200).json({
          success: true,
          message: 'OTP sent to your email',
          method: 'email',
          maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        });
      }
    } catch (otpError) {
      user.resetOTP = undefined;
      user.resetOTPExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw otpError;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and generate reset password token
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify OTP
    const verification = user.verifyResetOTP(otp);
    if (!verification.success) {
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Generate reset token for password reset
    const resetToken = user.getResetPasswordToken();
    user.resetOTP = undefined;
    user.resetOTPExpire = undefined;
    user.resetOTPAttempts = 0;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/reset-password/${resetToken}`;

    res.status(200).json({
      success: true,
      message: 'OTP verified. You can now reset your password.',
      resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined,
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request OTP resend
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email first'
      });
    }

    // Generate new OTP
    const otp = user.generateResetOTP();
    await user.save({ validateBeforeSave: false });

    try {
      if (user.resetMethod === 'sms' && user.phone) {
        const { sendOTPSMS } = require('../utils/smsService');
        await sendOTPSMS(user.phone, otp);
      } else {
        const { getOTPEmail } = require('../config/email');
        await sendEmail({
          email: user.email,
          subject: '🔐 Your SkillExchange Password Reset Code (Resend)',
          html: getOTPEmail(otp, user.name)
        });
      }

      res.status(200).json({
        success: true,
        message: `OTP resent to your ${user.resetMethod}`
      });
    } catch (error) {
      user.resetOTP = undefined;
      user.resetOTPExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw error;
    }
  } catch (error) {
    next(error);
  }
};
