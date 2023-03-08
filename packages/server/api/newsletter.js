const NewsletterQueue = require('./helpers/NewsletterQueue');

/**
 * Send newsletter
 */
async function send(req, res) {
  const { messages, image, button } = req.body;
  const newsletter = new NewsletterQueue(messages, image, button);

  newsletter.run();

  res.end('Started');
}

module.exports = {
  send
};
