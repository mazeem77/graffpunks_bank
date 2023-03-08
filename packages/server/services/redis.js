const redis = require('redis');
const config = require('../config');

const redisClient = redis.createClient({
  url: config.REDIS_URL,
  legacyMode: true
});

redisClient.on('connect', () => {
  console.log('[Redis]: Connected!');
});

module.exports = redisClient;
