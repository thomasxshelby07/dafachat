const mongoose = require('mongoose');
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis = null;
let redisAvailable = false;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    logger.warn('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

const connectRedis = () => {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis not available - running without cache');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      enableOfflineQueue: false,
    });

    redis.on('connect', () => {
      redisAvailable = true;
      logger.info('Redis connected successfully');
    });

    redis.on('ready', () => {
      redisAvailable = true;
    });

    redis.on('error', () => {
      redisAvailable = false;
    });

    redis.on('close', () => {
      redisAvailable = false;
    });

    return redis;
  } catch (error) {
    logger.warn('Redis not available - running without cache');
    return null;
  }
};

const getRedis = () => {
  if (!redis || !redisAvailable) {
    return null;
  }
  return redis;
};

const isRedisAvailable = () => redisAvailable;

module.exports = { connectDB, connectRedis, getRedis, isRedisAvailable };
