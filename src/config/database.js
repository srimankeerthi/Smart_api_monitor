// src/config/database.js
// Mongoose connection with retry logic and graceful shutdown

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB with automatic retry on failure.
 * Retries up to `maxRetries` times with exponential back-off.
 */
const connectDB = async (retries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        // These options silence deprecation warnings in Mongoose 7+
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        logger.error('All MongoDB connection attempts exhausted — exiting');
        process.exit(1);
      }
      // Exponential back-off: 3s, 6s, 12s …
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
};

// Graceful shutdown helper — called by app.js on SIGINT/SIGTERM
const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

module.exports = { connectDB, disconnectDB };
