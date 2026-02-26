const User = require('../models/User');

// @desc    Get all users (for marketplace/discovery)
// @route   GET /api/users
// @access  Public
exports.getAllUsers = async (req, res, next) => {
  try {
    const { search, category, level, page = 1, limit = 20 } = req.query;

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    let query = { isActive: true };

    // Search by name or skills (with validation)
    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { 'skills_offered.name': { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category && category.trim()) {
      query['skills_offered.category'] = category.trim();
    }

    // Filter by experience level
    if (level && level.trim()) {
      query['skills_offered.experience_level'] = level.trim();
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ rating: -1, total_exchanges: -1 });

    const count = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id/profile
// @access  Private (self only)
exports.updateProfile = async (req, res, next) => {
  try {
    // Check if user is updating their own profile
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    const { name, email, username, phone, bio, location, avatar } = req.body;

    // Build update object
    const updateFields = {};
    
    if (name) updateFields.name = name.trim();
    if (email) updateFields.email = email.toLowerCase().trim();
    if (username) updateFields.username = username.trim();
    if (phone) updateFields.phone = phone.trim();
    if (bio) updateFields.bio = bio.trim();
    if (location) updateFields.location = location.trim();
    if (avatar) updateFields.avatar = avatar; // Can be base64 or URL

    // Find and update user
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all skills from all users
// @route   GET /api/users/skills/all
// @access  Public
exports.getAllSkills = async (req, res, next) => {
  try {
    const users = await User.find({ isActive: true }).select('name avatar skills_offered rating');

    const skills = [];
    users.forEach(user => {
      user.skills_offered.forEach(skill => {
        skills.push({
          ...skill.toObject(),
          user: {
            _id: user._id,
            name: user.name,
            avatar: user.avatar,
            rating: user.rating
          }
        });
      });
    });

    res.status(200).json({
      success: true,
      count: skills.length,
      skills
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get skill categories
// @route   GET /api/users/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await User.distinct('skills_offered.category');

    res.status(200).json({
      success: true,
      categories: categories.sort()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recommended matches for a user
// @route   GET /api/users/matches
// @access  Private
exports.getMatches = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id);

    if (!currentUser.skills_wanted || currentUser.skills_wanted.length === 0) {
      return res.status(200).json({
        success: true,
        matches: [],
        message: 'Add skills you want to learn to get recommendations'
      });
    }

    // Find users who offer what current user wants
    const wantedSkillNames = currentUser.skills_wanted.map(s => s.name.toLowerCase());
    const offeredSkillNames = currentUser.skills_offered ? currentUser.skills_offered.map(s => s.name.toLowerCase()) : [];
    
    const potentialMatches = await User.find({
      _id: { $ne: currentUser._id },
      isActive: true,
      $or: [
        { 'skills_offered.name': { $in: wantedSkillNames } },
        { 'skills_wanted.name': { $in: offeredSkillNames } }
      ]
    }).select('-password');

    // Calculate match scores with bidirectional matching
    const matches = potentialMatches.map(user => {
      let score = 0;
      const matchedSkills = [];
      let bidirectionalMatch = false;

      // Check what they offer that we want
      if (user.skills_offered && user.skills_offered.length > 0) {
        user.skills_offered.forEach(offeredSkill => {
          const wantedSkill = currentUser.skills_wanted.find(
            ws => ws.name.toLowerCase() === offeredSkill.name.toLowerCase()
          );

          if (wantedSkill) {
            score += 50; // Base match score
            
            // Bonus for category match
            if (wantedSkill.category === offeredSkill.category) {
              score += 20;
            }

            // Bonus for experience level compatibility
            const levelOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
            const offeredLevel = levelOrder[offeredSkill.experience_level?.toLowerCase()] || 2;
            const wantedLevel = levelOrder[wantedSkill.experience_level?.toLowerCase()] || 2;
            
            if (offeredLevel >= wantedLevel) {
              score += 15; // They have the level we need
            } else {
              score += 5; // Still useful but lower level
            }

            matchedSkills.push({
              skill: offeredSkill,
              wantedLevel: wantedSkill.experience_level,
              matchType: 'they_offer'
            });
          }
        });
      }

      // Check bidirectional match: what we offer that they want
      if (currentUser.skills_offered && currentUser.skills_offered.length > 0 &&
          user.skills_wanted && user.skills_wanted.length > 0) {
        currentUser.skills_offered.forEach(myOfferedSkill => {
          const theyWant = user.skills_wanted.find(
            ws => ws.name.toLowerCase() === myOfferedSkill.name.toLowerCase()
          );

          if (theyWant) {
            bidirectionalMatch = true;
            score += 100; // Huge bonus for bidirectional match!
            
            // Additional bonus if skill levels match well
            const levelOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
            const myLevel = levelOrder[myOfferedSkill.experience_level?.toLowerCase()] || 2;
            const theyWantLevel = levelOrder[theyWant.experience_level?.toLowerCase()] || 2;
            
            if (myLevel >= theyWantLevel) {
              score += 30; // We can teach them what they want
            }
          }
        });
      }

      // Bonus for user rating
      score += (user.rating || 0) * 5;

      // Bonus for completed exchanges (experienced users)
      score += (user.total_exchanges || 0) * 2;

      // Penalty for users with very low ratings
      if (user.rating < 2 && user.total_exchanges > 5) {
        score -= 50;
      }

      return {
        user: user.toObject(),
        score,
        matchedSkills,
        bidirectionalMatch,
        compatibility: score > 150 ? 'high' : score > 100 ? 'medium' : 'low'
      };
    });

    // Filter out matches with score 0 and sort by score
    const validMatches = matches.filter(m => m.score > 0);
    validMatches.sort((a, b) => b.score - a.score);

    res.status(200).json({
      success: true,
      matches: validMatches.slice(0, 10),
      totalMatches: validMatches.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user stats
// @route   PUT /api/users/:id/stats
// @access  Private (Admin or self)
exports.updateUserStats = async (req, res, next) => {
  try {
    const { total_exchanges, tokens_earned, rating, badges } = req.body;

    const updateFields = {};
    if (total_exchanges !== undefined) updateFields.total_exchanges = total_exchanges;
    if (tokens_earned !== undefined) updateFields.tokens_earned = tokens_earned;
    if (rating !== undefined) updateFields.rating = rating;
    if (badges) updateFields.badges = badges;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user token history
// @route   GET /api/users/:id/tokens
// @access  Private (self only)
exports.getTokenHistory = async (req, res, next) => {
  try {
    // Check if user is requesting their own token history
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this token history'
      });
    }

    const user = await User.findById(req.params.id)
      .select('token_history tokens_earned tokens_spent name')
      .populate('token_history.exchange_id', 'requested_skill offered_skill');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sort token history by date (most recent first)
    const sortedHistory = user.token_history.sort((a, b) => b.date - a.date);

    res.status(200).json({
      success: true,
      tokens: {
        current: user.tokens_earned,
        spent: user.tokens_spent || 0,
        total_earned: user.tokens_earned + (user.tokens_spent || 0),
        history: sortedHistory
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update email notification preferences
// @route   PUT /api/users/:id/email-preferences
// @access  Private (self only)
exports.updateEmailPreferences = async (req, res, next) => {
  try {
    // Check if user is updating their own preferences
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update these preferences'
      });
    }

    const { emailNotifications } = req.body;

    if (!emailNotifications) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email notification preferences'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { emailNotifications },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Email preferences updated successfully',
      emailNotifications: user.emailNotifications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add skill to user (offered or wanted)
// @route   POST /api/users/:id/skills
// @access  Private (self only)
exports.addSkill = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    const { skillType, skill } = req.body; // skillType: 'offered' or 'wanted'

    if (!skillType || !['offered', 'wanted'].includes(skillType)) {
      return res.status(400).json({
        success: false,
        message: 'Please specify skillType as "offered" or "wanted"'
      });
    }

    if (!skill || !skill.name || !skill.category || !skill.experience_level || !skill.description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete skill information'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const skillArray = skillType === 'offered' ? user.skills_offered : user.skills_wanted;

    // Check if skill already exists
    const existingSkill = skillArray.find(
      s => s.name.toLowerCase() === skill.name.toLowerCase()
    );

    if (existingSkill) {
      return res.status(400).json({
        success: false,
        message: `You already have "${skill.name}" in your ${skillType} skills`
      });
    }

    // Add the skill
    skillArray.push({
      ...skill,
      addedAt: new Date()
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: `Skill added to ${skillType} skills successfully`,
      skill: skillArray[skillArray.length - 1]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a skill
// @route   PUT /api/users/:id/skills/:skillId
// @access  Private (self only)
exports.updateSkill = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    const { skillType, skillData } = req.body;

    if (!skillType || !['offered', 'wanted'].includes(skillType)) {
      return res.status(400).json({
        success: false,
        message: 'Please specify skillType as "offered" or "wanted"'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const skillArray = skillType === 'offered' ? user.skills_offered : user.skills_wanted;
    const skill = skillArray.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    // Update skill fields
    Object.keys(skillData).forEach(key => {
      if (skillData[key] !== undefined) {
        skill[key] = skillData[key];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Skill updated successfully',
      skill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a skill
// @route   DELETE /api/users/:id/skills/:skillId
// @access  Private (self only)
exports.deleteSkill = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    const { skillType } = req.query;

    if (!skillType || !['offered', 'wanted'].includes(skillType)) {
      return res.status(400).json({
        success: false,
        message: 'Please specify skillType as "offered" or "wanted" in query params'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const skillArray = skillType === 'offered' ? user.skills_offered : user.skills_wanted;
    const skill = skillArray.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    skill.remove();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Skill deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add endorsement to a skill
// @route   POST /api/users/:id/skills/:skillId/endorse
// @access  Private
exports.endorseSkill = async (req, res, next) => {
  try {
    const { skillType, comment } = req.body;

    if (!skillType || !['offered', 'wanted'].includes(skillType)) {
      return res.status(400).json({
        success: false,
        message: 'Please specify skillType as "offered" or "wanted"'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const skillArray = skillType === 'offered' ? user.skills_offered : user.skills_wanted;
    const skill = skillArray.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    // Check if user already endorsed this skill
    const existingEndorsement = skill.endorsements.find(
      e => e.userId && e.userId.toString() === req.user._id.toString()
    );

    if (existingEndorsement) {
      return res.status(400).json({
        success: false,
        message: 'You have already endorsed this skill'
      });
    }

    skill.endorsements.push({
      userId: req.user._id,
      userName: req.user.name,
      comment: comment || '',
      date: new Date()
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Skill endorsed successfully',
      endorsement: skill.endorsements[skill.endorsements.length - 1]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify a skill (admin only)
// @route   PUT /api/users/:id/skills/:skillId/verify
// @access  Private (Admin only)
exports.verifySkill = async (req, res, next) => {
  try {
    const { skillType } = req.body;

    if (!skillType || !['offered', 'wanted'].includes(skillType)) {
      return res.status(400).json({
        success: false,
        message: 'Please specify skillType as "offered" or "wanted"'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const skillArray = skillType === 'offered' ? user.skills_offered : user.skills_wanted;
    const skill = skillArray.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    skill.verified = true;
    skill.verifiedAt = new Date();

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Skill verified successfully',
      skill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get skill recommendations for a user
// @route   GET /api/users/:id/skills/recommendations
// @access  Private (self only)
exports.getSkillRecommendations = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this information'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const Skill = require('../models/Skill');

    // Get all available skills
    const allSkills = await Skill.find({ isActive: true });

    // Filter out skills user already has
    const userSkillNames = [
      ...user.skills_offered.map(s => s.name.toLowerCase()),
      ...user.skills_wanted.map(s => s.name.toLowerCase())
    ];

    const recommendations = allSkills.filter(skill => 
      !userSkillNames.includes(skill.name.toLowerCase())
    );

    // Sort by popularity
    recommendations.sort((a, b) => b.usageCount - a.usageCount);

    // Get complementary skills based on user's current skills
    const userCategories = [...new Set(user.skills_offered.map(s => s.category))];
    const complementarySkills = recommendations.filter(skill =>
      userCategories.includes(skill.category)
    );

    res.status(200).json({
      success: true,
      recommendations: {
        popular: recommendations.slice(0, 10),
        complementary: complementarySkills.slice(0, 10),
        trending: recommendations.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
};
