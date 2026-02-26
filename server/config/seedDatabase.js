require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Exchange = require('../models/Exchange');
const Conversation = require('../models/Conversation');

const sampleUsers = [
  {
    name: "Sarah Chen",
    email: "sarah@example.com",
    username: "sarah_chen",
    phone: "+1-555-0101",
    password: "password123",
    bio: "Full-stack developer passionate about teaching web technologies and learning design skills",
    location: "San Francisco, CA",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b5c0?w=150&h=150&fit=crop&crop=face",
    rating: 4.8,
    total_exchanges: 23,
    tokens_earned: 340,
    skills_offered: [
      {
        name: "React Development",
        category: "Programming",
        experience_level: "Expert",
        description: "Building modern web applications with React, Redux, and hooks"
      },
      {
        name: "Node.js Backend",
        category: "Programming",
        experience_level: "Advanced",
        description: "Server-side development with Express, MongoDB, and APIs"
      }
    ],
    skills_wanted: [
      {
        name: "UI/UX Design",
        category: "Design",
        experience_level: "Beginner",
        description: "Learning user interface and experience design principles"
      },
      {
        name: "Digital Marketing",
        category: "Marketing",
        experience_level: "Intermediate",
        description: "Social media marketing and SEO strategies"
      }
    ],
    badges: ["First Exchange", "5-Star Rating", "Helpful Mentor", "Quick Responder"],
    active_exchanges: 3
  },
  {
    name: "Miguel Rodriguez",
    email: "miguel@example.com",
    username: "miguel_dev",
    phone: "+1-555-0102",
    password: "password123",
    bio: "Graphic designer and digital artist looking to expand into web development",
    location: "Austin, TX",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    rating: 4.9,
    total_exchanges: 31,
    tokens_earned: 475,
    skills_offered: [
      {
        name: "Graphic Design",
        category: "Design",
        experience_level: "Expert",
        description: "Logo design, branding, and visual identity creation"
      },
      {
        name: "Adobe Creative Suite",
        category: "Design",
        experience_level: "Expert",
        description: "Photoshop, Illustrator, InDesign mastery"
      },
      {
        name: "Digital Illustration",
        category: "Art",
        experience_level: "Advanced",
        description: "Character design and digital artwork"
      }
    ],
    skills_wanted: [
      {
        name: "JavaScript",
        category: "Programming",
        experience_level: "Beginner",
        description: "Basic programming and web interactivity"
      },
      {
        name: "Python",
        category: "Programming",
        experience_level: "Beginner",
        description: "Data analysis and automation scripts"
      }
    ],
    badges: ["First Exchange", "5-Star Rating", "Design Master", "Community Helper", "Top Contributor"],
    active_exchanges: 2
  },
  {
    name: "Dr. Priya Patel",
    email: "priya@example.com",
    username: "priya_data",
    phone: "+1-555-0103",
    password: "password123",
    bio: "Data scientist and researcher interested in creative skills and business strategy",
    location: "New York, NY",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face",
    rating: 4.7,
    total_exchanges: 18,
    tokens_earned: 290,
    skills_offered: [
      {
        name: "Data Science",
        category: "Technology",
        experience_level: "Expert",
        description: "Machine learning, statistics, and data visualization"
      },
      {
        name: "Python Programming",
        category: "Programming",
        experience_level: "Expert",
        description: "Advanced Python for data analysis and automation"
      },
      {
        name: "Research Methods",
        category: "Academic",
        experience_level: "Expert",
        description: "Scientific research design and statistical analysis"
      }
    ],
    skills_wanted: [
      {
        name: "Photography",
        category: "Art",
        experience_level: "Beginner",
        description: "Portrait and landscape photography techniques"
      },
      {
        name: "Business Strategy",
        category: "Business",
        experience_level: "Intermediate",
        description: "Strategic planning and market analysis"
      }
    ],
    badges: ["First Exchange", "Data Expert", "Research Pro"],
    active_exchanges: 1
  },
  {
    name: "James Wilson",
    email: "james@example.com",
    username: "james_marketing",
    phone: "+1-555-0104",
    password: "password123",
    bio: "Marketing professional and photographer wanting to learn coding and design",
    location: "Seattle, WA",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    rating: 4.6,
    total_exchanges: 15,
    tokens_earned: 230,
    skills_offered: [
      {
        name: "Digital Marketing",
        category: "Marketing",
        experience_level: "Expert",
        description: "SEO, social media marketing, and content strategy"
      },
      {
        name: "Photography",
        category: "Art",
        experience_level: "Advanced",
        description: "Portrait, event, and commercial photography"
      },
      {
        name: "Content Writing",
        category: "Writing",
        experience_level: "Advanced",
        description: "Blog posts, copy writing, and content strategy"
      }
    ],
    skills_wanted: [
      {
        name: "Web Development",
        category: "Programming",
        experience_level: "Beginner",
        description: "HTML, CSS, and basic JavaScript"
      },
      {
        name: "Graphic Design",
        category: "Design",
        experience_level: "Intermediate",
        description: "Visual design and branding skills"
      }
    ],
    badges: ["First Exchange", "Marketing Master", "Photo Pro"],
    active_exchanges: 2
  },
  {
    name: "Lisa Kim",
    email: "lisa@example.com",
    username: "lisa_teacher",
    phone: "+1-555-0105",
    password: "password123",
    bio: "Language teacher and cultural consultant passionate about technology and art",
    location: "Los Angeles, CA",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    rating: 4.9,
    total_exchanges: 27,
    tokens_earned: 410,
    skills_offered: [
      {
        name: "Korean Language",
        category: "Languages",
        experience_level: "Expert",
        description: "Native speaker offering conversational and business Korean"
      },
      {
        name: "English Tutoring",
        category: "Education",
        experience_level: "Expert",
        description: "ESL teaching and academic writing support"
      },
      {
        name: "Cultural Consulting",
        category: "Consulting",
        experience_level: "Advanced",
        description: "Cross-cultural communication and business etiquette"
      }
    ],
    skills_wanted: [
      {
        name: "Mobile App Development",
        category: "Programming",
        experience_level: "Beginner",
        description: "iOS and Android app creation"
      },
      {
        name: "Video Editing",
        category: "Media",
        experience_level: "Intermediate",
        description: "Content creation and storytelling through video"
      }
    ],
    badges: ["First Exchange", "5-Star Rating", "Language Expert", "Cultural Bridge", "Top Mentor"],
    active_exchanges: 4
  }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Exchange.deleteMany({});
    await Conversation.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create users
    const createdUsers = await User.insertMany(sampleUsers);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Create sample exchanges
    const exchanges = [
      {
        requester_id: createdUsers[0]._id,
        provider_id: createdUsers[1]._id,
        requested_skill: "Graphic Design",
        offered_skill: "React Development",
        status: "active",
        messages: [
          {
            user_id: createdUsers[0]._id,
            message: "Hi Miguel! I'd love to learn graphic design from you. I can teach you React in exchange.",
            timestamp: new Date('2024-10-10T14:30:00')
          },
          {
            user_id: createdUsers[1]._id,
            message: "That sounds perfect Sarah! I've been wanting to learn React. When would you like to start?",
            timestamp: new Date('2024-10-10T15:45:00')
          },
          {
            user_id: createdUsers[0]._id,
            message: "How about we start with a 1-hour session this weekend? I can show you React basics first.",
            timestamp: new Date('2024-10-10T16:20:00')
          }
        ]
      },
      {
        requester_id: createdUsers[2]._id,
        provider_id: createdUsers[3]._id,
        requested_skill: "Photography",
        offered_skill: "Data Science",
        status: "completed",
        completed_date: new Date('2024-10-01'),
        rating: 5,
        review: "James was an excellent photography teacher! Very patient and knowledgeable.",
        sessions_completed: 4,
        total_hours: 8
      },
      {
        requester_id: createdUsers[3]._id,
        provider_id: createdUsers[0]._id,
        requested_skill: "Web Development",
        offered_skill: "Digital Marketing",
        status: "pending",
        messages: [
          {
            user_id: createdUsers[3]._id,
            message: "Hi Sarah! I saw your React skills and would love to learn web development. I can teach digital marketing in return.",
            timestamp: new Date('2024-10-14T10:15:00')
          }
        ]
      }
    ];

    const createdExchanges = await Exchange.insertMany(exchanges);
    console.log(`✅ Created ${createdExchanges.length} exchanges`);

    // Create conversations for exchanges with messages
    const conversations = [];
    for (const exchange of createdExchanges) {
      if (exchange.messages && exchange.messages.length > 0) {
        const lastMsg = exchange.messages[exchange.messages.length - 1];
        conversations.push({
          participants: [exchange.requester_id, exchange.provider_id],
          exchange_id: exchange._id,
          lastMessage: {
            content: lastMsg.message,
            sender: lastMsg.user_id,
            timestamp: lastMsg.timestamp
          }
        });
      }
    }

    if (conversations.length > 0) {
      await Conversation.insertMany(conversations);
      console.log(`✅ Created ${conversations.length} conversations`);
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📧 Sample user credentials:');
    console.log('   Email: sarah@example.com | Password: password123');
    console.log('   Email: miguel@example.com | Password: password123');
    console.log('   Email: priya@example.com | Password: password123');
    console.log('   Email: james@example.com | Password: password123');
    console.log('   Email: lisa@example.com | Password: password123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
