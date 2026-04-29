// src/config/redis.js
// ioredis client — singleton shared across the app

const Redis = require('ioredis');
const logger = require('../utils/logger');

let client = null;

const getRedisClient = () => {
  if (client) return client;

  const options = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    // Reconnect strategy: attempt forever with increasing delays (max 10 s)
    retryStrategy: (times) => Math.min(times * 200, 10000),
    lazyConnect: true, // Don't connect until first command
  };

  if (process.env.REDIS_TLS === 'true') {
    options.tls = {};
  }

  client = new Redis(options);

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));
  client.on('reconnecting', () => logger.info('Redis reconnecting…'));

  return client;
};

/**
 * Convenience helpers so callers don't import ioredis directly
 */
const cacheGet = async (key) => {
  try {
    return await getRedisClient().get(key);
  } catch {
    return null; // Degrade gracefully if Redis is unavailable
  }
};

const cacheSet = async (key, value, ttlSeconds) => {
  try {
    await getRedisClient().set(key, value, 'EX', ttlSeconds);
  } catch {
    // Non-fatal — app continues without cache
  }
};

const cacheDel = async (key) => {
  try {
    await getRedisClient().del(key);
  } catch {}
};

module.exports = { getRedisClient, cacheGet, cacheSet, cacheDel };
