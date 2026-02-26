const User = require('../models/User');
const Exchange = require('../models/Exchange');
const mongoose = require('mongoose');

// Get system status
exports.getSystemStatus = async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        const dbName = mongoose.connection.name;
        
        res.json({
            success: true,
            connected: dbState === 1,
            database: dbName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting system status',
            error: error.message
        });
    }
};

// Get platform statistics
exports.getStats = async (req, res) => {
    try {
        // Total users
        const totalUsers = await User.countDocuments();
        
        // Total exchanges
        const totalExchanges = await Exchange.countDocuments();
        
        // Average rating
        const usersWithRatings = await User.find({ rating: { $exists: true, $ne: null } });
        const avgRating = usersWithRatings.length > 0
            ? usersWithRatings.reduce((sum, user) => sum + user.rating, 0) / usersWithRatings.length
            : 0;
        
        // Success rate (completed exchanges / total exchanges)
        const completedExchanges = await Exchange.countDocuments({ status: 'completed' });
        const successRate = totalExchanges > 0
            ? Math.round((completedExchanges / totalExchanges) * 100)
            : 0;
        
        // Recent users (last 5) - use correct field names from User model
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email avatar createdAt');
        
        // Recent exchanges (last 5) - populate with correct field names
        const recentExchanges = await Exchange.find()
            .sort({ created_date: -1 })
            .limit(5)
            .populate('requester_id', 'name email avatar')
            .populate('provider_id', 'name email avatar')
            .select('requester_id provider_id requested_skill offered_skill status created_date');
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalExchanges,
                averageRating: parseFloat(avgRating.toFixed(1)),
                successRate
            },
            recentUsers,
            recentExchanges
        });
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting statistics',
            error: error.message
        });
    }
};

// Get all users with search and filter
exports.getAllUsers = async (req, res) => {
    try {
        const { search = '', filter = 'all' } = req.query;
        
        let query = {};
        
        // Search by name or email
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Filter by criteria
        if (filter !== 'all') {
            switch (filter) {
                case 'verified':
                    query.emailVerified = true;
                    break;
                case 'unverified':
                    query.emailVerified = false;
                    break;
                case 'active':
                    query.lastActive = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
                    break;
            }
        }
        
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .select('-password');
        
        res.json({
            success: true,
            users,
            total: users.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting users',
            error: error.message
        });
    }
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting user',
            error: error.message
        });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { name, fullName, email, location, bio, profilePicture, avatar, skills_offered, skills_wanted } = req.body;
        
        const updateData = {
            name: name || fullName, // Support both field names
            email,
            location,
            bio
        };
        
        // Add profile picture if provided (support both field names)
        if (profilePicture) {
            updateData.avatar = profilePicture;
        } else if (avatar) {
            updateData.avatar = avatar;
        }
        
        // Process skills if provided - fetch full skill data from Skill collection
        if (skills_offered !== undefined) {
            const Skill = require('../models/Skill');
            const enrichedSkillsOffered = [];
            
            for (const skill of skills_offered) {
                const skillName = skill.name || skill;
                const fullSkill = await Skill.findOne({ name: skillName, isActive: true });
                
                if (fullSkill) {
                    enrichedSkillsOffered.push({
                        name: fullSkill.name,
                        category: fullSkill.category,
                        experience_level: skill.experience_level || 'Intermediate',
                        description: fullSkill.description || `Skilled in ${fullSkill.name}`
                    });
                } else {
                    // If skill not found in database, use minimal data
                    enrichedSkillsOffered.push({
                        name: skillName,
                        category: skill.category || 'Other',
                        experience_level: skill.experience_level || 'Intermediate',
                        description: skill.description || `Skilled in ${skillName}`
                    });
                }
            }
            updateData.skills_offered = enrichedSkillsOffered;
        }
        
        if (skills_wanted !== undefined) {
            const Skill = require('../models/Skill');
            const enrichedSkillsWanted = [];
            
            for (const skill of skills_wanted) {
                const skillName = skill.name || skill;
                const fullSkill = await Skill.findOne({ name: skillName, isActive: true });
                
                if (fullSkill) {
                    enrichedSkillsWanted.push({
                        name: fullSkill.name,
                        category: fullSkill.category,
                        experience_level: skill.experience_level || 'Beginner',
                        description: fullSkill.description || `Wants to learn ${fullSkill.name}`
                    });
                } else {
                    // If skill not found in database, use minimal data
                    enrichedSkillsWanted.push({
                        name: skillName,
                        category: skill.category || 'Other',
                        experience_level: skill.experience_level || 'Beginner',
                        description: skill.description || `Wants to learn ${skillName}`
                    });
                }
            }
            updateData.skills_wanted = enrichedSkillsWanted;
        }
        
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'User updated successfully',
            user
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Also delete all exchanges related to this user
        await Exchange.deleteMany({
            $or: [
                { requester_id: req.params.id },
                { provider_id: req.params.id }
            ]
        });
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
};

// Get all exchanges with filter
exports.getAllExchanges = async (req, res) => {
    try {
        const { status = 'all' } = req.query;
        
        let query = {};
        
        if (status !== 'all') {
            query.status = status;
        }
        
        const exchanges = await Exchange.find(query)
            .sort({ createdAt: -1 })
            .populate('requester_id', 'fullName email profilePicture')
            .populate('provider_id', 'fullName email profilePicture');
        
        res.json({
            success: true,
            exchanges,
            total: exchanges.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting exchanges',
            error: error.message
        });
    }
};

// Get exchange by ID
exports.getExchangeById = async (req, res) => {
    try {
        const exchange = await Exchange.findById(req.params.id)
            .populate('requester_id', 'fullName email profilePicture')
            .populate('provider_id', 'fullName email profilePicture');
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: 'Exchange not found'
            });
        }
        
        res.json({
            success: true,
            exchange
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting exchange',
            error: error.message
        });
    }
};

// Update exchange
exports.updateExchange = async (req, res) => {
    try {
        const { status } = req.body;
        
        const exchange = await Exchange.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('requester_id provider_id');
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: 'Exchange not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Exchange updated successfully',
            exchange
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating exchange',
            error: error.message
        });
    }
};

// Delete exchange
exports.deleteExchange = async (req, res) => {
    try {
        const exchange = await Exchange.findByIdAndDelete(req.params.id);
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: 'Exchange not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Exchange deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting exchange',
            error: error.message
        });
    }
};

// Get all skills across platform
exports.getAllSkills = async (req, res) => {
    try {
        const { search = '', category = 'all' } = req.query;
        
        // Aggregate all skills from users
        const users = await User.find()
            .select('fullName skillsOffered');
        
        let skills = [];
        
        users.forEach(user => {
            if (user.skillsOffered && user.skillsOffered.length > 0) {
                user.skillsOffered.forEach(skill => {
                    skills.push({
                        name: skill.name,
                        category: skill.category,
                        level: skill.level,
                        provider: {
                            _id: user._id,
                            fullName: user.fullName
                        }
                    });
                });
            }
        });
        
        // Filter by search
        if (search) {
            skills = skills.filter(skill =>
                skill.name.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        // Filter by category
        if (category !== 'all') {
            skills = skills.filter(skill => skill.category === category);
        }
        
        res.json({
            success: true,
            skills,
            total: skills.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting skills',
            error: error.message
        });
    }
};

// Get settings
exports.getSettings = async (req, res) => {
    try {
        const settings = {
            dbUri: process.env.MONGODB_URI || '',
            dbName: mongoose.connection.name || ''
        };
        
        const system = {
            uptime: `${Math.floor(process.uptime() / 3600)} hours`,
            version: process.env.APP_VERSION || '1.0.0',
            nodeVersion: process.version
        };
        
        res.json({
            success: true,
            settings,
            system
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting settings',
            error: error.message
        });
    }
};

// Update settings
exports.updateSettings = async (req, res) => {
    try {
        // In a real application, you would update environment variables or config files
        // For now, we'll just return success
        
        res.json({
            success: true,
            message: 'Settings updated successfully (Note: Restart server for changes to take effect)'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating settings',
            error: error.message
        });
    }
};

// Get analytics data for charts
exports.getAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        
        // User growth by month
        const userGrowth = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);
        
        // Exchange status distribution
        const exchangeStatus = await Exchange.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Popular skills
        const allUsers = await User.find().select('skillsOffered');
        const skillCounts = {};
        
        allUsers.forEach(user => {
            if (user.skillsOffered && user.skillsOffered.length > 0) {
                user.skillsOffered.forEach(skill => {
                    skillCounts[skill.name] = (skillCounts[skill.name] || 0) + 1;
                });
            }
        });
        
        const popularSkills = Object.entries(skillCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        
        // Monthly activity (exchanges per month)
        const monthlyActivity = await Exchange.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);
        
        // Calculate metrics
        const totalUsers = await User.countDocuments();
        const totalExchanges = await Exchange.countDocuments();
        const completedExchanges = await Exchange.countDocuments({ status: 'completed' });
        const successRate = totalExchanges > 0 ? Math.round((completedExchanges / totalExchanges) * 100) : 0;
        
        // User growth percentage (compare last month to month before)
        const lastMonthUsers = await User.countDocuments({
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) }
        });
        const prevMonthUsers = await User.countDocuments({
            createdAt: {
                $gte: new Date(now.getFullYear(), now.getMonth() - 2, 1),
                $lt: new Date(now.getFullYear(), now.getMonth() - 1, 1)
            }
        });
        const userGrowthPercent = prevMonthUsers > 0 
            ? Math.round(((lastMonthUsers - prevMonthUsers) / prevMonthUsers) * 100) 
            : 100;
        
        // Format chart data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const userGrowthChart = {
            labels: userGrowth.map(item => `${monthNames[item._id.month - 1]} ${item._id.year}`),
            datasets: [{
                label: 'New Users',
                data: userGrowth.map(item => item.count),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }]
        };
        
        const exchangeStatusChart = {
            labels: exchangeStatus.map(item => item._id || 'Unknown'),
            datasets: [{
                data: exchangeStatus.map(item => item.count),
                backgroundColor: [
                    '#10b981', // completed - green
                    '#f59e0b', // pending - yellow
                    '#6366f1', // active - blue
                    '#ef4444'  // cancelled - red
                ]
            }]
        };
        
        const popularSkillsChart = {
            labels: popularSkills.map(skill => skill.name),
            datasets: [{
                label: 'Number of Providers',
                data: popularSkills.map(skill => skill.count),
                backgroundColor: '#6366f1'
            }]
        };
        
        const monthlyActivityChart = {
            labels: monthlyActivity.map(item => `${monthNames[item._id.month - 1]} ${item._id.year}`),
            datasets: [{
                label: 'Exchanges',
                data: monthlyActivity.map(item => item.count),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        };
        
        res.json({
            success: true,
            metrics: {
                userGrowth: `+${userGrowthPercent}%`,
                exchangeSuccess: `${successRate}%`,
                skillDistribution: popularSkills.length,
                revenue: '$12,450' // Mock data - implement real revenue tracking
            },
            charts: {
                userGrowth: userGrowthChart,
                exchangeStatus: exchangeStatusChart,
                popularSkills: popularSkillsChart,
                monthlyActivity: monthlyActivityChart
            },
            insights: [
                {
                    title: 'User Growth',
                    description: `${userGrowthPercent}% increase in new users this month`,
                    status: userGrowthPercent > 0 ? 'positive' : 'negative'
                },
                {
                    title: 'Exchange Success',
                    description: `${successRate}% of exchanges completed successfully`,
                    status: successRate >= 80 ? 'positive' : 'warning'
                },
                {
                    title: 'Popular Categories',
                    description: `Top skill: ${popularSkills[0]?.name || 'N/A'} with ${popularSkills[0]?.count || 0} providers`,
                    status: 'neutral'
                },
                {
                    title: 'Platform Activity',
                    description: `${totalExchanges} total exchanges on the platform`,
                    status: 'positive'
                }
            ]
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting analytics',
            error: error.message
        });
    }
};

// Create backup of all data
exports.createBackup = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        const exchanges = await Exchange.find().populate('requester_id provider_id');
        
        const backup = {
            users,
            exchanges,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            platform: 'SkillExchange'
        };
        
        res.json({
            success: true,
            message: 'Backup created successfully',
            backup,
            stats: {
                users: users.length,
                exchanges: exchanges.length,
                size: JSON.stringify(backup).length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating backup',
            error: error.message
        });
    }
};

// Restore data from backup
exports.restoreBackup = async (req, res) => {
    try {
        const { users, exchanges } = req.body;
        
        if (!users && !exchanges) {
            return res.status(400).json({
                success: false,
                message: 'No data provided for restore'
            });
        }
        
        let restored = {
            users: 0,
            exchanges: 0
        };
        
        // Restore users
        if (users && Array.isArray(users)) {
            for (const userData of users) {
                const existingUser = await User.findById(userData._id);
                if (existingUser) {
                    await User.findByIdAndUpdate(userData._id, userData);
                } else {
                    await User.create(userData);
                }
                restored.users++;
            }
        }
        
        // Restore exchanges
        if (exchanges && Array.isArray(exchanges)) {
            for (const exchangeData of exchanges) {
                const existingExchange = await Exchange.findById(exchangeData._id);
                if (existingExchange) {
                    await Exchange.findByIdAndUpdate(exchangeData._id, exchangeData);
                } else {
                    await Exchange.create(exchangeData);
                }
                restored.exchanges++;
            }
        }
        
        res.json({
            success: true,
            message: 'Backup restored successfully',
            restored
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error restoring backup',
            error: error.message
        });
    }
};
