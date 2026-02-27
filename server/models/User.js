const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  experience_level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    required: true
  },
  years_of_experience: {
    type: Number,
    min: 0,
    max: 50,
    default: 0
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  thumbnail: {
    type: String,
    trim: true,
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  portfolio: [{
    title: String,
    url: String,
    description: String
  }],
  certificates: [{
    name: String,
    issuer: String,
    issueDate: Date,
    url: String
  }],
  endorsements: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  proficiencyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  availability: {
    hoursPerWeek: {
      type: Number,
      min: 0,
      max: 168
    },
    preferredDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    preferredTimeSlots: [{
      type: String,
      enum: ['Morning', 'Afternoon', 'Evening', 'Night']
    }]
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/, 'Please provide a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  bio: {
    type: String,
    default: 'New SkillExchange member',
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  avatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  total_exchanges: {
    type: Number,
    default: 0,
    min: 0
  },
  tokens_earned: {
    type: Number,
    default: 50,
    min: 0
  },
  tokens_spent: {
    type: Number,
    default: 0,
    min: 0
  },
  token_history: [{
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['earned', 'spent', 'bonus', 'penalty'],
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    exchange_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exchange'
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  skills_offered: [skillSchema],
  skills_wanted: [skillSchema],
  badges: [{
    type: String,
    trim: true
  }],
  active_exchanges: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpire: {
    type: Date
  },
  // OTP for 2FA during password reset
  resetOTP: {
    type: String // 6-digit code
  },
  resetOTPExpire: {
    type: Date // 10 minutes
  },
  resetOTPAttempts: {
    type: Number,
    default: 0 // Track failed OTP attempts
  },
  // Email verification
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpire: {
    type: Date // 30 minutes
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  // SMS reset preferences
  smsResetEnabled: {
    type: Boolean,
    default: false
  },
  resetMethod: {
    type: String,
    enum: ['email', 'sms'],
    default: 'email'
  },
  emailNotifications: {
    exchangeRequests: {
      type: Boolean,
      default: true
    },
    exchangeAccepted: {
      type: Boolean,
      default: true
    },
    exchangeCompleted: {
      type: Boolean,
      default: true
    },
    newRatings: {
      type: Boolean,
      default: true
    },
    newMessages: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Method to add tokens
userSchema.methods.addTokens = async function(amount, type, reason, exchangeId = null) {
  this.tokens_earned += amount;
  this.token_history.push({
    amount,
    type,
    reason,
    exchange_id: exchangeId,
    date: new Date()
  });
  await this.save();
  return this;
};

// Method to spend tokens
userSchema.methods.spendTokens = async function(amount, reason, exchangeId = null) {
  if (this.tokens_earned < amount) {
    throw new Error('Insufficient tokens');
  }
  this.tokens_earned -= amount;
  this.tokens_spent += amount;
  this.token_history.push({
    amount: -amount,
    type: 'spent',
    reason,
    exchange_id: exchangeId,
    date: new Date()
  });
  await this.save();
  return this;
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function() {
  const crypto = require('crypto');
  
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire time (15 minutes)
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
  
  return resetToken;
};

// Compare reset token
userSchema.statics.findByResetToken = async function(resetToken) {
  const crypto = require('crypto');
  
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  return await this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  }).select('+password');
};

// Find user by email, username, or phone
userSchema.statics.findByIdentifier = async function(identifier) {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  
  let query = {};
  
  if (emailRegex.test(identifier)) {
    // It's an email
    query = { email: identifier.toLowerCase() };
  } else if (phoneRegex.test(identifier)) {
    // It's a phone number
    query = { phone: identifier };
  } else {
    // It's a username
    query = { username: identifier };
  }
  
  return await this.findOne(query);
};

// Generate 6-digit OTP for 2FA
userSchema.methods.generateResetOTP = function() {
  // Generate 6-digit OTP (random number from 100000 to 999999)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store OTP (in production, consider hashing this too)
  this.resetOTP = otp;
  this.resetOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.resetOTPAttempts = 0; // Reset attempts counter
  
  return otp;
};

// Verify OTP
userSchema.methods.verifyResetOTP = function(otp) {
  // Check if OTP is expired
  if (Date.now() > this.resetOTPExpire) {
    return { success: false, message: 'OTP has expired' };
  }
  
  // Check maximum attempts (max 5 attempts)
  if (this.resetOTPAttempts >= 5) {
    return { success: false, message: 'Maximum OTP attempts exceeded. Request a new one.' };
  }
  
  // Verify OTP
  if (this.resetOTP === otp) {
    return { success: true, message: 'OTP verified successfully' };
  }
  
  // Increment failed attempts
  this.resetOTPAttempts += 1;
  return { success: false, message: `Invalid OTP. ${5 - this.resetOTPAttempts} attempts remaining.` };
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(20).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  this.emailVerificationExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
  
  return token;
};

// Verify email token
userSchema.statics.findByEmailVerificationToken = async function(token) {
  const crypto = require('crypto');
  
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  return await this.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() }
  });
};

// Virtual for full profile URL
userSchema.virtual('profileUrl').get(function() {
  return `/profile/${this._id}`;
});

// Index for searching
userSchema.index({ name: 'text', 'skills_offered.name': 'text', 'skills_wanted.name': 'text' });
// Note: email index is created automatically by unique: true

const User = mongoose.model('User', userSchema);

module.exports = User;
