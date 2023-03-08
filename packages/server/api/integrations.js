const CharacterModel = require('models/character');
const { handleError, isValidTelegramUser } = require('utils/api');
const { sendMessage } = require('bot/helpers/reports');
const agenda = require('services/agenda');

async function connectWax(req, res) {
  const { telegramUser, waxUser } = req.body;

  if (!telegramUser || !waxUser) {
    return handleError(res, 'Failed. No data provided.');
  }

  if (!isValidTelegramUser(telegramUser)) {
    return handleError(res, 'Failed. Invalid data.');
  }

  try {
    await CharacterModel.updateOne(
      { userId: telegramUser.id },
      { waxWallet: { account: waxUser.account, keys: waxUser.keys } }
    );

    await sendMessage(telegramUser.id, 'WAX wallet connected');

    return res.status(200).send({ success: true });
  } catch (err) {
    return handleError(res, 'Failed.');
  }
}

async function disconnectWax(req, res) {
  const { telegramUser } = req.body;

  if (!telegramUser) {
    return handleError(res, 'Failed. No data provided.');
  }

  if (!isValidTelegramUser(telegramUser)) {
    return handleError(res, 'Failed. Invalid data.');
  }

  try {
    await CharacterModel.updateOne({ userId: telegramUser.id }, { waxWallet: null });
    await sendMessage(telegramUser.id, 'WAX wallet disconnected');

    return res.status(200).send({ success: true });
  } catch (err) {
    return handleError(res, 'Failed.');
  }
}

async function getWax(req, res) {
  const { telegramUser } = req.body;

  if (!telegramUser) {
    return handleError(res, 'Failed. No data provided.');
  }

  if (!isValidTelegramUser(telegramUser)) {
    return handleError(res, 'Failed. Invalid data.');
  }

  try {
    const character = await CharacterModel.findOne({ userId: telegramUser.id });

    return res.status(200).send({ waxWallet: character.waxWallet });
  } catch (err) {
    return handleError(res, 'Failed.');
  }
}

async function handleWaxTransaction(req, res) {
  const { telegramUser, transactionId } = req.body;

  if (!telegramUser || !transactionId) {
    return handleError(res, 'Failed. No data provided.');
  }

  if (!isValidTelegramUser(telegramUser)) {
    return handleError(res, 'Failed. Invalid data.');
  }

  await agenda.schedule('in 10 seconds', 'bank_transaction', { transactionId });

  return res.status(200).send({ success: true });
}

module.exports = {
  getWax,
  connectWax,
  disconnectWax,
  handleWaxTransaction
};
