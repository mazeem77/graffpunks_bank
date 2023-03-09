module.exports = {
  HOST: process.env.HOST,
  PORT: process.env.PORT,

  API_URL: process.env.API_URL,
  API_TOKEN: process.env.API_TOKEN,

  WEB_URL: process.env.WEB_URL,
  WEB_URL_BANK: process.env.WEB_URL_BANK,

  ENV: process.env.NODE_ENV,
  BOT_ENV: process.env.BOT_ENV,
  BOT_URL: process.env.BOT_URL,
  BOT_API_TOKEN: process.env.BOT_API_TOKEN,
  BOT_USE_WEBHOOK: JSON.parse(process.env.BOT_USE_WEBHOOK || ''),

  MONGODB_URL: process.env.MONGODB_URL,
  REDIS_URL: process.env.REDIS_URL
};
