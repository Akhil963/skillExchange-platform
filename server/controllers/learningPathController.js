const LearningPath = require('../models/LearningPath');
const Exchange = require('../models/Exchange');
const Skill = require('../models/Skill');
const User = require('../models/User');

// Admin: Get all learning paths
exports.getAllLearningPaths = async (req, res, next) => {
  try {
    const learningPaths = await LearningPath.find()
      .populate('learner', 'name email avatar')
      .populate('instructor', 'name email avatar')
      .populate('skillId', 'name category')
      .populate('exchangeId')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: learningPaths.length,
      learningPaths
    });
  } catch (error) {
    next(error);
  }
};

// Create a new learning path for an exchange
exports.createLearningPath = async (req, res) => {
  try {
    const { exchangeId, skillId, learner, instructor } = req.body;

    // Validate exchange exists
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    // Validate skill exists and get its videos
    const skill = await Skill.findById(skillId).populate('videos');
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    // Check if learning path already exists for this exchange
    const existingPath = await LearningPath.findOne({ exchangeId });
    if (existingPath) {
      return res.status(400).json({ message: 'Learning path already exists for this exchange' });
    }

    // Get videos for this skill
    const videos = skill.videos || [];
    
    // Create modules from skill videos
    const modules = [];
    let totalDuration = 0;

    if (videos.length > 0) {
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const duration = video.duration || 0;
        totalDuration += duration;
        
        // Store video data directly in module (not as reference)
        modules.push({
          title: video.title || `Module ${i + 1}`,
          description: `Learn ${skill.name}`,
          videoUrl: video.url,  // YouTube URL
          videoTitle: video.title,
          duration: duration,
          order: video.order || i + 1,
          isCompleted: false
        });
      }
    }

    // If no videos, create a default module for the skill
    if (modules.length === 0) {
      modules.push({
        title: `Learn ${skill.name}`,
        description: `Master the fundamentals of ${skill.name}`,
        order: 1,
        isCompleted: false
      });
    }

    const learningPath = new LearningPath({
      exchangeId,
      skillId,
      learner,
      instructor,
      modules,
      totalModules: modules.length,
      completedModules: 0,
      progressPercentage: 0,
      status: 'not-started',
      estimatedDuration: totalDuration
    });

    await learningPath.save();

    // Populate references
    await learningPath.populate(['learner', 'instructor', 'skillId']);

    res.status(201).json({
      message: 'Learning path created successfully',
      learningPath
    });
  } catch (error) {
    console.error('Create learning path error:', error);
    res.status(500).json({
      message: 'Error creating learning path',
      error: error.message
    });
  }
};

// Get all learning paths for a user (as learner or instructor)
exports.getUserLearningPaths = async (req, res) => {
  try {
    const userId = req.params.userId;
    const role = req.query.role; // 'learner' or 'instructor'
    const currentUserId = req.user._id.toString();

    // SECURITY: Only allow users to fetch their own learning paths (unless admin)
    if (userId !== currentUserId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these learning paths'
      });
    }

    let query = {};
    if (role === 'learner') {
      query.learner = userId;
    } else if (role === 'instructor') {
      query.instructor = userId;
    } else {
      // Return both learner and instructor paths
      query = {
        $or: [{ learner: userId }, { instructor: userId }]
      };
    }

    const learningPaths = await LearningPath.find(query)
      .populate('learner', 'name avatar')
      .populate('instructor', 'name avatar')
      .populate('skillId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      total: learningPaths.length,
      learningPaths
    });
  } catch (error) {
    console.error('Get user learning paths error:', error);
    res.status(500).json({
      message: 'Error fetching learning paths',
      error: error.message
    });
  }
};

// Helper function to create a learning path for an exchange
async function createLearningPathForExchange(exchangeId, learner, instructor, skillName, isRequester) {
  try {
    console.log(`🔧 Creating ${isRequester ? 'requester' : 'provider'} learning path for skill: ${skillName}...`);
    
    // Find the skill - try multiple matching strategies for better results
    let skill = await Skill.findOne({ name: skillName });
    if (!skill) {
      skill = await Skill.findOne({ name: { $regex: new RegExp(`^${skillName}$`, 'i') } });
    }
    if (!skill) {
      // Try partial match - e.g., "REACT JS" should match "React"
      const cleanedSkillName = skillName.replace(/\s+(JS|JAVA|CPP|PY)$/i, '').trim();
      skill = await Skill.findOne({ name: { $regex: new RegExp(cleanedSkillName, 'i') } });
    }
    if (!skill) {
      // Try finding by word - "Project Management" contains "Management"
      const skillWords = skillName.split(/\s+/);
      for (const word of skillWords) {
        if (word.length > 3) {
          skill = await Skill.findOne({ name: { $regex: new RegExp(word, 'i') } });
          if (skill) break;
        }
      }
    }
    
    console.log(`   Skill found: ${skill ? '✅ ' + skill.name : '❌ Not found'}`);
    if (skill && skill.videos) {
      console.log(`   Videos available: ${skill.videos.length}`);
    }

    const modules = [];
    let totalDuration = 0;

    // Add modules from skill videos if available
    if (skill && skill.videos && skill.videos.length > 0) {
      skill.videos.forEach((video, index) => {
        modules.push({
          title: video.title || `Module ${index + 1}: ${skill.name}`,
          description: `Learn ${skill.name}`,
          videoUrl: video.url || '',
          videoTitle: video.title || '',
          duration: video.duration || 45,
          order: index + 1,
          isCompleted: false
        });
        totalDuration += video.duration || 45;
      });
      console.log(`   ✅ Created ${modules.length} modules from skill videos`);
    } else {
      // Create a default module if no skill videos found
      modules.push({
        title: `Learn ${skillName}`,
        description: `Master the fundamentals of ${skillName}`,
        videoUrl: '',
        duration: 45,
        order: 1,
        isCompleted: false
      });
      totalDuration = 45;
      console.log(`   ⚠️  No videos found - created default module`);
    }

    const lp = new LearningPath({
      exchangeId: exchangeId,
      skillId: skill ? skill._id : null,  // Set to null instead of orphaned ObjectId
      skillName: skill ? skill.name : skillName, // Store actual skill name for reference
      learner: learner,
      instructor: instructor,
      modules: modules,
      totalModules: modules.length,
      completedModules: 0,
      progressPercentage: 0,
      status: 'in-progress',
      estimatedDuration: totalDuration
    });

    await lp.save();
    console.log(`✅ Created ${isRequester ? 'requester' : 'provider'} path: ${lp._id}`);
    console.log(`   Total modules: ${lp.totalModules}, Duration: ${totalDuration} min`);
    return lp._id;
  } catch (error) {
    console.error(`❌ Error creating learning path:`, error.message);
    return null;
  }
}

// Get the correct learning path for an exchange based on current user
exports.getLearningPathsByExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const currentUserId = req.user._id.toString();

    console.log(`\n🎯 Getting learning path for exchange: ${exchangeId}`);
    console.log(`   Current user: ${currentUserId}`);

    // Get the exchange with all data
    const exchange = await Exchange.findById(exchangeId)
      .populate('requester_id', '_id name email')
      .populate('provider_id', '_id name email')
      .populate('requester_learningPathId')
      .populate('provider_learningPathId');

    if (!exchange) {
      console.error(`❌ Exchange ${exchangeId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    console.log(`✅ Exchange found:`);
    console.log(`   Requester: ${exchange.requester_id.name}`);
    console.log(`   Provider: ${exchange.provider_id.name}`);
    console.log(`   Requested skill: ${exchange.requested_skill}`);
    console.log(`   Offered skill: ${exchange.offered_skill}`);

    // Determine user role
    const isRequester = exchange.requester_id._id.toString() === currentUserId;
    const isProvider = exchange.provider_id._id.toString() === currentUserId;

    console.log(`   User role: ${isRequester ? 'REQUESTER' : isProvider ? 'PROVIDER' : 'NOT_PART_OF_EXCHANGE'}`);

    if (!isRequester && !isProvider) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this exchange'
      });
    }

    // Select appropriate learning path
    let learningPathId = null;
    let skillToLearn = null;
    let role = null;

    if (isRequester) {
      learningPathId = exchange.requester_learningPathId?._id;
      skillToLearn = exchange.requested_skill;
      role = 'requester';
      console.log(`   Learning: ${skillToLearn}`);
      console.log(`   Path exists: ${learningPathId ? '✅' : '❌'}`);
    } else {
      learningPathId = exchange.provider_learningPathId?._id;
      skillToLearn = exchange.offered_skill;
      role = 'provider';
      console.log(`   Learning: ${skillToLearn}`);
      console.log(`   Path exists: ${learningPathId ? '✅' : '❌'}`);
    }

    // If learning path doesn't exist, create it
    if (!learningPathId) {
      console.log(`\n🔨 Creating missing learning path for ${role}...`);
      
      if (isRequester) {
        learningPathId = await createLearningPathForExchange(
          exchangeId,
          exchange.requester_id._id,
          exchange.provider_id._id,
          exchange.requested_skill,
          true
        );
        if (learningPathId) {
          exchange.requester_learningPathId = learningPathId;
          await exchange.save();
        }
      } else {
        learningPathId = await createLearningPathForExchange(
          exchangeId,
          exchange.provider_id._id,
          exchange.requester_id._id,
          exchange.offered_skill,
          false
        );
        if (learningPathId) {
          exchange.provider_learningPathId = learningPathId;
          await exchange.save();
        }
      }
    }

    // Get the learning path
    let learningPath = await LearningPath.findById(learningPathId)
      .populate('learner', 'name avatar email')
      .populate('instructor', 'name avatar email')
      .populate('skillId', 'name description');

    if (!learningPath) {
      console.error(`❌ Learning path ${learningPathId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Could not create or retrieve learning path',
        debug: {
          exchange_id: exchangeId,
          role: role,
          skill: skillToLearn
        }
      });
    }

    console.log(`✅ Learning path ready: ${learningPath._id}`);
    console.log(`   Learner: ${learningPath.learner.name}`);
    console.log(`   Instructor: ${learningPath.instructor.name}`);
    console.log(`   Modules: ${learningPath.totalModules}`);

    res.status(200).json({
      success: true,
      learningPath,
      exchangeInfo: {
        exchange_id: exchange._id,
        user_role: `${role} (learning ${skillToLearn})`,
        requested_skill: exchange.requested_skill,
        offered_skill: exchange.offered_skill,
        requester: exchange.requester_id.name,
        provider: exchange.provider_id.name
      }
    });
  } catch (error) {
    console.error('❌ Get learning paths by exchange error:', error.message);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching learning path for exchange',
      error: error.message
    });
  }
};

// Debug endpoint: Check status of both learning paths in an exchange
exports.debugExchangeLearningPaths = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const currentUserId = req.user._id.toString();

    console.log(`\n🔍 DEBUG: Checking learning paths for exchange: ${exchangeId}`);

    const exchange = await Exchange.findById(exchangeId)
      .populate('requester_id', '_id name email')
      .populate('provider_id', '_id name email');

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: 'Exchange not found'
      });
    }

    // Get both learning paths
    const requesterPath = exchange.requester_learningPathId 
      ? await LearningPath.findById(exchange.requester_learningPathId).select('_id learner instructor totalModules status')
      : null;

    const providerPath = exchange.provider_learningPathId 
      ? await LearningPath.findById(exchange.provider_learningPathId).select('_id learner instructor totalModules status')
      : null;

    const isRequester = exchange.requester_id._id.toString() === currentUserId;
    const isProvider = exchange.provider_id._id.toString() === currentUserId;

    res.status(200).json({
      success: true,
      currentUser: {
        id: currentUserId,
        role: isRequester ? 'requester' : isProvider ? 'provider' : 'not-part-of-exchange'
      },
      exchange: {
        id: exchange._id,
        status: exchange.status,
        requester: {
          name: exchange.requester_id.name,
          email: exchange.requester_id.email
        },
        provider: {
          name: exchange.provider_id.name,
          email: exchange.provider_id.email
        },
        requestedSkill: exchange.requested_skill,
        offeredSkill: exchange.offered_skill
      },
      learningPaths: {
        requesterPath: {
          exists: requesterPath ? 'YES ✅' : 'NO ❌',
          id: requesterPath?._id || 'null',
          learner: requesterPath?.learner?.toString() || 'null',
          instructor: requesterPath?.instructor?.toString() || 'null',
          totalModules: requesterPath?.totalModules || 0,
          status: requesterPath?.status || 'N/A',
          learning: exchange.requested_skill
        },
        providerPath: {
          exists: providerPath ? 'YES ✅' : 'NO ❌',
          id: providerPath?._id || 'null',
          learner: providerPath?.learner?.toString() || 'null',
          instructor: providerPath?.instructor?.toString() || 'null',
          totalModules: providerPath?.totalModules || 0,
          status: providerPath?.status || 'N/A',
          learning: exchange.offered_skill
        }
      }
    });
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error debugging exchange learning paths',
      error: error.message
    });
  }
};

// Get a specific learning path
exports.getLearningPath = async (req, res) => {
  try {
    const { learningPathId } = req.params;
    const currentUserId = req.user._id.toString();

    console.log(`📖 Attempting to fetch learning path: ${learningPathId}`);
    console.log(`   Current User: ${currentUserId}`);

    // Validate that learningPathId is provided and is not "undefined"
    if (!learningPathId || learningPathId === 'undefined') {
      console.error('❌ Invalid learningPathId:', learningPathId);
      return res.status(400).json({ 
        success: false,
        message: 'Learning path ID is required and must be valid' 
      });
    }

    const learningPath = await LearningPath.findById(learningPathId)
      .populate('learner', 'name avatar email')
      .populate('instructor', 'name avatar email')
      .populate('skillId', 'name description');
    // Note: modules are embedded documents with video data stored directly (videoUrl, videoTitle, duration)
    // No need to populate modules.videoId as it doesn't exist - video data is embedded in each module

    if (!learningPath) {
      console.error(`❌ Learning path not found for ID: ${learningPathId}`);
      // Check if any learning path exists to help debug
      const allPaths = await LearningPath.find().limit(3);
      console.log(`📊 Sample learning paths in DB:`, allPaths.map(p => ({ id: p._id, exchange: p.exchangeId })));
      
      return res.status(404).json({ 
        success: false,
        message: 'Learning path not found' 
      });
    }

    // CRITICAL: Verify current user is either the LEARNER or INSTRUCTOR
    const isLearner = learningPath.learner._id.toString() === currentUserId;
    const isInstructor = learningPath.instructor._id.toString() === currentUserId;
    
    if (!isLearner && !isInstructor) {
      console.error(`❌ Unauthorized learning path access!`);
      console.error(`   Learning Path: ${learningPathId}`);
      console.error(`   Path Learner: ${learningPath.learner._id}`);
      console.error(`   Path Instructor: ${learningPath.instructor._id}`);
      console.error(`   Current User: ${currentUserId}`);
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized: You can only access learning paths where you are the learner or instructor',
        error: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`✅ Learning path found:`, learningPath._id);
    console.log(`   User role: ${isLearner ? 'LEARNER' : 'INSTRUCTOR'}`);
    
    res.status(200).json({
      success: true,
      learningPath,
      userRole: isLearner ? 'learner' : 'instructor'
    });
  } catch (error) {
    console.error('Get learning path error:', error);
    res.status(500).json({
      message: 'Error fetching learning path',
      error: error.message
    });
  }
};

// Mark a module as completed
exports.completeModule = async (req, res) => {
  try {
    const { learningPathId, moduleId } = req.params;
    const { score, notes } = req.body;
    const currentUserId = req.user._id.toString();

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    // CRITICAL: Verify current user is the LEARNER of this path
    if (learningPath.learner.toString() !== currentUserId) {
      console.error(`❌ Unauthorized module completion attempt!`);
      console.error(`   Learning Path: ${learningPathId}`);
      console.error(`   Path Learner: ${learningPath.learner}`);
      console.error(`   Current User: ${currentUserId}`);
      return res.status(403).json({ 
        message: 'Unauthorized: You can only complete modules in your own learning path',
        error: 'WRONG_LEARNER'
      });
    }

    console.log(`✅ Module completion authorized:`);
    console.log(`   User ${currentUserId} completing module in their own learning path`);

    // Find and update the module
    const moduleIndex = learningPath.modules.findIndex(m => m.moduleId.toString() === moduleId);
    if (moduleIndex === -1) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const module = learningPath.modules[moduleIndex];
    module.isCompleted = true;
    module.completedAt = new Date();
    if (score !== undefined) {
      module.score = Math.min(Math.max(score, 0), 100); // Ensure 0-100
    }
    if (notes !== undefined) {
      module.notes = notes;
    }

    // Update learning path statistics
    const completedCount = learningPath.modules.filter(m => m.isCompleted).length;
    learningPath.completedModules = completedCount;
    learningPath.progressPercentage = Math.round((completedCount / learningPath.totalModules) * 100);

    // Update status if not already started
    if (learningPath.status === 'not-started') {
      learningPath.status = 'in-progress';
      learningPath.startedAt = new Date();
    }

    // Calculate average score if all modules have scores
    const scoredModules = learningPath.modules.filter(m => m.score !== undefined);
    if (scoredModules.length > 0) {
      learningPath.averageScore = Math.round(
        scoredModules.reduce((sum, m) => sum + m.score, 0) / scoredModules.length
      );
    }

    // Mark as completed if all modules are done
    if (learningPath.progressPercentage === 100) {
      learningPath.status = 'completed';
      learningPath.completedAt = new Date();
      
      // Calculate actual duration
      const startTime = learningPath.startedAt || learningPath.createdAt;
      learningPath.actualDuration = Math.round((new Date() - startTime) / 60000); // in minutes
      
      console.log(`✅ User completed their learning path: ${learningPath._id}`);
    }

    // Save the current learning path FIRST
    await learningPath.save();

    // THEN check if BOTH learning paths are completed (after saving)
    if (learningPath.progressPercentage === 100) {
      try {
        const exchange = await Exchange.findById(learningPath.exchangeId)
          .populate('requester_learningPathId')
          .populate('provider_learningPathId');
        
        if (exchange) {
          // Fetch fresh data from database to ensure accuracy
          const requesterPath = await LearningPath.findById(exchange.requester_learningPathId?._id);
          const providerPath = await LearningPath.findById(exchange.provider_learningPathId?._id);
          
          const requesterComplete = requesterPath?.status === 'completed';
          const providerComplete = providerPath?.status === 'completed';
          
          console.log(`   Checking exchange ${exchange._id} completion status:`);
          console.log(`   - Requester path: ${requesterComplete ? '✅ Complete' : '⏳ In progress'} (${requesterPath?.completedModules}/${requesterPath?.totalModules})`);
          console.log(`   - Provider path: ${providerComplete ? '✅ Complete' : '⏳ In progress'} (${providerPath?.completedModules}/${providerPath?.totalModules})`);
          
          // Only mark exchange as completed if BOTH paths are done
          if (requesterComplete && providerComplete) {
            exchange.status = 'completed';
            exchange.learningCompleted = true;
            exchange.learningCompletedAt = new Date();
            exchange.completed_date = new Date();
            await exchange.save();
            
            console.log(`🎉 BOTH users completed! Exchange ${exchange._id} marked as COMPLETED`);
          } else {
            console.log(`⏳ Waiting for other user to complete their learning path`);
            // Keep exchange as 'active' so the other user can still learn
            if (exchange.status !== 'active') {
              exchange.status = 'active';
              await exchange.save();
            }
          }
        }
      } catch (exchangeError) {
        console.error('Error checking/updating exchange completion:', exchangeError);
      }
    }

    res.status(200).json({
      message: 'Module completed successfully',
      learningPath,
      completionCheckDone: true
    });
  } catch (error) {
    console.error('Complete module error:', error);
    res.status(500).json({
      message: 'Error completing module',
      error: error.message
    });
  }
};

// Get module details
exports.getModuleDetails = async (req, res) => {
  try {
    const { learningPathId, moduleId } = req.params;

    const learningPath = await LearningPath.findById(learningPathId);
    // Note: Video data is embedded in modules (videoUrl, videoTitle, duration)
    // No need to populate modules.videoId as it's now embedded data

    if (!learningPath) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    // Use findIndex to get the correct index
    const moduleIndex = learningPath.modules.findIndex(m => m.moduleId && m.moduleId.toString() === moduleId);
    if (moduleIndex === -1) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const module = learningPath.modules[moduleIndex];

    // Verify module exists before using it
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const moduleWithDetails = {
      ...module.toObject(),
      video: {
        title: module.videoTitle,
        url: module.videoUrl,
        duration: module.duration
      },
      progress: {
        currentModule: moduleIndex + 1,
        totalModules: learningPath.totalModules,
        isCompleted: module.isCompleted,
        completedModules: learningPath.completedModules
      }
    };

    res.status(200).json(moduleWithDetails);
  } catch (error) {
    console.error('Get module details error:', error);
    res.status(500).json({
      message: 'Error fetching module details',
      error: error.message
    });
  }
};

// Admin: Get module details (no user validation)
exports.getModuleDetailsAdmin = async (req, res) => {
  try {
    const { learningPathId, moduleId } = req.params;

    const learningPath = await LearningPath.findById(learningPathId)
      .populate('learner', 'fullName email')
      .populate('instructor', 'fullName email')
      .populate('skillId', 'name category level');

    if (!learningPath) {
      return res.status(404).json({ 
        success: false,
        message: 'Learning path not found' 
      });
    }

    const module = learningPath.modules.find(m => m._id.toString() === moduleId);
    if (!module) {
      return res.status(404).json({ 
        success: false,
        message: 'Module not found' 
      });
    }

    // Safely convert module to object with null check
    res.status(200).json({
      success: true,
      module: module ? module.toObject() : null
    });
  } catch (error) {
    console.error('Get module details (admin) error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching module details',
      error: error.message
    });
  }
};

// Mark a module as incomplete
exports.incompleteModule = async (req, res) => {
  try {
    const { learningPathId, moduleId } = req.params;
    const currentUserId = req.user._id.toString();

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    // CRITICAL: Verify current user is the LEARNER of this path
    if (learningPath.learner.toString() !== currentUserId) {
      console.error(`❌ Unauthorized module incomplete attempt!`);
      console.error(`   Learning Path: ${learningPathId}`);
      console.error(`   Path Learner: ${learningPath.learner}`);
      console.error(`   Current User: ${currentUserId}`);
      return res.status(403).json({ 
        message: 'Unauthorized: You can only modify modules in your own learning path',
        error: 'WRONG_LEARNER'
      });
    }

    // Find and verify module exists
    const moduleIndex = learningPath.modules.findIndex(m => m.moduleId && m.moduleId.toString() === moduleId);
    if (moduleIndex === -1) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const module = learningPath.modules[moduleIndex];
    
    // Verify module object exists
    if (!module) {
      return res.status(404).json({ message: 'Module not accessible' });
    }
    
    module.isCompleted = false;
    module.completedAt = undefined;
    module.score = undefined;

    // Update learning path statistics
    const completedCount = learningPath.modules.filter(m => m.isCompleted).length;
    learningPath.completedModules = completedCount;
    learningPath.progressPercentage = Math.round((completedCount / learningPath.totalModules) * 100);

    // Reset status if needed
    if (learningPath.status === 'completed') {
      learningPath.status = 'in-progress';
      learningPath.completedAt = undefined;
      
      console.log(`↩️  User uncompleted their learning path: ${learningPath._id}`);
      
      // Always revert exchange to active if any path is incomplete
      const exchange = await Exchange.findById(learningPath.exchangeId);
      if (exchange && exchange.status === 'completed') {
        exchange.status = 'active';
        exchange.learningCompleted = false;
        exchange.learningCompletedAt = undefined;
        await exchange.save();
        
        console.log(`↩️  Exchange ${learningPath.exchangeId} reverted to ACTIVE (one path incomplete)`);
      }
    }

    // Recalculate average score
    const scoredModules = learningPath.modules.filter(m => m.score !== undefined);
    if (scoredModules.length > 0) {
      learningPath.averageScore = Math.round(
        scoredModules.reduce((sum, m) => sum + m.score, 0) / scoredModules.length
      );
    } else {
      learningPath.averageScore = undefined;
    }

    await learningPath.save();

    res.status(200).json({
      message: 'Module marked as incomplete',
      learningPath
    });
  } catch (error) {
    console.error('Incomplete module error:', error);
    res.status(500).json({
      message: 'Error marking module as incomplete',
      error: error.message
    });
  }
};

// Get learning path progress
exports.getProgress = async (req, res) => {
  try {
    const { learningPathId } = req.params;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    const progress = {
      learningPathId: learningPath._id,
      status: learningPath.status,
      progressPercentage: learningPath.progressPercentage,
      completedModules: learningPath.completedModules,
      totalModules: learningPath.totalModules,
      averageScore: learningPath.averageScore,
      estimatedDuration: learningPath.estimatedDuration,
      actualDuration: learningPath.actualDuration,
      startedAt: learningPath.startedAt,
      completedAt: learningPath.completedAt,
      modules: learningPath.modules.map(m => ({
        moduleId: m.moduleId,
        title: m.title,
        order: m.order,
        isCompleted: m.isCompleted,
        completedAt: m.completedAt,
        score: m.score
      }))
    };

    res.status(200).json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      message: 'Error fetching progress',
      error: error.message
    });
  }
};

// Complete entire learning path
exports.completeLearning = async (req, res) => {
  try {
    const { learningPathId } = req.params;
    const { feedback } = req.body;
    const currentUserId = req.user._id; // From auth middleware

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    // Check if all modules are completed
    if (learningPath.progressPercentage !== 100) {
      return res.status(400).json({
        message: 'Cannot complete learning path - not all modules are finished',
        progress: learningPath.progressPercentage,
        remaining: learningPath.totalModules - learningPath.completedModules
      });
    }

    learningPath.status = 'completed';
    learningPath.completedAt = new Date();

    // Calculate actual duration if not already set
    if (!learningPath.actualDuration) {
      const startTime = learningPath.startedAt || learningPath.createdAt;
      learningPath.actualDuration = Math.round((new Date() - startTime) / 60000);
    }

    await learningPath.save();

    // Update the exchange to mark the correct learning as complete
    const exchange = await Exchange.findById(learningPath.exchangeId)
      .populate('requester_id', '_id')
      .populate('provider_id', '_id');

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    // Determine if this is requester's or provider's learning path
    const isRequesterPath = exchange.requester_learningPathId && 
                           exchange.requester_learningPathId.toString() === learningPathId;
    const isProviderPath = exchange.provider_learningPathId && 
                          exchange.provider_learningPathId.toString() === learningPathId;

    console.log(`📝 Learning Path Complete: ${learningPathId}`);
    console.log(`   - Is Requester Path: ${isRequesterPath}`);
    console.log(`   - Is Provider Path: ${isProviderPath}`);
    console.log(`   - Requester ID: ${exchange.requester_id._id}`);
    console.log(`   - Provider ID: ${exchange.provider_id._id}`);
    console.log(`   - Current User ID: ${currentUserId}`);

    // Update the appropriate learning completion flags
    if (isRequesterPath) {
      exchange.requester_learningCompleted = true;
      exchange.requester_learningCompletedAt = new Date();
      console.log(`   ✅ Marked requester's learning as complete`);
    } else if (isProviderPath) {
      exchange.provider_learningCompleted = true;
      exchange.provider_learningCompletedAt = new Date();
      console.log(`   ✅ Marked provider's learning as complete`);
    }

    // Check if BOTH learnings are complete - if so, mark exchange as completed
    if (exchange.requester_learningCompleted && exchange.provider_learningCompleted) {
      exchange.status = 'completed';
      exchange.completed_date = new Date();
      exchange.learningCompleted = true; // Legacy field
      exchange.learningCompletedAt = new Date(); // Legacy field
      console.log(`   🎉 BOTH learnings complete! Marking exchange as COMPLETED`);
    } else {
      console.log(`   ⏳ Waiting for other participant to complete their learning`);
      console.log(`      - Requester complete: ${exchange.requester_learningCompleted}`);
      console.log(`      - Provider complete: ${exchange.provider_learningCompleted}`);
    }

    await exchange.save();

    res.status(200).json({
      message: 'Learning path completed successfully',
      learningPath,
      exchange: {
        _id: exchange._id,
        status: exchange.status,
        requester_learningCompleted: exchange.requester_learningCompleted,
        provider_learningCompleted: exchange.provider_learningCompleted,
        completedAt: exchange.completed_date
      }
    });
  } catch (error) {
    console.error('Complete learning error:', error);
    res.status(500).json({
      message: 'Error completing learning path',
      error: error.message
    });
  }
};
// Create learning paths for all active exchanges that don't have one
exports.createMissingLearningPaths = async (req, res) => {
  try {
    const Exchange = require('../models/Exchange');
    const Skill = require('../models/Skill');
    
    console.log('🔧 Starting to create missing learning paths...');
    
    // Find all active exchanges without learning paths
    const activeExchanges = await Exchange.find({
      status: 'active',
      learningPathId: { $exists: false }
    })
      .populate('requester_id', 'name')
      .populate('provider_id', 'name');
    
    console.log(`Found ${activeExchanges.length} active exchanges without learning paths`);
    
    const createdPaths = [];
    
    for (const exchange of activeExchanges) {
      try {
        console.log(`Creating learning path for exchange ${exchange._id}...`);
        
        // Find skill
        let skill = await Skill.findOne({ name: exchange.requested_skill });
        if (!skill) {
          skill = await Skill.findOne({ name: { $regex: exchange.requested_skill, $options: 'i' } });
        }
        
        // Create learning path
        const learningPath = new LearningPath({
          exchangeId: exchange._id,
          skillId: skill ? skill._id : new (require('mongoose')).Types.ObjectId(),
          learner: exchange.requester_id._id,
          instructor: exchange.provider_id._id,
          modules: [],
          totalModules: 0,
          completedModules: 0,
          progressPercentage: 0,
          status: 'not-started',
          estimatedDuration: 0
        });
        
        // Add default module
        learningPath.modules.push({
          title: `Learn ${exchange.requested_skill}`,
          description: `Master the fundamentals of ${exchange.requested_skill}`,
          order: 1,
          isCompleted: false
        });
        learningPath.totalModules = 1;
        
        await learningPath.save();
        
        // Update exchange
        exchange.learningPathId = learningPath._id;
        await exchange.save();
        
        createdPaths.push({
          exchange: exchange._id,
          learningPath: learningPath._id
        });
        
        console.log(`✅ Created learning path ${learningPath._id} for exchange ${exchange._id}`);
      } catch (error) {
        console.error(`❌ Error creating path for exchange ${exchange._id}:`, error.message);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Created ${createdPaths.length} learning paths`,
      createdPaths
    });
  } catch (error) {
    console.error('Create missing learning paths error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating missing learning paths',
      error: error.message
    });
  }
};

// Seed modules and videos for all learning paths
exports.seedModulesForAllPaths = async (req, res) => {
  try {
    console.log('🌱 Starting to seed modules for all learning paths...');
    
    const { seedDemoData } = require('../utils/seedModulesAndVideos');
    const { skillModulesData } = require('../utils/seedModulesAndVideos');
    
    // Get all learning paths
    const learningPaths = await LearningPath.find().populate('skillId');
    console.log(`📚 Found ${learningPaths.length} learning paths to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    const results = [];
    
    for (const lp of learningPaths) {
      try {
        const skillName = lp.skillId?.name;
        
        if (!skillName) {
          console.warn(`⚠️  Skipping learning path - no skill name found`);
          skippedCount++;
          results.push({
            learningPathId: lp._id,
            status: 'skipped',
            reason: 'No skill name found'
          });
          continue;
        }
        
        // Find matching modules for this skill
        const moduleTemplate = skillModulesData[skillName];
        
        if (!moduleTemplate) {
          console.log(`ℹ️  No template found for skill: ${skillName}`);
          skippedCount++;
          results.push({
            learningPathId: lp._id,
            skillName: skillName,
            status: 'skipped',
            reason: 'No module template found'
          });
          continue;
        }
        
        // Create modules from template
        const modules = moduleTemplate.modules.map(mod => ({
          moduleId: new require('mongoose').Types.ObjectId(),
          title: mod.title,
          description: mod.description,
          duration: mod.duration,
          order: mod.order,
          videoTitle: mod.videoTitle,
          isCompleted: false,
          createdAt: new Date()
        }));
        
        // Update learning path
        const totalDuration = modules.reduce((sum, m) => sum + m.duration, 0);
        
        lp.modules = modules;
        lp.totalModules = modules.length;
        lp.estimatedDuration = totalDuration;
        lp.updatedAt = new Date();
        
        await lp.save();
        updatedCount++;
        
        console.log(`✅ Updated ${skillName}: ${modules.length} modules added (${totalDuration} min)`);
        
        results.push({
          learningPathId: lp._id,
          skillName: skillName,
          status: 'updated',
          modulesAdded: modules.length,
          estimatedDuration: totalDuration
        });
      } catch (error) {
        console.error(`❌ Error updating learning path:`, error.message);
        skippedCount++;
        results.push({
          learningPathId: lp._id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   📚 Total: ${learningPaths.length}`);
    
    res.status(200).json({
      success: true,
      message: 'Module seeding completed',
      summary: {
        total: learningPaths.length,
        updated: updatedCount,
        skipped: skippedCount
      },
      results: results
    });
  } catch (error) {
    console.error('Seed modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding modules',
      error: error.message
    });
  }
};

// Admin: Update a module
exports.updateModule = async (req, res) => {
  try {
    const { learningPathId, moduleId } = req.params;
    const updateData = req.body;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    const module = learningPath.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Update module fields
    if (updateData.title) module.title = updateData.title;
    if (updateData.description) module.description = updateData.description;
    if (updateData.duration !== undefined) module.duration = updateData.duration;
    if (updateData.videoUrl) module.videoUrl = updateData.videoUrl;
    if (updateData.order !== undefined) module.order = updateData.order;
    if (updateData.resources) module.resources = updateData.resources;

    // Update estimated duration if module duration changed
    if (updateData.duration !== undefined) {
      const totalDuration = learningPath.modules.reduce((sum, m) => sum + (m.duration || 0), 0);
      learningPath.estimatedDuration = totalDuration;
    }

    learningPath.updatedAt = new Date();
    await learningPath.save();

    res.status(200).json({
      success: true,
      message: 'Module updated successfully',
      module: module,
      learningPath: learningPath
    });
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating module',
      error: error.message
    });
  }
};

// Admin: Delete a module
exports.deleteModule = async (req, res) => {
  try {
    const { learningPathId, moduleId } = req.params;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    // Use moduleId field consistently (not _id) to match the module
    const moduleIndex = learningPath.modules.findIndex(m => m.moduleId && m.moduleId.toString() === moduleId);
    if (moduleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Remove the module
    learningPath.modules.splice(moduleIndex, 1);

    // Update module counts and progress
    learningPath.totalModules = learningPath.modules.length;
    learningPath.completedModules = learningPath.modules.filter(m => m.isCompleted).length;
    learningPath.progressPercentage = learningPath.totalModules > 0 
      ? Math.round((learningPath.completedModules / learningPath.totalModules) * 100) 
      : 0;

    // Recalculate estimated duration
    const totalDuration = learningPath.modules.reduce((sum, m) => sum + (m.duration || 0), 0);
    learningPath.estimatedDuration = totalDuration;

    // Reorder remaining modules
    learningPath.modules.forEach((module, index) => {
      module.order = index + 1;
    });

    learningPath.updatedAt = new Date();
    await learningPath.save();

    res.status(200).json({
      success: true,
      message: 'Module deleted successfully',
      learningPath: learningPath
    });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting module',
      error: error.message
    });
  }
};

// Admin: Add a new module
exports.addModule = async (req, res) => {
  try {
    const { learningPathId } = req.params;
    const { title, description, duration, videoUrl, order, resources } = req.body;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    // Create new module
    const newModule = {
      title: title || 'New Module',
      description: description || '',
      duration: duration || 0,
      videoUrl: videoUrl || '',
      order: order || learningPath.modules.length + 1,
      isCompleted: false,
      resources: resources || []
    };

    learningPath.modules.push(newModule);

    // Update totals
    learningPath.totalModules = learningPath.modules.length;
    learningPath.estimatedDuration = learningPath.modules.reduce((sum, m) => sum + (m.duration || 0), 0);

    learningPath.updatedAt = new Date();
    await learningPath.save();

    res.status(201).json({
      success: true,
      message: 'Module added successfully',
      module: learningPath.modules[learningPath.modules.length - 1],
      learningPath: learningPath
    });
  } catch (error) {
    console.error('Add module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding module',
      error: error.message
    });
  }
};

module.exports = exports;