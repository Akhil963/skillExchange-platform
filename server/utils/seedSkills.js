const Skill = require('../models/Skill');
require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });
const mongoose = require('mongoose');

const skillsData = [
    // Programming & Development
    { name: 'JavaScript', category: 'Programming & Development', subcategory: 'Frontend', description: 'Modern JavaScript programming language for web development', tags: ['web', 'frontend', 'coding'] },
    { name: 'Python', category: 'Programming & Development', subcategory: 'Backend', description: 'Versatile programming language for web, data science, and automation', tags: ['backend', 'data science', 'coding'] },
    { name: 'React', category: 'Programming & Development', subcategory: 'Frontend Framework', description: 'Popular JavaScript library for building user interfaces', tags: ['frontend', 'ui', 'spa'] },
    { name: 'Node.js', category: 'Programming & Development', subcategory: 'Backend', description: 'JavaScript runtime for server-side programming', tags: ['backend', 'javascript', 'server'] },
    { name: 'Java', category: 'Programming & Development', subcategory: 'Backend', description: 'Enterprise-level programming language', tags: ['backend', 'enterprise', 'coding'] },
    { name: 'TypeScript', category: 'Programming & Development', subcategory: 'Frontend', description: 'Typed superset of JavaScript', tags: ['frontend', 'javascript', 'types'] },
    { name: 'PHP', category: 'Programming & Development', subcategory: 'Backend', description: 'Server-side scripting language', tags: ['backend', 'web', 'scripting'] },
    { name: 'C++', category: 'Programming & Development', subcategory: 'Systems', description: 'High-performance programming language', tags: ['systems', 'performance', 'coding'] },
    { name: 'SQL', category: 'Programming & Development', subcategory: 'Database', description: 'Database query language', tags: ['database', 'data', 'queries'] },
    { name: 'MongoDB', category: 'Programming & Development', subcategory: 'Database', description: 'NoSQL document database', tags: ['database', 'nosql', 'data'] },
    
    // Design & Creative
    { name: 'Graphic Design', category: 'Design & Creative', subcategory: 'Visual Design', description: 'Creating visual content and graphics', tags: ['design', 'visual', 'creative'] },
    { name: 'UI/UX Design', category: 'Design & Creative', subcategory: 'Digital Design', description: 'User interface and experience design', tags: ['design', 'ux', 'ui'] },
    { name: 'Adobe Photoshop', category: 'Design & Creative', subcategory: 'Software', description: 'Photo editing and graphic design software', tags: ['design', 'adobe', 'editing'] },
    { name: 'Adobe Illustrator', category: 'Design & Creative', subcategory: 'Software', description: 'Vector graphics design software', tags: ['design', 'adobe', 'vector'] },
    { name: 'Figma', category: 'Design & Creative', subcategory: 'Software', description: 'Collaborative design tool', tags: ['design', 'prototyping', 'ui'] },
    { name: 'Logo Design', category: 'Design & Creative', subcategory: 'Branding', description: 'Creating unique brand logos', tags: ['branding', 'design', 'logo'] },
    { name: 'Web Design', category: 'Design & Creative', subcategory: 'Digital Design', description: 'Designing websites and web interfaces', tags: ['web', 'design', 'digital'] },
    
    // Marketing & Sales
    { name: 'Digital Marketing', category: 'Marketing & Sales', subcategory: 'Online Marketing', description: 'Marketing products and services online', tags: ['marketing', 'digital', 'online'] },
    { name: 'Social Media Marketing', category: 'Marketing & Sales', subcategory: 'Social Media', description: 'Marketing through social media platforms', tags: ['social media', 'marketing', 'content'] },
    { name: 'SEO', category: 'Marketing & Sales', subcategory: 'Search Optimization', description: 'Search engine optimization techniques', tags: ['seo', 'search', 'optimization'] },
    { name: 'Content Marketing', category: 'Marketing & Sales', subcategory: 'Content Strategy', description: 'Creating and distributing valuable content', tags: ['content', 'marketing', 'strategy'] },
    { name: 'Email Marketing', category: 'Marketing & Sales', subcategory: 'Email', description: 'Marketing through email campaigns', tags: ['email', 'marketing', 'campaigns'] },
    { name: 'Google Ads', category: 'Marketing & Sales', subcategory: 'Advertising', description: 'Google advertising platform', tags: ['ads', 'ppc', 'google'] },
    { name: 'Facebook Ads', category: 'Marketing & Sales', subcategory: 'Advertising', description: 'Facebook advertising platform', tags: ['ads', 'facebook', 'social'] },
    
    // Business & Finance
    { name: 'Accounting', category: 'Business & Finance', subcategory: 'Finance', description: 'Financial record keeping and analysis', tags: ['finance', 'accounting', 'business'] },
    { name: 'Excel', category: 'Business & Finance', subcategory: 'Software', description: 'Microsoft Excel spreadsheet software', tags: ['excel', 'data', 'spreadsheets'] },
    { name: 'Financial Analysis', category: 'Business & Finance', subcategory: 'Finance', description: 'Analyzing financial data and trends', tags: ['finance', 'analysis', 'data'] },
    { name: 'Project Management', category: 'Business & Finance', subcategory: 'Management', description: 'Planning and executing projects', tags: ['management', 'planning', 'projects'] },
    { name: 'Business Strategy', category: 'Business & Finance', subcategory: 'Strategy', description: 'Developing business strategies', tags: ['strategy', 'business', 'planning'] },
    
    // Writing & Translation
    { name: 'Content Writing', category: 'Writing & Translation', subcategory: 'Writing', description: 'Writing engaging content for web and print', tags: ['writing', 'content', 'creative'] },
    { name: 'Copywriting', category: 'Writing & Translation', subcategory: 'Marketing Writing', description: 'Writing persuasive marketing copy', tags: ['writing', 'marketing', 'copy'] },
    { name: 'Technical Writing', category: 'Writing & Translation', subcategory: 'Documentation', description: 'Writing technical documentation', tags: ['writing', 'technical', 'documentation'] },
    { name: 'Translation', category: 'Writing & Translation', subcategory: 'Languages', description: 'Translating content between languages', tags: ['translation', 'languages', 'localization'] },
    
    // Data & Analytics
    { name: 'Data Analysis', category: 'Data & Analytics', subcategory: 'Analysis', description: 'Analyzing and interpreting data', tags: ['data', 'analysis', 'insights'] },
    { name: 'Excel Analytics', category: 'Data & Analytics', subcategory: 'Tools', description: 'Advanced Excel for data analysis', tags: ['excel', 'data', 'analytics'] },
    { name: 'Power BI', category: 'Data & Analytics', subcategory: 'Visualization', description: 'Business intelligence and visualization', tags: ['bi', 'visualization', 'data'] },
    { name: 'Tableau', category: 'Data & Analytics', subcategory: 'Visualization', description: 'Data visualization software', tags: ['visualization', 'data', 'analytics'] },
    
    // AI & Machine Learning
    { name: 'Machine Learning', category: 'AI & Machine Learning', subcategory: 'ML', description: 'Building machine learning models', tags: ['ml', 'ai', 'data science'] },
    { name: 'Deep Learning', category: 'AI & Machine Learning', subcategory: 'Neural Networks', description: 'Deep neural network development', tags: ['deep learning', 'ai', 'neural networks'] },
    { name: 'Natural Language Processing', category: 'AI & Machine Learning', subcategory: 'NLP', description: 'Processing and understanding human language', tags: ['nlp', 'ai', 'text'] },
    { name: 'TensorFlow', category: 'AI & Machine Learning', subcategory: 'Framework', description: 'Machine learning framework', tags: ['ml', 'framework', 'google'] },
    
    // Video & Animation
    { name: 'Video Editing', category: 'Video & Animation', subcategory: 'Editing', description: 'Editing and producing videos', tags: ['video', 'editing', 'production'] },
    { name: 'Adobe Premiere Pro', category: 'Video & Animation', subcategory: 'Software', description: 'Professional video editing software', tags: ['video', 'adobe', 'editing'] },
    { name: 'After Effects', category: 'Video & Animation', subcategory: 'Animation', description: 'Motion graphics and visual effects', tags: ['animation', 'vfx', 'motion'] },
    { name: '3D Animation', category: 'Video & Animation', subcategory: 'Animation', description: 'Creating 3D animated content', tags: ['3d', 'animation', 'modeling'] },
    
    // Music & Audio
    { name: 'Music Production', category: 'Music & Audio', subcategory: 'Production', description: 'Creating and producing music', tags: ['music', 'production', 'audio'] },
    { name: 'Audio Editing', category: 'Music & Audio', subcategory: 'Editing', description: 'Editing and mixing audio', tags: ['audio', 'editing', 'mixing'] },
    { name: 'Voice Over', category: 'Music & Audio', subcategory: 'Voice', description: 'Professional voice over work', tags: ['voice', 'narration', 'audio'] },
    
    // Photography
    { name: 'Photography', category: 'Photography', subcategory: 'General', description: 'Professional photography skills', tags: ['photography', 'camera', 'visual'] },
    { name: 'Photo Editing', category: 'Photography', subcategory: 'Post-Production', description: 'Editing and retouching photos', tags: ['editing', 'photoshop', 'retouching'] },
    { name: 'Portrait Photography', category: 'Photography', subcategory: 'Portrait', description: 'Portrait and headshot photography', tags: ['portrait', 'photography', 'people'] },
    
    // Teaching & Academics
    { name: 'Teaching', category: 'Teaching & Academics', subcategory: 'Education', description: 'Teaching and tutoring skills', tags: ['teaching', 'education', 'tutoring'] },
    { name: 'Math Tutoring', category: 'Teaching & Academics', subcategory: 'Mathematics', description: 'Mathematics tutoring and instruction', tags: ['math', 'tutoring', 'education'] },
    { name: 'English Language', category: 'Teaching & Academics', subcategory: 'Languages', description: 'English language instruction', tags: ['english', 'language', 'teaching'] },
    
    // Health & Fitness
    { name: 'Personal Training', category: 'Health & Fitness', subcategory: 'Fitness', description: 'Personal fitness training', tags: ['fitness', 'training', 'health'] },
    { name: 'Yoga', category: 'Health & Fitness', subcategory: 'Wellness', description: 'Yoga instruction and practice', tags: ['yoga', 'wellness', 'health'] },
    { name: 'Nutrition', category: 'Health & Fitness', subcategory: 'Diet', description: 'Nutrition and diet planning', tags: ['nutrition', 'diet', 'health'] },
    
    // Lifestyle
    { name: 'Cooking', category: 'Lifestyle', subcategory: 'Culinary', description: 'Cooking and culinary skills', tags: ['cooking', 'food', 'culinary'] },
    { name: 'Gardening', category: 'Lifestyle', subcategory: 'Home', description: 'Gardening and plant care', tags: ['gardening', 'plants', 'home'] },
    { name: 'Home Organization', category: 'Lifestyle', subcategory: 'Organization', description: 'Home organization and decluttering', tags: ['organization', 'home', 'lifestyle'] }
];

async function seedSkills() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📡 Connected to MongoDB');
        
        // Clear existing skills
        await Skill.deleteMany({});
        console.log('🗑️  Cleared existing skills');
        
        // Insert new skills
        const skills = await Skill.insertMany(skillsData);
        console.log(`✅ Successfully seeded ${skills.length} skills`);
        
        // Show category breakdown
        const categories = {};
        skills.forEach(skill => {
            categories[skill.category] = (categories[skill.category] || 0) + 1;
        });
        
        console.log('\n📊 Skills by Category:');
        Object.entries(categories).forEach(([category, count]) => {
            console.log(`   ${category}: ${count} skills`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding skills:', error);
        process.exit(1);
    }
}

seedSkills();
