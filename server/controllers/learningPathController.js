const LearningPath = require('../models/LearningPath');
const LearningMaterial = require('../models/LearningMaterial');
const Exchange = require('../models/Exchange');
const Skill = require('../models/Skill');
const User = require('../models/User');
const { cloudinary, uploadMaterial, uploadBufferToCloudinary, MAX_FILE_BYTES } = require('../middleware/upload');

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

    // Validate skill exists
    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    // Check if learning path already exists for this exchange
    const existingPath = await LearningPath.findOne({ exchangeId });
    if (existingPath) {
      return res.status(400).json({ message: 'Learning path already exists for this exchange' });
    }

    const learningPath = new LearningPath({
      exchangeId,
      skillId,
      learner,
      instructor,
      status: 'not-started'
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

// Helper function to create a learning path for an exchange
async function createLearningPathForExchange(exchangeId, learner, instructor, skillName, isRequester) {
  try {
    console.log(`🔧 Creating ${isRequester ? 'requester' : 'provider'} learning path for skill: ${skillName}...`);

    // Check if one already exists (prevents duplicate key error on unique index)
    const existing = await LearningPath.findOne({ exchangeId, learner });
    if (existing) {
      console.log(`   Found existing path: ${existing._id}`);
      return existing._id;
    }
    
    // Find the skill - try multiple matching strategies for better results
    let skill = await Skill.findOne({ name: skillName });
    if (!skill) {
      skill = await Skill.findOne({ name: { $regex: new RegExp(`^${skillName}$`, 'i') } });
    }
    if (!skill) {
      const cleanedSkillName = skillName.replace(/\s+(JS|JAVA|CPP|PY)$/i, '').trim();
      skill = await Skill.findOne({ name: { $regex: new RegExp(cleanedSkillName, 'i') } });
    }
    if (!skill) {
      const skillWords = skillName.split(/\s+/);
      for (const word of skillWords) {
        if (word.length > 3) {
          skill = await Skill.findOne({ name: { $regex: new RegExp(word, 'i') } });
          if (skill) break;
        }
      }
    }
    
    console.log(`   Skill found: ${skill ? '✅ ' + skill.name : '❌ Not found'}`);

    const lp = new LearningPath({
      exchangeId: exchangeId,
      skillId: skill ? skill._id : undefined,
      learner: learner,
      instructor: instructor,
      status: 'in-progress'
    });

    await lp.save();
    console.log(`✅ Created ${isRequester ? 'requester' : 'provider'} path: ${lp._id}`);
    return lp._id;
  } catch (error) {
    // Handle race-condition duplicate key: try to find the existing one
    if (error.code === 11000) {
      console.warn(`⚠️  Duplicate key on create — fetching existing learning path`);
      const existing = await LearningPath.findOne({ exchangeId, learner }).catch(() => null);
      if (existing) return existing._id;
    }
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
      // Use populated ID if available; fall back to raw ObjectId
      const lpRef = exchange.requester_learningPathId;
      learningPathId = lpRef?._id || (lpRef && !lpRef._id ? lpRef : null);
      skillToLearn = exchange.requested_skill;
      role = 'requester';
      console.log(`   Learning: ${skillToLearn}`);
      console.log(`   Path exists: ${learningPathId ? '✅' : '❌'}`);
    } else {
      const lpRef = exchange.provider_learningPathId;
      learningPathId = lpRef?._id || (lpRef && !lpRef._id ? lpRef : null);
      skillToLearn = exchange.offered_skill;
      role = 'provider';
      console.log(`   Learning: ${skillToLearn}`);
      console.log(`   Path exists: ${learningPathId ? '✅' : '❌'}`);
    }

    // If not linked on exchange, try to find orphaned path in DB by exchangeId + learner
    if (!learningPathId) {
      const learnerId = isRequester ? exchange.requester_id._id : exchange.provider_id._id;
      const orphaned = await LearningPath.findOne({ exchangeId, learner: learnerId });
      if (orphaned) {
        console.log(`   Found orphaned path: ${orphaned._id} — re-linking to exchange`);
        learningPathId = orphaned._id;
        if (isRequester) {
          exchange.requester_learningPathId = orphaned._id;
        } else {
          exchange.provider_learningPathId = orphaned._id;
        }
        await exchange.save();
      }
    }

    // If learning path still doesn't exist, create it
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
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
      ? await LearningPath.findById(exchange.requester_learningPathId).select('_id learner instructor status')
      : null;

    const providerPath = exchange.provider_learningPathId 
      ? await LearningPath.findById(exchange.provider_learningPathId).select('_id learner instructor status')
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
          status: requesterPath?.status || 'N/A',
          learning: exchange.requested_skill
        },
        providerPath: {
          exists: providerPath ? 'YES ✅' : 'NO ❌',
          id: providerPath?._id || 'null',
          learner: providerPath?.learner?.toString() || 'null',
          instructor: providerPath?.instructor?.toString() || 'null',
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
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
      startedAt: learningPath.startedAt,
      completedAt: learningPath.completedAt
    };

    res.status(200).json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      message: 'Error fetching progress',
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

// Complete entire learning path
exports.completeLearning = async (req, res) => {
  try {
    const { learningPathId } = req.params;
    const currentUserId = req.user._id;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ message: 'Learning path not found' });
    }

    learningPath.status = 'completed';
    learningPath.completedAt = new Date();

    await learningPath.save();

    // Update the exchange to mark the correct learning as complete
    const exchange = await Exchange.findById(learningPath.exchangeId)
      .populate('requester_id', '_id')
      .populate('provider_id', '_id');

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    const isRequesterPath = exchange.requester_learningPathId && 
                           exchange.requester_learningPathId.toString() === learningPathId;
    const isProviderPath = exchange.provider_learningPathId && 
                          exchange.provider_learningPathId.toString() === learningPathId;

    console.log(`📝 Learning Path Complete: ${learningPathId}`);
    console.log(`   - Is Requester Path: ${isRequesterPath}`);
    console.log(`   - Is Provider Path: ${isProviderPath}`);

    if (isRequesterPath) {
      exchange.requester_learningCompleted = true;
      exchange.requester_learningCompletedAt = new Date();
      console.log(`   ✅ Marked requester's learning as complete`);
    } else if (isProviderPath) {
      exchange.provider_learningCompleted = true;
      exchange.provider_learningCompletedAt = new Date();
      console.log(`   ✅ Marked provider's learning as complete`);
    }

    if (exchange.requester_learningCompleted && exchange.provider_learningCompleted) {
      exchange.status = 'completed';
      exchange.completed_date = new Date();
      exchange.learningCompleted = true;
      exchange.learningCompletedAt = new Date();
      console.log(`   🎉 BOTH learnings complete! Marking exchange as COMPLETED`);
    } else {
      console.log(`   ⏳ Waiting for other participant to complete their learning`);
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

// Create learning paths for all active exchanges that don't have one
exports.createMissingLearningPaths = async (req, res) => {
  try {
    const Exchange = require('../models/Exchange');
    const Skill = require('../models/Skill');
    
    console.log('🔧 Starting to create missing learning paths...');
    
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
        
        let skill = await Skill.findOne({ name: exchange.requested_skill });
        if (!skill) {
          skill = await Skill.findOne({ name: { $regex: exchange.requested_skill, $options: 'i' } });
        }
        
        const learningPath = new LearningPath({
          exchangeId: exchange._id,
          skillId: skill ? skill._id : undefined,
          learner: exchange.requester_id._id,
          instructor: exchange.provider_id._id,
          status: 'not-started'
        });
        
        await learningPath.save();
        
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
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

// Seed endpoint kept for API compatibility (no-op)
exports.seedModulesForAllPaths = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Module seeding is no longer supported'
  });
};

// Upload a material (video or PDF) to a learning path
exports.uploadMaterialToPath = (req, res) => {
  // URL-based material (JSON body — no file upload required)
  if (req.is('application/json')) {
    return handleUrlMaterial(req, res);
  }

  // File-based upload (multipart/form-data via Cloudinary)
  uploadMaterial(req, res, async (err) => {
    if (err) {
      // Multer file-too-large error
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMB = Math.round(MAX_FILE_BYTES / (1024 * 1024));
        return res.status(400).json({ success: false, message: `File too large. Maximum size is ${maxMB} MB (Cloudinary free plan limit).` });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      const { learningPathId } = req.params;
      const currentUserId = req.user._id;

      const learningPath = await LearningPath.findById(learningPathId);
      if (!learningPath) {
        return res.status(404).json({ success: false, message: 'Learning path not found' });
      }

      // Both learner and instructor can upload materials (bidirectional exchange — both teach each other)
      const isParticipant =
        learningPath.learner.toString() === currentUserId.toString() ||
        learningPath.instructor.toString() === currentUserId.toString();
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Only participants of this learning path can upload materials' });
      }

      const { title, description } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }

      // Stream the in-memory buffer to Cloudinary
      let url, publicId, bytes;
      try {
        ({ url, publicId, bytes } = await uploadBufferToCloudinary(
          req.file.buffer,
          req.file.mimetype
        ));
      } catch (cloudErr) {
        // Cloudinary-specific size error
        const msg = cloudErr.message || '';
        if (msg.includes('File size too large') || cloudErr.http_code === 400) {
          const maxMB = Math.round(MAX_FILE_BYTES / (1024 * 1024));
          return res.status(400).json({ success: false, message: `File too large for your Cloudinary plan. Maximum allowed is ${maxMB} MB. Please upload a smaller file.` });
        }
        return res.status(500).json({ success: false, message: 'Cloud upload failed: ' + msg });
      }

      const isVideo = req.file.mimetype.startsWith('video/');
      const allowedCategories = ['teaching', 'learning'];
      const materialCategory = allowedCategories.includes(req.body.materialCategory)
        ? req.body.materialCategory
        : 'teaching';

      const material = await LearningMaterial.create({
        learningPathId,
        title: title.trim(),
        description: description ? description.trim() : '',
        fileUrl: url,
        fileType: isVideo ? 'video' : 'pdf',
        cloudinaryPublicId: publicId,
        fileSize: bytes || req.file.size || 0,
        uploadedBy: currentUserId,
        materialCategory
      });

      res.status(201).json({ success: true, material });
    } catch (error) {
      console.error('Upload material error:', error);
      res.status(500).json({ success: false, message: 'Error saving material: ' + (error.message || 'Unknown error') });
    }
  });
};

// Handle URL-based materials (YouTube, Google Drive, etc.) — no file upload needed
async function handleUrlMaterial(req, res) {
  try {
    const { learningPathId } = req.params;
    const currentUserId = req.user._id;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    const isParticipant =
      learningPath.learner.toString() === currentUserId.toString() ||
      learningPath.instructor.toString() === currentUserId.toString();
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Only participants can add materials' });
    }

    const { title, description, materialUrl, materialType, materialCategory, videoThumbnail, duration } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!materialUrl || !materialUrl.trim()) {
      return res.status(400).json({ success: false, message: 'Material URL is required' });
    }

    // Validate URL format (basic check — must start with http/https)
    let parsedUrl;
    try {
      parsedUrl = new URL(materialUrl.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
    } catch {
      return res.status(400).json({ success: false, message: 'Please provide a valid http/https URL' });
    }

    const allowedCategories = ['teaching', 'learning'];
    const category = allowedCategories.includes(materialCategory) ? materialCategory : 'teaching';
    const fileType = (materialType === 'pdf') ? 'pdf' : 'video';

    const material = await LearningMaterial.create({
      learningPathId,
      title: title.trim(),
      description: description ? description.trim() : '',
      fileUrl: parsedUrl.toString(),
      fileType,
      isExternalLink: true,
      videoThumbnail: videoThumbnail ? videoThumbnail.trim() : undefined,
      duration: duration ? Math.max(1, parseInt(duration, 10)) : undefined,
      uploadedBy: currentUserId,
      materialCategory: category
    });

    res.status(201).json({ success: true, material });
  } catch (error) {
    console.error('Add URL material error:', error);
    res.status(500).json({ success: false, message: 'Error saving material: ' + (error.message || 'Unknown error') });
  }
}

// Get all materials for a learning path
exports.getMaterials = async (req, res) => {
  try {
    const { learningPathId } = req.params;
    const currentUserId = req.user._id.toString();

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    // Only participants can view materials
    const isParticipant =
      learningPath.learner.toString() === currentUserId ||
      learningPath.instructor.toString() === currentUserId;
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Collect material IDs from BOTH learning paths in this exchange so
    // each participant sees everything uploaded by either side.
    const pathIds = new Set([learningPathId.toString()]);
    if (learningPath.exchangeId) {
      const exchange = await Exchange.findById(learningPath.exchangeId)
        .select('requester_learningPathId provider_learningPathId');
      if (exchange) {
        if (exchange.requester_learningPathId) pathIds.add(exchange.requester_learningPathId.toString());
        if (exchange.provider_learningPathId)  pathIds.add(exchange.provider_learningPathId.toString());
      }
    }

    const materials = await LearningMaterial.find({ learningPathId: { $in: [...pathIds] } })
      .populate('uploadedBy', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, materials });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ success: false, message: 'Error fetching materials', ...(process.env.NODE_ENV !== 'production' && { error: error.message }) });
  }
};

// Delete a material
exports.deleteMaterial = async (req, res) => {
  try {
    const { learningPathId, materialId } = req.params;
    const currentUserId = req.user._id.toString();

    const material = await LearningMaterial.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }
    if (material.learningPathId.toString() !== learningPathId) {
      return res.status(400).json({ success: false, message: 'Material does not belong to this learning path' });
    }

    // Only the person who uploaded can delete their own material
    if (material.uploadedBy.toString() !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Only the uploader can delete this material' });
    }

    // Delete from Cloudinary
    if (material.cloudinaryPublicId) {
      try {
        const resourceType = material.fileType === 'video' ? 'video' : 'raw';
        await cloudinary.uploader.destroy(material.cloudinaryPublicId, { resource_type: resourceType });
      } catch (cloudErr) {
        console.warn('Cloudinary delete warning:', cloudErr.message);
      }
    }

    await material.deleteOne();
    res.status(200).json({ success: true, message: 'Material deleted' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ success: false, message: 'Error deleting material', ...(process.env.NODE_ENV !== 'production' && { error: error.message }) });
  }
};

// ── Tasks ──────────────────────────────────────────────────────────────────

// Add a task/milestone to a learning path
exports.addTask = async (req, res) => {
  try {
    const { learningPathId } = req.params;
    const { title } = req.body;
    const currentUserId = req.user._id;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    const isParticipant =
      learningPath.learner.toString() === currentUserId.toString() ||
      learningPath.instructor.toString() === currentUserId.toString();
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Only participants can add tasks' });
    }

    learningPath.tasks.push({ title: title.trim(), createdBy: currentUserId });
    await learningPath.save();

    const newTask = learningPath.tasks[learningPath.tasks.length - 1];
    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    console.error('Add task error:', error);
    res.status(500).json({ success: false, message: 'Error adding task', ...(process.env.NODE_ENV !== 'production' && { error: error.message }) });
  }
};

// Update a task (toggle complete / rename)
exports.updateTask = async (req, res) => {
  try {
    const { learningPathId, taskId } = req.params;
    const { completed, title } = req.body;
    const currentUserId = req.user._id;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    const isParticipant =
      learningPath.learner.toString() === currentUserId.toString() ||
      learningPath.instructor.toString() === currentUserId.toString();
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Only participants can update tasks' });
    }

    const task = learningPath.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (typeof completed === 'boolean') task.completed = completed;
    if (title && title.trim()) task.title = title.trim();

    await learningPath.save();
    res.status(200).json({ success: true, task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: 'Error updating task', ...(process.env.NODE_ENV !== 'production' && { error: error.message }) });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const { learningPathId, taskId } = req.params;
    const currentUserId = req.user._id;

    const learningPath = await LearningPath.findById(learningPathId);
    if (!learningPath) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    const isParticipant =
      learningPath.learner.toString() === currentUserId.toString() ||
      learningPath.instructor.toString() === currentUserId.toString();
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Only participants can delete tasks' });
    }

    const task = learningPath.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Only the creator of the task can delete it
    if (!task.createdBy || task.createdBy.toString() !== currentUserId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete tasks you created' });
    }

    task.deleteOne();
    await learningPath.save();
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Error deleting task', ...(process.env.NODE_ENV !== 'production' && { error: error.message }) });
  }
};

module.exports = exports;