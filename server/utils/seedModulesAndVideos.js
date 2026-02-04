const LearningPath = require('../models/LearningPath');
const Skill = require('../models/Skill');
const Exchange = require('../models/Exchange');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });
const mongoose = require('mongoose');

// Module and video templates for each skill category
const skillModulesData = {
    // Programming & Development
    'JavaScript': {
        description: 'Complete JavaScript fundamentals and advanced concepts',
        modules: [
            {
                title: '📖 JavaScript Basics',
                description: 'Learn variables, data types, and basic syntax',
                duration: 45,
                order: 1,
                videoTitle: 'JavaScript Fundamentals for Beginners',
                videoUrl: 'https://www.youtube.com/embed/W6NZfCO5tTE'
            },
            {
                title: '🔄 Control Flow & Functions',
                description: 'Master loops, conditions, and function declarations',
                duration: 50,
                order: 2,
                videoTitle: 'Functions and Control Flow in JavaScript',
                videoUrl: 'https://www.youtube.com/embed/R8rmfD9Y5-c'
            },
            {
                title: '🎯 Objects & Arrays',
                description: 'Work with complex data structures',
                duration: 55,
                order: 3,
                videoTitle: 'JavaScript Objects and Arrays Deep Dive',
                videoUrl: 'https://www.youtube.com/embed/daax3FC6fYY'
            },
            {
                title: '⚡ Async & Promises',
                description: 'Understanding asynchronous JavaScript and promises',
                duration: 60,
                order: 4,
                videoTitle: 'Promises and Async/Await in JavaScript',
                videoUrl: 'https://www.youtube.com/embed/PoRJizFvM7s'
            },
            {
                title: '🌐 DOM Manipulation',
                description: 'Interactive web pages with DOM',
                duration: 45,
                order: 5,
                videoTitle: 'DOM Manipulation Masterclass',
                videoUrl: 'https://www.youtube.com/embed/0OvtDeKO7a4'
            }
        ]
    },
    'Python': {
        description: 'Master Python programming from basics to advanced',
        modules: [
            {
                title: '🐍 Python Basics',
                description: 'Introduction to Python syntax and environment setup',
                duration: 50,
                order: 1,
                videoTitle: 'Python for Beginners',
                videoUrl: 'https://www.youtube.com/embed/YYXdWT2l-6s'
            },
            {
                title: '📚 Data Structures',
                description: 'Lists, dictionaries, sets, and tuples',
                duration: 60,
                order: 2,
                videoTitle: 'Python Data Structures Explained',
                videoUrl: 'https://www.youtube.com/embed/Eaz5wNQslsU'
            },
            {
                title: '🎯 Functions & Modules',
                description: 'Create reusable code with functions and modules',
                duration: 55,
                order: 3,
                videoTitle: 'Functions and Modules in Python',
                videoUrl: 'https://www.youtube.com/embed/E9gMkjlhSsM'
            },
            {
                title: '🔧 File Handling',
                description: 'Read, write, and manipulate files',
                duration: 45,
                order: 4,
                videoTitle: 'File Operations in Python',
                videoUrl: 'https://www.youtube.com/embed/Uh2ebFW8OYM'
            },
            {
                title: '🌐 Web Scraping',
                description: 'Extract data from websites',
                duration: 65,
                order: 5,
                videoTitle: 'Web Scraping with Python',
                videoUrl: 'https://www.youtube.com/embed/XVv6mJpFOb0'
            }
        ]
    },
    'React': {
        description: 'Build modern UIs with React',
        modules: [
            {
                title: '⚛️ React Fundamentals',
                description: 'Components, JSX, and props',
                duration: 55,
                order: 1,
                videoTitle: 'React Basics for Beginners',
                videoUrl: 'https://www.youtube.com/embed/Ke90Tje7VS0'
            },
            {
                title: '🎣 Hooks & State',
                description: 'useState, useEffect, and custom hooks',
                duration: 60,
                order: 2,
                videoTitle: 'React Hooks Deep Dive',
                videoUrl: 'https://www.youtube.com/embed/1C8eR9Cq4E4'
            },
            {
                title: '🔀 Routing & Navigation',
                description: 'Build multi-page applications with React Router',
                duration: 50,
                order: 3,
                videoTitle: 'React Router Mastery',
                videoUrl: 'https://www.youtube.com/embed/Law7lp7dskw'
            },
            {
                title: '🎨 Styling in React',
                description: 'CSS modules, styled-components, and Tailwind',
                duration: 45,
                order: 4,
                videoTitle: 'React Styling Techniques',
                videoUrl: 'https://www.youtube.com/embed/nr5D2c0fR0o'
            },
            {
                title: '🧪 Testing React Apps',
                description: 'Unit testing with Jest and React Testing Library',
                duration: 65,
                order: 5,
                videoTitle: 'Testing React Applications',
                videoUrl: 'https://www.youtube.com/embed/kCR3JAR7nZ8'
            }
        ]
    },
    'Node.js': {
        description: 'Backend development with Node.js',
        modules: [
            {
                title: '🚀 Node.js Basics',
                description: 'Setup, modules, and npm packages',
                duration: 50,
                order: 1,
                videoTitle: 'Node.js for Beginners',
                videoUrl: 'https://www.youtube.com/embed/TlB_eWDSMt4'
            },
            {
                title: '🌐 Express Framework',
                description: 'Create REST APIs with Express',
                duration: 60,
                order: 2,
                videoTitle: 'Express.js Tutorial',
                videoUrl: 'https://www.youtube.com/embed/SccSCuHhOw0'
            },
            {
                title: '💾 Database Integration',
                description: 'Connect to MongoDB and SQL databases',
                duration: 55,
                order: 3,
                videoTitle: 'Database with Node.js',
                videoUrl: 'https://www.youtube.com/embed/K8MIvfg2gtM'
            },
            {
                title: '🔒 Authentication & Security',
                description: 'JWT, sessions, and security best practices',
                duration: 65,
                order: 4,
                videoTitle: 'Securing Node.js Applications',
                videoUrl: 'https://www.youtube.com/embed/DQ27yWP1EGk'
            },
            {
                title: '☁️ Deployment',
                description: 'Deploy to Heroku, AWS, or other platforms',
                duration: 45,
                order: 5,
                videoTitle: 'Deploying Node.js Apps',
                videoUrl: 'https://www.youtube.com/embed/1tPqf4AeIAE'
            }
        ]
    },
    'Java': {
        description: 'Enterprise Java programming',
        modules: [
            {
                title: '☕ Java Basics',
                description: 'Syntax, variables, and data types',
                duration: 55,
                order: 1,
                videoTitle: 'Java for Beginners',
                videoUrl: 'https://www.youtube.com/embed/eIrMbAQSU34'
            },
            {
                title: '🎯 OOP Concepts',
                description: 'Classes, inheritance, polymorphism',
                duration: 65,
                order: 2,
                videoTitle: 'Object-Oriented Programming in Java',
                videoUrl: 'https://www.youtube.com/embed/xk4_1vDrzzo'
            },
            {
                title: '📚 Collections Framework',
                description: 'Lists, Sets, Maps, and Streams',
                duration: 60,
                order: 3,
                videoTitle: 'Java Collections Framework',
                videoUrl: 'https://www.youtube.com/embed/EnjKP5nXsFQ'
            },
            {
                title: '🔧 Exception Handling',
                description: 'Error handling and debugging',
                duration: 50,
                order: 4,
                videoTitle: 'Exception Handling in Java',
                videoUrl: 'https://www.youtube.com/embed/1XAfapkBQjk'
            },
            {
                title: '🌐 Spring Framework',
                description: 'Build web applications with Spring',
                duration: 70,
                order: 5,
                videoTitle: 'Spring Framework Masterclass',
                videoUrl: 'https://www.youtube.com/embed/9SGDpanBqtc'
            }
        ]
    },
    'TypeScript': {
        description: 'Type-safe JavaScript development',
        modules: [
            {
                title: '📝 TypeScript Basics',
                description: 'Types, interfaces, and classes',
                duration: 50,
                order: 1,
                videoTitle: 'TypeScript Fundamentals',
                videoUrl: 'https://www.youtube.com/embed/d56mG7DQqqM'
            },
            {
                title: '🎯 Advanced Types',
                description: 'Generics, unions, and intersections',
                duration: 55,
                order: 2,
                videoTitle: 'Advanced TypeScript Features',
                videoUrl: 'https://www.youtube.com/embed/z8p0fpw8-cE'
            },
            {
                title: '⚙️ Decorators & Metadata',
                description: 'Using decorators in TypeScript',
                duration: 45,
                order: 3,
                videoTitle: 'TypeScript Decorators',
                videoUrl: 'https://www.youtube.com/embed/Yw-EV7J7G00'
            },
            {
                title: '🔄 Integration with JavaScript',
                description: 'Using TypeScript with existing JS codebases',
                duration: 50,
                order: 4,
                videoTitle: 'TypeScript in Real Projects',
                videoUrl: 'https://www.youtube.com/embed/BwuLSPRj_OQ'
            },
            {
                title: '🧪 Testing with TypeScript',
                description: 'Jest and Mocha with TypeScript',
                duration: 55,
                order: 5,
                videoTitle: 'Testing TypeScript Applications',
                videoUrl: 'https://www.youtube.com/embed/cabPJkXDvWU'
            }
        ]
    },
    'SQL': {
        description: 'Master SQL database queries',
        modules: [
            {
                title: '📊 SQL Basics',
                description: 'SELECT, INSERT, UPDATE, DELETE',
                duration: 45,
                order: 1,
                videoTitle: 'SQL Fundamentals',
                videoUrl: 'https://www.youtube.com/embed/HXV3zeQKqGY'
            },
            {
                title: '🔗 JOINs & Relationships',
                description: 'Inner, outer, and cross joins',
                duration: 55,
                order: 2,
                videoTitle: 'SQL JOINs Explained',
                videoUrl: 'https://www.youtube.com/embed/9yeOJ0ZMUYw'
            },
            {
                title: '⚡ Advanced Queries',
                description: 'Subqueries, CTEs, and window functions',
                duration: 60,
                order: 3,
                videoTitle: 'Advanced SQL Techniques',
                videoUrl: 'https://www.youtube.com/embed/cwKVadhXypo'
            },
            {
                title: '📈 Performance Optimization',
                description: 'Indexing and query optimization',
                duration: 50,
                order: 4,
                videoTitle: 'SQL Performance Tuning',
                videoUrl: 'https://www.youtube.com/embed/MnzJJT9mW1I'
            },
            {
                title: '🔒 Transactions & Security',
                description: 'ACID properties and SQL security',
                duration: 45,
                order: 5,
                videoTitle: 'Database Transactions and Security',
                videoUrl: 'https://www.youtube.com/embed/h-eNtf-fY_A'
            }
        ]
    },

    // Design & Creative
    'UI/UX Design': {
        description: 'Create beautiful and functional user experiences',
        modules: [
            {
                title: '🎨 Design Principles',
                description: 'Color, typography, and layout fundamentals',
                duration: 55,
                order: 1,
                videoTitle: 'Design Principles for UX/UI',
                videoUrl: 'https://www.youtube.com/embed/c9Wg6Cb_YlU'
            },
            {
                title: '📐 Wireframing & Prototyping',
                description: 'Create wireframes and interactive prototypes',
                duration: 60,
                order: 2,
                videoTitle: 'Wireframing and Prototyping Techniques',
                videoUrl: 'https://www.youtube.com/embed/RxPkFVXLhVo'
            },
            {
                title: '🎯 User Research',
                description: 'Understand your users and their needs',
                duration: 50,
                order: 3,
                videoTitle: 'User Research Methods',
                videoUrl: 'https://www.youtube.com/embed/Aqhz7-D6uFc'
            },
            {
                title: '✨ Visual Design',
                description: 'Create stunning visual designs',
                duration: 65,
                order: 4,
                videoTitle: 'Visual Design in Digital Products',
                videoUrl: 'https://www.youtube.com/embed/nfKVVQC5_-8'
            },
            {
                title: '🧪 Testing & Iteration',
                description: 'User testing and design iteration',
                duration: 50,
                order: 5,
                videoTitle: 'User Testing and Feedback',
                videoUrl: 'https://www.youtube.com/embed/PmN0JJIj5u0'
            }
        ]
    },
    'Graphic Design': {
        description: 'Master visual communication',
        modules: [
            {
                title: '🎨 Design Fundamentals',
                description: 'Color theory and composition',
                duration: 50,
                order: 1,
                videoTitle: 'Graphic Design Basics',
                videoUrl: 'https://www.youtube.com/embed/a9x6Kcwqe8U'
            },
            {
                title: '✏️ Typography',
                description: 'Choose and use fonts effectively',
                duration: 45,
                order: 2,
                videoTitle: 'Typography Masterclass',
                videoUrl: 'https://www.youtube.com/embed/QrNi9FV7_1A'
            },
            {
                title: '🖼️ Image Composition',
                description: 'Arrange visual elements effectively',
                duration: 55,
                order: 3,
                videoTitle: 'Visual Composition Techniques',
                videoUrl: 'https://www.youtube.com/embed/O8i7gX8sBxQ'
            },
            {
                title: '🎭 Branding & Identity',
                description: 'Create consistent brand visuals',
                duration: 60,
                order: 4,
                videoTitle: 'Brand Identity Design',
                videoUrl: 'https://www.youtube.com/embed/H5UZB9pXl84'
            },
            {
                title: '📱 Digital & Print',
                description: 'Designing for different media',
                duration: 50,
                order: 5,
                videoTitle: 'Design for Digital and Print',
                videoUrl: 'https://www.youtube.com/embed/e2MfxhTtN_Y'
            }
        ]
    },
    'Adobe Photoshop': {
        description: 'Professional photo editing and design',
        modules: [
            {
                title: '🎬 Interface & Setup',
                description: 'Learn the Photoshop workspace',
                duration: 40,
                order: 1,
                videoTitle: 'Photoshop Interface Overview'
            },
            {
                title: '🔧 Essential Tools',
                description: 'Selection, painting, and transformation tools',
                duration: 50,
                order: 2,
                videoTitle: 'Photoshop Essential Tools'
            },
            {
                title: '📸 Photo Editing',
                description: 'Retouch and enhance photos',
                duration: 60,
                order: 3,
                videoTitle: 'Professional Photo Editing'
            },
            {
                title: '🎨 Layers & Masks',
                description: 'Work with layers and masks efficiently',
                duration: 55,
                order: 4,
                videoTitle: 'Photoshop Layers and Masking'
            },
            {
                title: '✨ Advanced Effects',
                description: 'Create stunning visual effects',
                duration: 65,
                order: 5,
                videoTitle: 'Advanced Photoshop Effects'
            }
        ]
    },
    'Figma': {
        description: 'Collaborative design tool mastery',
        modules: [
            {
                title: '🎯 Figma Basics',
                description: 'Interface and essential features',
                duration: 45,
                order: 1,
                videoTitle: 'Getting Started with Figma'
            },
            {
                title: '📐 Components & Frames',
                description: 'Create reusable components',
                duration: 50,
                order: 2,
                videoTitle: 'Figma Components and Frames'
            },
            {
                title: '🎨 Design Systems',
                description: 'Build consistent design systems',
                duration: 60,
                order: 3,
                videoTitle: 'Building Design Systems in Figma'
            },
            {
                title: '🎬 Prototyping',
                description: 'Interactive prototypes in Figma',
                duration: 55,
                order: 4,
                videoTitle: 'Creating Prototypes in Figma'
            },
            {
                title: '👥 Collaboration',
                description: 'Team collaboration and handoff',
                duration: 45,
                order: 5,
                videoTitle: 'Figma Collaboration Features'
            }
        ]
    },

    // Marketing & Sales
    'Digital Marketing': {
        description: 'Complete digital marketing strategy',
        modules: [
            {
                title: '📊 Marketing Fundamentals',
                description: 'Core concepts and strategy',
                duration: 50,
                order: 1,
                videoTitle: 'Digital Marketing Fundamentals'
            },
            {
                title: '📈 Analytics & Metrics',
                description: 'Measure and analyze marketing performance',
                duration: 55,
                order: 2,
                videoTitle: 'Digital Marketing Analytics'
            },
            {
                title: '🎯 Audience Targeting',
                description: 'Find and reach your target audience',
                duration: 50,
                order: 3,
                videoTitle: 'Audience Segmentation and Targeting'
            },
            {
                title: '📱 Multi-Channel Strategy',
                description: 'Integrated marketing across channels',
                duration: 60,
                order: 4,
                videoTitle: 'Omnichannel Marketing Strategy'
            },
            {
                title: '💡 Campaign Planning',
                description: 'Plan and execute marketing campaigns',
                duration: 55,
                order: 5,
                videoTitle: 'Marketing Campaign Planning'
            }
        ]
    },
    'Social Media Marketing': {
        description: 'Master social media platforms',
        modules: [
            {
                title: '📱 Platform Strategies',
                description: 'Strategy for each social platform',
                duration: 50,
                order: 1,
                videoTitle: 'Social Media Platform Strategies'
            },
            {
                title: '📸 Content Creation',
                description: 'Create engaging social media content',
                duration: 55,
                order: 2,
                videoTitle: 'Content Creation for Social Media'
            },
            {
                title: '👥 Community Management',
                description: 'Build and engage communities',
                duration: 45,
                order: 3,
                videoTitle: 'Community Management Best Practices'
            },
            {
                title: '📊 Social Analytics',
                description: 'Track and measure social performance',
                duration: 50,
                order: 4,
                videoTitle: 'Social Media Analytics'
            },
            {
                title: '📈 Growth Hacking',
                description: 'Grow your social presence',
                duration: 55,
                order: 5,
                videoTitle: 'Social Media Growth Hacking'
            }
        ]
    },
    'SEO': {
        description: 'Search Engine Optimization mastery',
        modules: [
            {
                title: '🔍 SEO Fundamentals',
                description: 'How search engines work',
                duration: 50,
                order: 1,
                videoTitle: 'SEO Fundamentals Explained'
            },
            {
                title: '🔑 Keyword Research',
                description: 'Find the right keywords to target',
                duration: 45,
                order: 2,
                videoTitle: 'Keyword Research Strategies'
            },
            {
                title: '📝 On-Page SEO',
                description: 'Optimize your web pages',
                duration: 50,
                order: 3,
                videoTitle: 'On-Page SEO Techniques'
            },
            {
                title: '🔗 Link Building',
                description: 'Build authority with quality links',
                duration: 55,
                order: 4,
                videoTitle: 'Link Building Strategies'
            },
            {
                title: '📊 SEO Analytics',
                description: 'Track and measure SEO success',
                duration: 50,
                order: 5,
                videoTitle: 'SEO Metrics and Reporting'
            }
        ]
    },

    // Data & Analytics
    'Data Analysis': {
        description: 'Master data analysis techniques',
        modules: [
            {
                title: '📊 Data Fundamentals',
                description: 'Types of data and data sources',
                duration: 45,
                order: 1,
                videoTitle: 'Data Analysis Fundamentals'
            },
            {
                title: '🔢 Statistical Analysis',
                description: 'Descriptive and inferential statistics',
                duration: 60,
                order: 2,
                videoTitle: 'Statistics for Data Analysis'
            },
            {
                title: '📈 Data Visualization',
                description: 'Create meaningful visualizations',
                duration: 50,
                order: 3,
                videoTitle: 'Data Visualization Techniques'
            },
            {
                title: '🔍 Exploratory Data Analysis',
                description: 'Discover insights in your data',
                duration: 55,
                order: 4,
                videoTitle: 'Exploratory Data Analysis'
            },
            {
                title: '💡 Insights & Reporting',
                description: 'Present findings effectively',
                duration: 50,
                order: 5,
                videoTitle: 'Data Insights and Reporting'
            }
        ]
    },
    'Power BI': {
        description: 'Business intelligence with Power BI',
        modules: [
            {
                title: '📊 Power BI Basics',
                description: 'Interface and data import',
                duration: 50,
                order: 1,
                videoTitle: 'Power BI for Beginners'
            },
            {
                title: '📈 Data Transformation',
                description: 'Power Query and data modeling',
                duration: 55,
                order: 2,
                videoTitle: 'Power Query and Data Modeling'
            },
            {
                title: '📉 Dashboard Design',
                description: 'Create interactive dashboards',
                duration: 60,
                order: 3,
                videoTitle: 'Dashboard Design with Power BI'
            },
            {
                title: '🔧 DAX Formulas',
                description: 'Advanced calculations with DAX',
                duration: 65,
                order: 4,
                videoTitle: 'Power BI DAX Language'
            },
            {
                title: '📱 Publishing & Sharing',
                description: 'Share reports and dashboards',
                duration: 45,
                order: 5,
                videoTitle: 'Sharing Power BI Reports'
            }
        ]
    },

    // Business & Finance
    'Project Management': {
        description: 'Lead successful projects',
        modules: [
            {
                title: '📋 PM Fundamentals',
                description: 'Project management basics',
                duration: 50,
                order: 1,
                videoTitle: 'Project Management Basics'
            },
            {
                title: '🎯 Planning & Scope',
                description: 'Define project scope and plan',
                duration: 55,
                order: 2,
                videoTitle: 'Project Planning and Scope Management'
            },
            {
                title: '⏱️ Time & Resource Management',
                description: 'Schedule and allocate resources',
                duration: 50,
                order: 3,
                videoTitle: 'Resource and Time Management'
            },
            {
                title: '💰 Cost Management',
                description: 'Budget and cost control',
                duration: 45,
                order: 4,
                videoTitle: 'Project Cost Management'
            },
            {
                title: '👥 Team & Stakeholders',
                description: 'Lead teams and manage stakeholders',
                duration: 55,
                order: 5,
                videoTitle: 'Project Leadership and Communication'
            }
        ]
    },
    'Accounting': {
        description: 'Financial accounting fundamentals',
        modules: [
            {
                title: '📚 Accounting Basics',
                description: 'Debits, credits, and journal entries',
                duration: 50,
                order: 1,
                videoTitle: 'Accounting Fundamentals'
            },
            {
                title: '📊 Financial Statements',
                description: 'Income statement, balance sheet, cash flow',
                duration: 55,
                order: 2,
                videoTitle: 'Understanding Financial Statements'
            },
            {
                title: '📈 Analysis & Ratios',
                description: 'Financial ratio analysis',
                duration: 50,
                order: 3,
                videoTitle: 'Financial Analysis and Ratios'
            },
            {
                title: '🔍 Auditing & Compliance',
                description: 'Internal controls and auditing',
                duration: 55,
                order: 4,
                videoTitle: 'Auditing and Compliance'
            },
            {
                title: '💼 Corporate Accounting',
                description: 'Advanced accounting topics',
                duration: 60,
                order: 5,
                videoTitle: 'Corporate Accounting Concepts'
            }
        ]
    },

    // Writing
    'Content Writing': {
        description: 'Master professional content writing',
        modules: [
            {
                title: '✍️ Writing Fundamentals',
                description: 'Grammar, style, and tone',
                duration: 50,
                order: 1,
                videoTitle: 'Writing Fundamentals'
            },
            {
                title: '📱 Web Writing',
                description: 'Writing for websites and blogs',
                duration: 45,
                order: 2,
                videoTitle: 'Web Content Writing'
            },
            {
                title: '📰 Journalism Basics',
                description: 'News writing and reporting',
                duration: 55,
                order: 3,
                videoTitle: 'Journalism and News Writing'
            },
            {
                title: '📚 Long-Form Content',
                description: 'Write comprehensive articles and guides',
                duration: 60,
                order: 4,
                videoTitle: 'Long-Form Content Writing'
            },
            {
                title: '🎯 Content Strategy',
                description: 'Plan and organize your content',
                duration: 50,
                order: 5,
                videoTitle: 'Content Strategy and Planning'
            }
        ]
    },

    // Photography & Video
    'Photography': {
        description: 'Professional photography skills',
        modules: [
            {
                title: '📷 Camera Basics',
                description: 'Exposure, aperture, and shutter speed',
                duration: 50,
                order: 1,
                videoTitle: 'Photography Fundamentals'
            },
            {
                title: '🎨 Composition',
                description: 'Frame and compose compelling images',
                duration: 45,
                order: 2,
                videoTitle: 'Photography Composition'
            },
            {
                title: '💡 Lighting',
                description: 'Master light for photography',
                duration: 55,
                order: 3,
                videoTitle: 'Photography Lighting Techniques'
            },
            {
                title: '📸 Genre Photography',
                description: 'Different styles of photography',
                duration: 50,
                order: 4,
                videoTitle: 'Photography Genres and Styles'
            },
            {
                title: '🎞️ Post-Processing',
                description: 'Edit photos professionally',
                duration: 60,
                order: 5,
                videoTitle: 'Photo Editing and Post-Processing'
            }
        ]
    },
    'Video Editing': {
        description: 'Professional video editing skills',
        modules: [
            {
                title: '🎬 Video Fundamentals',
                description: 'Frame rates, resolution, and codecs',
                duration: 45,
                order: 1,
                videoTitle: 'Video Editing Basics'
            },
            {
                title: '✂️ Cutting & Sequencing',
                description: 'Edit footage together',
                duration: 50,
                order: 2,
                videoTitle: 'Video Cutting Techniques'
            },
            {
                title: '🎨 Color Correction',
                description: 'Color grading and correction',
                duration: 55,
                order: 3,
                videoTitle: 'Video Color Correction'
            },
            {
                title: '🎵 Audio Mixing',
                description: 'Sound design and audio mixing',
                duration: 60,
                order: 4,
                videoTitle: 'Audio Mixing for Video'
            },
            {
                title: '✨ Effects & Motion',
                description: 'Add effects and motion graphics',
                duration: 65,
                order: 5,
                videoTitle: 'Video Effects and Motion Graphics'
            }
        ]
    },

    // Teaching
    'Teaching': {
        description: 'Effective teaching methods',
        modules: [
            {
                title: '🎓 Teaching Fundamentals',
                description: 'Core teaching principles',
                duration: 50,
                order: 1,
                videoTitle: 'Teaching Fundamentals'
            },
            {
                title: '📚 Curriculum Design',
                description: 'Plan courses and lessons',
                duration: 55,
                order: 2,
                videoTitle: 'Curriculum Design'
            },
            {
                title: '👥 Classroom Management',
                description: 'Create effective learning environments',
                duration: 50,
                order: 3,
                videoTitle: 'Classroom Management Strategies'
            },
            {
                title: '📊 Assessment & Feedback',
                description: 'Evaluate student learning',
                duration: 55,
                order: 4,
                videoTitle: 'Student Assessment Methods'
            },
            {
                title: '💻 Technology in Teaching',
                description: 'Use technology effectively',
                duration: 50,
                order: 5,
                videoTitle: 'Technology in Education'
            }
        ]
    },

    // Health & Fitness
    'Personal Training': {
        description: 'Fitness training expertise',
        modules: [
            {
                title: '💪 Training Fundamentals',
                description: 'Exercise science basics',
                duration: 50,
                order: 1,
                videoTitle: 'Personal Training Fundamentals'
            },
            {
                title: '🏋️ Strength Training',
                description: 'Build muscle and strength',
                duration: 55,
                order: 2,
                videoTitle: 'Strength Training Techniques'
            },
            {
                title: '🏃 Cardio & Conditioning',
                description: 'Improve cardiovascular fitness',
                duration: 50,
                order: 3,
                videoTitle: 'Cardio Training Programs'
            },
            {
                title: '🍎 Nutrition',
                description: 'Nutrition for fitness',
                duration: 45,
                order: 4,
                videoTitle: 'Nutrition for Athletes'
            },
            {
                title: '📋 Program Design',
                description: 'Create personalized training programs',
                duration: 60,
                order: 5,
                videoTitle: 'Training Program Design'
            }
        ]
    },
    'Nutrition': {
        description: 'Professional nutrition guidance',
        modules: [
            {
                title: '🥗 Nutrition Basics',
                description: 'Macro and micronutrients',
                duration: 50,
                order: 1,
                videoTitle: 'Nutrition Fundamentals'
            },
            {
                title: '🍽️ Meal Planning',
                description: 'Plan nutritious meals',
                duration: 45,
                order: 2,
                videoTitle: 'Meal Planning Strategies'
            },
            {
                title: '💪 Sports Nutrition',
                description: 'Nutrition for athletic performance',
                duration: 55,
                order: 3,
                videoTitle: 'Sports Nutrition'
            },
            {
                title: '📊 Nutritional Assessment',
                description: 'Assess nutritional needs',
                duration: 50,
                order: 4,
                videoTitle: 'Nutritional Assessment'
            },
            {
                title: '🏥 Therapeutic Nutrition',
                description: 'Nutrition for health conditions',
                duration: 60,
                order: 5,
                videoTitle: 'Therapeutic Nutrition'
            }
        ]
    },

    // Lifestyle
    'Cooking': {
        description: 'Master culinary skills',
        modules: [
            {
                title: '👨‍🍳 Cooking Fundamentals',
                description: 'Basic cooking techniques',
                duration: 50,
                order: 1,
                videoTitle: 'Cooking Fundamentals'
            },
            {
                title: '🔪 Knife Skills',
                description: 'Master knife techniques',
                duration: 40,
                order: 2,
                videoTitle: 'Professional Knife Skills'
            },
            {
                title: '🍲 Cuisine Types',
                description: 'Different cuisines and styles',
                duration: 55,
                order: 3,
                videoTitle: 'World Cuisines'
            },
            {
                title: '🍰 Baking & Pastry',
                description: 'Baking and pastry making',
                duration: 60,
                order: 4,
                videoTitle: 'Baking and Pastry Techniques'
            },
            {
                title: '🍽️ Menu Planning',
                description: 'Plan and execute menus',
                duration: 50,
                order: 5,
                videoTitle: 'Menu Planning and Execution'
            }
        ]
    }
};

// Function to create generic modules for any skill
function createGenericModuleTemplate(skillName) {
    const emojis = ['📖', '🎯', '⚡', '🔧', '✨'];
    const descriptions = [
        'Fundamentals and core concepts',
        'Dive deeper into the subject',
        'Advanced techniques and tips',
        'Practical applications',
        'Mastery and expertise'
    ];
    
    return {
        description: `Master ${skillName}`,
        modules: [
            {
                title: `${emojis[0]} ${skillName} Fundamentals`,
                description: descriptions[0],
                duration: 45,
                order: 1,
                videoTitle: `${skillName} Fundamentals - Complete Tutorial`,
                videoUrl: `https://www.youtube.com/embed/dQw4w9WgXcQ` // Fallback
            },
            {
                title: `${emojis[1]} Core Concepts`,
                description: descriptions[1],
                duration: 50,
                order: 2,
                videoTitle: `${skillName} Core Concepts`,
                videoUrl: `https://www.youtube.com/embed/dQw4w9WgXcQ` // Fallback
            },
            {
                title: `${emojis[2]} Advanced Techniques`,
                description: descriptions[2],
                duration: 55,
                order: 3,
                videoTitle: `Advanced ${skillName} Techniques`,
                videoUrl: `https://www.youtube.com/embed/dQw4w9WgXcQ` // Fallback
            },
            {
                title: `${emojis[3]} Practical Skills`,
                description: descriptions[3],
                duration: 60,
                order: 4,
                videoTitle: `${skillName} - Practical Applications`,
                videoUrl: `https://www.youtube.com/embed/dQw4w9WgXcQ` // Fallback
            },
            {
                title: `${emojis[4]} Mastery`,
                description: descriptions[4],
                duration: 50,
                order: 5,
                videoTitle: `Become a ${skillName} Master`,
                videoUrl: `https://www.youtube.com/embed/dQw4w9WgXcQ` // Fallback
            }
        ]
    };
}

async function seedModulesForAllLearningPaths() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📡 Connected to MongoDB');

        // Get all learning paths
        const learningPaths = await LearningPath.find().populate('skillId');
        console.log(`📚 Found ${learningPaths.length} learning paths to update`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const lp of learningPaths) {
            try {
                const skillName = lp.skillId?.name;
                
                if (!skillName) {
                    console.warn(`⚠️  Skipping learning path - no skill name found`);
                    skippedCount++;
                    continue;
                }

                // Find matching modules for this skill
                let moduleTemplate = skillModulesData[skillName];
                
                if (!moduleTemplate) {
                    console.log(`ℹ️  No specific template for skill: ${skillName}, using generic template`);
                    // Use generic template for any skill
                    moduleTemplate = createGenericModuleTemplate(skillName);
                }

                // Create modules from template with videoUrl
                const modules = moduleTemplate.modules.map(mod => {
                    const moduleObj = {
                        moduleId: new mongoose.Types.ObjectId(),
                        title: mod.title,
                        description: mod.description,
                        duration: mod.duration,
                        order: mod.order,
                        videoTitle: mod.videoTitle,
                        videoUrl: mod.videoUrl || `https://www.youtube.com/embed/dQw4w9WgXcQ`, // Fallback URL
                        isCompleted: false,
                        createdAt: new Date()
                    };
                    return moduleObj;
                });

                // Update learning path
                const totalDuration = modules.reduce((sum, m) => sum + m.duration, 0);
                
                lp.modules = modules;
                lp.totalModules = modules.length;
                lp.estimatedDuration = totalDuration;
                lp.updatedAt = new Date();

                await lp.save();
                updatedCount++;
                console.log(`✅ Updated ${skillName}: ${modules.length} modules added`);
            } catch (error) {
                console.error(`❌ Error updating learning path:`, error.message);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Updated: ${updatedCount}`);
        console.log(`   ⚠️  Skipped: ${skippedCount}`);
        console.log(`   📚 Total: ${learningPaths.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding modules:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedModulesForAllLearningPaths();
}

module.exports = { seedModulesForAllLearningPaths, skillModulesData };
