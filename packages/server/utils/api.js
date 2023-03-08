const crypto = require('crypto');

function handleError(res, message) {
  return res.status(403).json({ success: false, message });
}

function isValidTelegramUser(data) {
  const secret = crypto.createHash('sha256').update(process.env.BOT_API_TOKEN).digest();
  const params = [];

  for (let key in data) {
    if (key !== 'hash') {
      params.push(key + '=' + data[key]);
    }
  }

  const checkData = params.sort().join('\n');
  const checkHash = crypto.createHmac('sha256', secret).update(checkData).digest('hex');

  return checkHash === data.hash;
}

module.exports = {
  handleError,
  isValidTelegramUser
};
