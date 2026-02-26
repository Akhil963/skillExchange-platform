const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables. Please check your .env file.');
    }

    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10, // Connection pooling for better performance
      minPoolSize: 2,
    };

    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 URI: ${process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@')}`); // Hide credentials in logs

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Initialize indexes on connection
    if (process.env.NODE_ENV === 'production' || process.env.INIT_INDEXES === 'true') {
      try {
        const { initializeIndexes } = require('./indexing');
        await initializeIndexes();
      } catch (indexError) {
        console.warn('⚠️  Index initialization warning:', indexError.message);
      }
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.warn('⚠️  Continuing without database connection - requests will fail gracefully');
    return null;
  }
};

module.exports = connectDB;
