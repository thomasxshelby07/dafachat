const { getRedis } = require('../config/db');

const cacheMiddleware = (keyGenerator, ttlSeconds = 300) => {
  return async (req, res, next) => {
    try {
      const redis = getRedis();
      if (!redis) return next();

      const key = typeof keyGenerator === 'function'
        ? keyGenerator(req)
        : keyGenerator;

      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        originalJson(data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    try {
      const redis = getRedis();
      if (!redis) return next();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      // Ignore cache invalidation errors
    }
    next();
  };
};

module.exports = { cacheMiddleware, invalidateCache };
