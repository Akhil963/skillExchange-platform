const mongoose = require('mongoose');
const Exchange = require('../models/Exchange');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const LearningPath = require('../models/LearningPath');
const Skill = require('../models/Skill');
const { sendEmail } = require('../utils/emailService');

// Get base URL for emails
const getBaseUrl = () => {
  return process.env.CLIENT_URL || 'http://localhost:5000';
};

// @desc    Create new exchange request
// @route   POST /api/exchanges
// @access  Private
exports.createExchange = async (req, res, next) => {
  try {
    const { provider_id, requested_skill, offered_skill } = req.body;

    // Validate input
    if (!provider_id || !requested_skill || !offered_skill) {
      return res.status(400).json({
        success: false,
        message: 'Please provide provider_id, requested_skill, and offered_skill'
      });
    }

    // Validate ID format
    if (provider_id.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider ID format'
      });
    }

    // Validate skill names
    if (!requested_skill.trim() || !offered_skill.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Skill names cannot be empty'
      });
    }

    // Check if same user
    if (provider_id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot exchange skills with yourself'
      });
    }

    // Check if provider exists
    const provider = await User.findById(provider_id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Create exchange
    const exchange = await Exchange.create({
      requester_id: req.user._id,
      provider_id,
      requested_skill: requested_skill.trim(),
      offered_skill: offered_skill.trim(),
      status: 'pending'
    });

    // Populate user data with null checks
    if (exchange.requester_id) {
      await exchange.populate('requester_id', 'name email avatar rating total_exchanges');
    }
    if (exchange.provider_id) {
      await exchange.populate('provider_id', 'name email avatar rating total_exchanges');
    }

    // Create conversation
    await Conversation.create({
      participants: [req.user._id, provider_id],
      exchange_id: exchange._id
    });

    // Send email notification to provider (non-blocking)
    if (provider.email && provider.emailNotifications && provider.emailNotifications.exchangeRequests) {
      sendEmail(provider.email, 'exchangeRequest', {
        providerName: provider.name || 'User',
        requesterName: req.user.name || 'Someone',
        requestedSkill: requested_skill.trim(),
        offeredSkill: offered_skill.trim(),
        requesterExchanges: req.user.total_exchanges || 0,
        requesterRating: (req.user.rating || 0).toFixed(1),
        dashboardUrl: `${getBaseUrl()}/#exchanges`
      }).catch(err => console.error('Exchange request email error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Exchange request created successfully',
      exchange
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all exchanges for current user
// @route   GET /api/exchanges
// @access  Private
exports.getUserExchanges = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = {
      $or: [
        { requester_id: req.user._id },
        { provider_id: req.user._id }
      ]
    };

    if (status) {
      query.status = status;
    }

    const exchanges = await Exchange.find(query)
      .populate('requester_id', 'name email avatar rating')
      .populate('provider_id', 'name email avatar rating')
      .populate('requested_skill', 'name description') // Populate requested skill
      .populate('offered_skill', 'name description') // Populate offered skill
      .populate('learningPathId') // Legacy field
      .populate('requester_learningPathId') // Requester's learning path
      .populate('provider_learningPathId') // Provider's learning path
      .sort({ created_date: -1 });

    res.status(200).json({
      success: true,
      count: exchanges.length,
      exchanges
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get exchange by ID
// @route   GET /api/exchanges/:id
// @access  Private
exports.getExchangeById = async (req, res, next) => {
  try {
    const exchange = await Exchange.findById(req.params.id)
      .populate('requester_id', 'name email avatar rating')
      .populate('provider_id', 'name email avatar rating')
      .populate('requested_skill', 'name description') // Populate requested skill
      .populate('offered_skill', 'name description') // Populate offered skill
      .populate('learningPathId') // Legacy field
      .populate('requester_learningPathId') // Requester's learning path
      .populate('provider_learningPathId'); // Provider's learning path

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Check if user is part of the exchange
    if (
      exchange.requester_id._id.toString() !== req.user._id.toString() &&
      exchange.provider_id._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this exchange'
      });
    }

    // Create response with consistent field naming for frontend
    const exchangeData = exchange.toObject();
    
    // Add aliases for frontend compatibility
    exchangeData.requesterId = exchangeData.requester_id?._id;
    exchangeData.requester = exchangeData.requester_id;
    exchangeData.responderId = exchangeData.provider_id?._id;
    exchangeData.responder = exchangeData.provider_id;
    exchangeData.skillRequested = exchangeData.requested_skill;
    exchangeData.skillOffered = exchangeData.offered_skill;

    res.status(200).json({
      success: true,
      exchange: exchangeData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check learning completion status for both paths
// @route   GET /api/exchanges/:id/completion-status
// @access  Private
exports.checkLearningCompletion = async (req, res, next) => {
  try {
    const exchange = await Exchange.findById(req.params.id)
      .populate('requester_learningPathId')
      .populate('provider_learningPathId');

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Check authorization
    if (
      exchange.requester_id.toString() !== req.user._id.toString() &&
      exchange.provider_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this exchange'
      });
    }

    const requesterPath = exchange.requester_learningPathId;
    const providerPath = exchange.provider_learningPathId;

    // Get completion status
    const requesterCompleted = requesterPath && requesterPath.status === 'completed';
    const providerCompleted = providerPath && providerPath.status === 'completed';
    const bothCompleted = requesterCompleted && providerCompleted;

    // Calculate progress for each path
    const requesterProgress = requesterPath ? {
      completed: requesterPath.completedModules || 0,
      total: requesterPath.totalModules || 0,
      percentage: requesterPath.progressPercentage || 0,
      status: requesterPath.status || 'not-started',
      isComplete: requesterCompleted
    } : null;

    const providerProgress = providerPath ? {
      completed: providerPath.completedModules || 0,
      total: providerPath.totalModules || 0,
      percentage: providerPath.progressPercentage || 0,
      status: providerPath.status || 'not-started',
      isComplete: providerCompleted
    } : null;

    res.status(200).json({
      success: true,
      completionStatus: {
        requesterCompleted,
        providerCompleted,
        bothCompleted,
        exchangeStatus: exchange.status,
        readyForRating: exchange.status === 'completed',
        requesterProgress,
        providerProgress,
        message: bothCompleted && exchange.status === 'completed'
          ? '🎉 Both completed! Time to rate each other.'
          : bothCompleted
          ? '✅ Both learning paths complete! Exchange will be marked complete shortly.'
          : `⏳ Waiting ${!requesterCompleted ? 'for requester' : 'for provider'} to complete`
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update exchange status
// @route   PUT /api/exchanges/:id/status
// @access  Private
exports.updateExchangeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide status'
      });
    }

    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Check authorization
    if (
      exchange.requester_id.toString() !== req.user._id.toString() &&
      exchange.provider_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this exchange'
      });
    }

    await exchange.updateStatus(status);

    // Populate user data for email notifications
    await exchange.populate('requester_id', 'name email avatar rating total_exchanges emailNotifications');
    await exchange.populate('provider_id', 'name email avatar rating total_exchanges emailNotifications');

    // Send email notifications based on status
    if (status === 'active') {
      // Exchange accepted - CREATE BOTH LEARNING PATHS (one for each person's learning)
      
      // LEARNING PATH 1: Requester learns requested_skill, Provider teaches
      if (!exchange.requester_learningPathId) {
        try {
          console.log(`📚 Creating requester learning path for exchange ${exchange._id}`);
          console.log(`   - Learner: ${exchange.requester_id._id}`);
          console.log(`   - Instructor: ${exchange.provider_id._id}`);
          console.log(`   - Skill to learn: ${exchange.requested_skill}`);
          
          // Try multiple matching strategies for better skill finding
          let skill = await Skill.findOne({ name: exchange.requested_skill });
          if (!skill) {
            skill = await Skill.findOne({ name: { $regex: new RegExp(`^${exchange.requested_skill}$`, 'i') } });
          }
          if (!skill) {
            // Try fuzzy matching - e.g., "REACT JS" should match "React"
            const cleanedSkillName = exchange.requested_skill.replace(/\s+(JS|JAVA|CPP|PY|PROGRAMMING)$/i, '').trim();
            skill = await Skill.findOne({ name: { $regex: new RegExp(`^${cleanedSkillName}`, 'i') } });
          }
          if (!skill) {
            // Try word matching - "Project Management" contains "Management"
            const skillWords = exchange.requested_skill.split(/\s+/).filter(word => word.length > 3);
            for (const word of skillWords) {
              skill = await Skill.findOne({ name: { $regex: new RegExp(word, 'i') } });
              if (skill && skill.videos && skill.videos.length >= 5) break;
            }
          }

          if (!skill || !skill.videos || skill.videos.length < 5) {
            console.warn(`⚠️ Skill "${exchange.requested_skill}" not found with 5 videos`);
          } else {
            console.log(`   ✓ Found skill: ${skill._id}`);
          }

          const modules = [];
          if (skill && skill.videos && skill.videos.length >= 5) {
            // Use exactly 5 videos from the skill
            for (let i = 0; i < 5; i++) {
              modules.push({
                title: skill.videos[i].title || `Module ${i + 1}: ${skill.name}`,
                description: `Learn ${skill.name} - ${skill.videos[i].title || `Part ${i + 1}`}`,
                videoUrl: skill.videos[i].url || '',
                duration: skill.videos[i].duration || 45,
                order: i + 1,
                isCompleted: false
              });
            }
            console.log(`   ✅ Created 5 modules from skill videos`);
          } else {
            // Create 5 default modules if skill not found or has < 5 videos
            for (let i = 0; i < 5; i++) {
              modules.push({
                title: `Module ${i + 1}: ${exchange.requested_skill}`,
                description: `Learn ${exchange.requested_skill} - Part ${i + 1}`,
                videoUrl: '',
                duration: 45,
                order: i + 1,
                isCompleted: false
              });
            }
            console.log(`   ⚠️ Skill not found - created 5 default modules`);
          }

          const requesterPath = new LearningPath({
            exchangeId: exchange._id,
            skillId: skill ? skill._id : new mongoose.Types.ObjectId(),
            learner: exchange.requester_id._id,
            instructor: exchange.provider_id._id,
            modules: modules,
            totalModules: 5,
            completedModules: 0,
            progressPercentage: 0,
            status: 'not-started',
            estimatedDuration: 225 // 5 modules * 45 min
          });

          await requesterPath.save();
          console.log(`✅ Requester learning path created: ${requesterPath._id} (5 modules)`);
          
          exchange.requester_learningPathId = requesterPath._id;
          exchange.learningPathId = requesterPath._id; // Keep legacy field for compatibility
          await exchange.save();
        } catch (lpError) {
          console.error('Error creating requester learning path:', lpError);
        }
      }

      // LEARNING PATH 2: Provider learns offered_skill, Requester teaches
      if (!exchange.provider_learningPathId) {
        try {
          console.log(`📚 Creating provider learning path for exchange ${exchange._id}`);
          console.log(`   - Learner: ${exchange.provider_id._id}`);
          console.log(`   - Instructor: ${exchange.requester_id._id}`);
          console.log(`   - Skill to learn: ${exchange.offered_skill}`);
          
          // Try multiple matching strategies for better skill finding
          let skill = await Skill.findOne({ name: exchange.offered_skill });
          if (!skill) {
            skill = await Skill.findOne({ name: { $regex: new RegExp(`^${exchange.offered_skill}$`, 'i') } });
          }
          if (!skill) {
            // Try fuzzy matching - e.g., "HOME ORGANIZATION" should match "Home Organization"
            const cleanedSkillName = exchange.offered_skill.replace(/\s+(JS|JAVA|CPP|PY|PROGRAMMING)$/i, '').trim();
            skill = await Skill.findOne({ name: { $regex: new RegExp(`^${cleanedSkillName}`, 'i') } });
          }
          if (!skill) {
            // Try word matching
            const skillWords = exchange.offered_skill.split(/\s+/).filter(word => word.length > 3);
            for (const word of skillWords) {
              skill = await Skill.findOne({ name: { $regex: new RegExp(word, 'i') } });
              if (skill && skill.videos && skill.videos.length >= 5) break;
            }
          }

          if (!skill || !skill.videos || skill.videos.length < 5) {
            console.warn(`⚠️ Skill "${exchange.offered_skill}" not found with 5 videos`);
          } else {
            console.log(`   ✓ Found skill: ${skill._id}`);
          }

          const modules = [];
          if (skill && skill.videos && skill.videos.length >= 5) {
            // Use exactly 5 videos from the skill
            for (let i = 0; i < 5; i++) {
              modules.push({
                title: skill.videos[i].title || `Module ${i + 1}: ${skill.name}`,
                description: `Learn ${skill.name} - ${skill.videos[i].title || `Part ${i + 1}`}`,
                videoUrl: skill.videos[i].url || '',
                duration: skill.videos[i].duration || 45,
                order: i + 1,
                isCompleted: false
              });
            }
            console.log(`   ✅ Created 5 modules from skill videos`);
          } else {
            // Create 5 default modules if skill not found or has < 5 videos
            for (let i = 0; i < 5; i++) {
              modules.push({
                title: `Module ${i + 1}: ${exchange.offered_skill}`,
                description: `Learn ${exchange.offered_skill} - Part ${i + 1}`,
                videoUrl: '',
                duration: 45,
                order: i + 1,
                isCompleted: false
              });
            }
            console.log(`   ⚠️ Skill not found - created 5 default modules`);
          }

          const providerPath = new LearningPath({
            exchangeId: exchange._id,
            skillId: skill ? skill._id : new mongoose.Types.ObjectId(),
            learner: exchange.provider_id._id,
            instructor: exchange.requester_id._id,
            modules: modules,
            totalModules: 5,
            completedModules: 0,
            progressPercentage: 0,
            status: 'not-started',
            estimatedDuration: 225 // 5 modules * 45 min
          });

          await providerPath.save();
          console.log(`✅ Provider learning path created: ${providerPath._id} (5 modules)`);
          
          exchange.provider_learningPathId = providerPath._id;
          await exchange.save();
        } catch (lpError) {
          console.error('Error creating provider learning path:', lpError);
        }
      }

      // Exchange accepted - notify requester
      const requester = exchange.requester_id;
      if (requester.emailNotifications && requester.emailNotifications.exchangeAccepted) {
        await sendEmail(requester.email, 'exchangeAccepted', {
          requesterName: requester.name,
          providerName: exchange.provider_id.name,
          requestedSkill: exchange.requested_skill,
          offeredSkill: exchange.offered_skill,
          messagesUrl: `${getBaseUrl()}/#messages`
        });
      }
    }

    // Update user stats and tokens if completed
    if (status === 'completed') {
      const requester = await User.findById(exchange.requester_id);
      const provider = await User.findById(exchange.provider_id);

      // Calculate token rewards based on skill level
      const getTokenReward = (skill) => {
        const rewards = {
          'Beginner': 5,
          'Intermediate': 10,
          'Advanced': 15,
          'Expert': 20
        };
        return rewards[skill] || 10;
      };

      // Reward requester (learned a skill)
      const requesterReward = getTokenReward(exchange.requested_skill);
      await requester.addTokens(
        requesterReward, 
        'earned', 
        `Completed exchange: Learned ${exchange.requested_skill}`,
        exchange._id
      );
      requester.total_exchanges += 1;
      await requester.save();

      // Reward provider (taught a skill)
      const providerReward = getTokenReward(exchange.offered_skill);
      await provider.addTokens(
        providerReward, 
        'earned', 
        `Completed exchange: Taught ${exchange.offered_skill}`,
        exchange._id
      );
      provider.total_exchanges += 1;
      await provider.save();

      // Award badges for milestones
      if (requester.total_exchanges === 1 && !requester.badges.includes('First Exchange')) {
        requester.badges.push('First Exchange');
        await requester.save();
      }
      if (requester.total_exchanges === 5 && !requester.badges.includes('5 Exchanges')) {
        requester.badges.push('5 Exchanges');
        await requester.save();
      }
      if (requester.total_exchanges === 10 && !requester.badges.includes('Exchange Master')) {
        requester.badges.push('Exchange Master');
        await requester.save();
      }

      if (provider.total_exchanges === 1 && !provider.badges.includes('First Exchange')) {
        provider.badges.push('First Exchange');
        await provider.save();
      }
      if (provider.total_exchanges === 5 && !provider.badges.includes('5 Exchanges')) {
        provider.badges.push('5 Exchanges');
        await provider.save();
      }
      if (provider.total_exchanges === 10 && !provider.badges.includes('Exchange Master')) {
        provider.badges.push('Exchange Master');
        await provider.save();
      }

      // Send email notifications about completion
      if (requester.emailNotifications && requester.emailNotifications.exchangeCompleted) {
        await sendEmail(requester.email, 'exchangeCompleted', {
          userName: requester.name,
          otherUserName: provider.name,
          tokensEarned: requesterReward,
          requestedSkill: exchange.requested_skill,
          offeredSkill: exchange.offered_skill,
          badgeEarned: requester.badges[requester.badges.length - 1] !== 'First Exchange' ? null : 'First Exchange',
          ratingUrl: `${getBaseUrl()}/#exchanges`
        });
      }

      if (provider.emailNotifications && provider.emailNotifications.exchangeCompleted) {
        await sendEmail(provider.email, 'exchangeCompleted', {
          userName: provider.name,
          otherUserName: requester.name,
          tokensEarned: providerReward,
          requestedSkill: exchange.requested_skill,
          offeredSkill: exchange.offered_skill,
          badgeEarned: provider.badges[provider.badges.length - 1] !== 'First Exchange' ? null : 'First Exchange',
          ratingUrl: `${getBaseUrl()}/#exchanges`
        });
      }
    }

    // Refresh exchange and populate all references
    const refreshedExchange = await Exchange.findById(exchange._id)
      .populate('requester_id', 'name email avatar rating')
      .populate('provider_id', 'name email avatar rating')
      .populate('learningPathId'); // Populate learning path reference

    console.log(`📤 Returning exchange with learningPathId:`, refreshedExchange.learningPathId);

    res.status(200).json({
      success: true,
      message: `Exchange ${status}`,
      exchange: refreshedExchange
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add message to exchange
// @route   POST /api/exchanges/:id/messages
// @access  Private
exports.addMessage = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide message content'
      });
    }

    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Check authorization
    if (
      exchange.requester_id.toString() !== req.user._id.toString() &&
      exchange.provider_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this exchange'
      });
    }

    await exchange.addMessage(req.user._id, message);

    // Update conversation
    const conversation = await Conversation.findOne({ exchange_id: exchange._id });
    if (conversation) {
      await conversation.updateLastMessage(req.user._id, message);
    }

    await exchange.populate('requester_id', 'name email avatar');
    await exchange.populate('provider_id', 'name email avatar');

    res.status(200).json({
      success: true,
      exchange
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add review to exchange
// @route   POST /api/exchanges/:id/review
// @access  Private
exports.addReview = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const userId = req.user._id;

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rating'
      });
    }

    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    if (exchange.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed exchanges'
      });
    }

    // Determine if the user is requester or provider
    const isRequester = exchange.requester_id.toString() === userId.toString();
    const isProvider = exchange.provider_id.toString() === userId.toString();

    if (!isRequester && !isProvider) {
      return res.status(403).json({
        success: false,
        message: 'You are not part of this exchange'
      });
    }

    // Save rating based on who is rating
    if (isRequester) {
      if (exchange.requester_rating) {
        return res.status(400).json({
          success: false,
          message: 'You have already rated this exchange'
        });
      }
      exchange.requester_rating = rating;
      exchange.requester_review = review || null;
    } else if (isProvider) {
      if (exchange.provider_rating) {
        return res.status(400).json({
          success: false,
          message: 'You have already rated this exchange'
        });
      }
      exchange.provider_rating = rating;
      exchange.provider_review = review || null;
    }

    // Keep legacy fields in sync for backward compatibility
    exchange.rating = rating;
    if (review) {
      exchange.review = review;
    }

    await exchange.save();

    // Determine whose rating to update - the person being rated is the "other" person
    const ratedPersonId = isRequester ? exchange.provider_id : exchange.requester_id;
    const ratedPerson = await User.findById(ratedPersonId);

    // Calculate average rating for the person being rated
    const allRatingsForPerson = await Exchange.find({
      $or: [
        { provider_id: ratedPersonId, requester_rating: { $exists: true } },
        { requester_id: ratedPersonId, provider_rating: { $exists: true } }
      ]
    });

    const totalRating = allRatingsForPerson.reduce((sum, ex) => {
      if (ex.provider_id.toString() === ratedPersonId.toString()) {
        return sum + (ex.requester_rating || 0);
      } else {
        return sum + (ex.provider_rating || 0);
      }
    }, 0);

    const ratingCount = allRatingsForPerson.filter(ex => {
      if (ex.provider_id.toString() === ratedPersonId.toString()) {
        return ex.requester_rating;
      } else {
        return ex.provider_rating;
      }
    }).length;

    if (ratingCount > 0) {
      const avgRating = totalRating / ratingCount;
      ratedPerson.rating = Math.round(avgRating * 10) / 10;
      await ratedPerson.save();
    }

    // Send email notification about new rating
    if (ratedPerson.emailNotifications && ratedPerson.emailNotifications.newRatings) {
      const ratingGiver = await User.findById(userId);
      await sendEmail(ratedPerson.email, 'newRating', {
        providerName: ratedPerson.name,
        requesterName: ratingGiver.name,
        rating: rating,
        review: review || null,
        requestedSkill: exchange.requested_skill,
        offeredSkill: exchange.offered_skill,
        newAverageRating: ratedPerson.rating.toFixed(1),
        totalRatings: ratingCount,
        profileUrl: `${getBaseUrl()}/#profile`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Review added successfully',
      exchange
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete exchange
// @route   DELETE /api/exchanges/:id
// @access  Private
exports.deleteExchange = async (req, res, next) => {
  try {
    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Only requester can delete if status is pending
    if (exchange.status !== 'pending' || exchange.requester_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this exchange'
      });
    }

    await exchange.deleteOne();

    // Delete associated conversation
    await Conversation.deleteOne({ exchange_id: exchange._id });

    res.status(200).json({
      success: true,
      message: 'Exchange deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get skills learned by user (completed exchanges where user was requester)
// @route   GET /api/exchanges/learned
// @access  Private
exports.getLearnedSkills = async (req, res, next) => {
  try {
    // Get all completed exchanges where current user was the requester (learner)
    const learnedExchanges = await Exchange.find({
      requester_id: req.user._id,
      status: 'completed'
    })
      .populate('provider_id', 'name email avatar rating total_exchanges')
      .sort({ completed_date: -1 });

    // Format the learned skills data (filter out exchanges with deleted users)
    const learnedSkills = learnedExchanges
      .filter(exchange => exchange.provider_id) // Skip if provider was deleted
      .map(exchange => ({
        skill: exchange.requested_skill,
        teacher: {
          id: exchange.provider_id._id,
          name: exchange.provider_id.name,
          avatar: exchange.provider_id.avatar,
          rating: exchange.provider_id.rating
        },
        completedDate: exchange.completed_date,
        rating: exchange.rating,
        review: exchange.review,
        sessionsCompleted: exchange.sessions_completed,
        totalHours: exchange.total_hours
      }));

    res.status(200).json({
      success: true,
      count: learnedSkills.length,
      learnedSkills
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get skills taught by user (completed exchanges where user was provider)
// @route   GET /api/exchanges/taught
// @access  Private
exports.getTaughtSkills = async (req, res, next) => {
  try {
    // Get all completed exchanges where current user was the provider (teacher)
    const taughtExchanges = await Exchange.find({
      provider_id: req.user._id,
      status: 'completed'
    })
      .populate('requester_id', 'name email avatar rating total_exchanges')
      .sort({ completed_date: -1 });

    // Format the taught skills data (filter out exchanges with deleted users)
    const taughtSkills = taughtExchanges
      .filter(exchange => exchange.requester_id) // Skip if requester was deleted
      .map(exchange => ({
        skill: exchange.offered_skill,
        student: {
          id: exchange.requester_id._id,
          name: exchange.requester_id.name,
          avatar: exchange.requester_id.avatar,
          rating: exchange.requester_id.rating
        },
        completedDate: exchange.completed_date,
        rating: exchange.rating,
        review: exchange.review,
        sessionsCompleted: exchange.sessions_completed,
        totalHours: exchange.total_hours
      }));

    res.status(200).json({
      success: true,
      count: taughtSkills.length,
      taughtSkills
    });
  } catch (error) {
    next(error);
  }
};

