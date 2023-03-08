const config = require('config');
const Telegram = require('./lib/core/Telegram');
const botRouter = require('./router');
const botImages = require('./data/images/index');

const files = botImages[config.BOT_ENV];
const bot = new Telegram.Telegram(config.BOT_API_TOKEN, {
  files,
  workers: 0,
  webhook: {
    use: config.BOT_USE_WEBHOOK,
    url: `${config.API_URL}/webhook`,
    port: config.PORT,
    useHandler: true
  }
});

botRouter.initialize(bot);

bot.before((update, callback) => {
  if (update && update.message && update.message.photo) {
    console.info('[Bot]: Photo uploaded', update.message.photo);
  }

  callback(true);
});

module.exports = bot;
