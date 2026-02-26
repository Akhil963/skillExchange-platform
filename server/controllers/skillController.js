const Skill = require('../models/Skill');

// Get all skills with search and filter
exports.getAllSkills = async (req, res, next) => {
    try {
        const { search = '', category = 'all', isActive = 'all', sort = '-createdAt' } = req.query;
        
        // Validate sort parameter
        const validSortFields = ['name', 'createdAt', 'updatedAt', 'category'];
        const sortField = sort.replace(/^-/, '');
        if (!validSortFields.includes(sortField)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sort field'
            });
        }
        
        let query = {};
        
        // Search by name, description, or tags
        if (search && search.trim()) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { description: { $regex: escapedSearch, $options: 'i' } },
                { tags: { $regex: escapedSearch, $options: 'i' } }
            ];
        }
        
        // Filter by category
        if (category !== 'all' && category) {
            query.category = category;
        }
        
        // Filter by active status
        if (isActive !== 'all') {
            query.isActive = isActive === 'true';
        }
        
        const skills = await Skill.find(query)
            .populate('createdBy', 'name email')
            .sort(sort)
            .limit(100);
        
        res.status(200).json({
            success: true,
            count: skills.length,
            skills
        });
    } catch (error) {
        next(error);
    }
};

// Get skill by ID
exports.getSkillById = async (req, res, next) => {
    try {
        if (!req.params.id || req.params.id.length !== 24) {
            return res.status(400).json({
                success: false,
                message: 'Invalid skill ID format'
            });
        }
        
        const skill = await Skill.findById(req.params.id)
            .populate('createdBy', 'name email');
        
        if (!skill) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found'
            });
        }
        
        res.status(200).json({
            success: true,
            skill
        });
    } catch (error) {
        next(error);
    }
};

// Create new skill
exports.createSkill = async (req, res, next) => {
    try {
        const { name, category, description, subcategory, tags, isActive } = req.body;
        
        // Validate input
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Skill name is required'
            });
        }
        
        if (!category || !category.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Category is required'
            });
        }
        
        if (!description || !description.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Description is required'
            });
        }
        
        // Check if skill already exists (with validation)
        const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingSkill = await Skill.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
        if (existingSkill) {
            return res.status(400).json({
                success: false,
                message: 'A skill with this name already exists'
            });
        }
        
        const skill = await Skill.create({
            name: name.trim(),
            category: category.trim(),
            description: description.trim(),
            subcategory: subcategory ? subcategory.trim() : undefined,
            tags: Array.isArray(tags) ? tags.filter(t => t && t.trim()) : [],
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            createdBy: req.admin?._id || null
        });
        
        res.status(201).json({
            success: true,
            message: 'Skill created successfully',
            skill
        });
    } catch (error) {
        next(error);
    }
};

// Update skill
exports.updateSkill = async (req, res, next) => {
    try {
        // Validate ID format
        if (!req.params.id || req.params.id.length !== 24) {
            return res.status(400).json({
                success: false,
                message: 'Invalid skill ID format'
            });
        }
        
        const { name, category, description, subcategory, tags, isActive } = req.body;
        
        // Check if new name conflicts with existing skill
        if (name && name.trim()) {
            const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const existingSkill = await Skill.findOne({ 
                name: { $regex: `^${escapedName}$`, $options: 'i' },
                _id: { $ne: req.params.id }
            });
            
            if (existingSkill) {
                return res.status(400).json({
                    success: false,
                    message: 'A skill with this name already exists'
                });
            }
        }
        
        const updateData = {};
        if (name !== undefined && name.trim()) updateData.name = name.trim();
        if (category !== undefined && category.trim()) updateData.category = category.trim();
        if (description !== undefined && description.trim()) updateData.description = description.trim();
        if (subcategory !== undefined) updateData.subcategory = subcategory ? subcategory.trim() : undefined;
        if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.filter(t => t && t.trim()) : [];
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        
        const skill = await Skill.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!skill) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Skill updated successfully',
            skill
        });
    } catch (error) {
        next(error);
    }
};

// Delete skill
exports.deleteSkill = async (req, res, next) => {
    try {
        // Validate ID format
        if (!req.params.id || req.params.id.length !== 24) {
            return res.status(400).json({
                success: false,
                message: 'Invalid skill ID format'
            });
        }
        
        const skill = await Skill.findByIdAndDelete(req.params.id);
        
        if (!skill) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Skill deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Get popular skills
exports.getPopularSkills = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const skills = await Skill.getPopularSkills(limit);
        
        res.json({
            success: true,
            skills
        });
    } catch (error) {
        console.error('Error getting popular skills:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting popular skills',
            error: error.message
        });
    }
};

// Get skills by category
exports.getSkillsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const skills = await Skill.getByCategory(category);
        
        res.json({
            success: true,
            category,
            count: skills.length,
            skills
        });
    } catch (error) {
        console.error('Error getting skills by category:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting skills by category',
            error: error.message
        });
    }
};

// Get skill categories
exports.getCategories = async (req, res) => {
    try {
        const categories = [
            'Programming & Development',
            'Design & Creative',
            'Business & Finance',
            'Marketing & Sales',
            'Writing & Translation',
            'Music & Audio',
            'Video & Animation',
            'Photography',
            'Health & Fitness',
            'Teaching & Academics',
            'Lifestyle',
            'Data & Analytics',
            'AI & Machine Learning',
            'Other'
        ];
        
        // Get count for each category
        const categoriesWithCount = await Promise.all(
            categories.map(async (category) => {
                const count = await Skill.countDocuments({ category, isActive: true });
                return { name: category, count };
            })
        );
        
        res.json({
            success: true,
            categories: categoriesWithCount
        });
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting categories',
            error: error.message
        });
    }
};

// Bulk create skills (for seeding)
exports.bulkCreateSkills = async (req, res) => {
    try {
        const { skills } = req.body;
        
        if (!Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of skills'
            });
        }
        
        const createdSkills = await Skill.insertMany(
            skills.map(skill => ({
                ...skill,
                createdBy: req.admin?._id || null
            })),
            { ordered: false } // Continue even if some fail
        );
        
        res.status(201).json({
            success: true,
            message: `${createdSkills.length} skills created successfully`,
            skills: createdSkills
        });
    } catch (error) {
        console.error('Error bulk creating skills:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating skills',
            error: error.message
        });
    }
};
