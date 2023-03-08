const SettingsManager = require('bot/managers/SettingsManager');

function sendMessage(userId, message, photoId, params) {
  const bot = require('bot');

  return photoId
    ? bot.api.sendPhoto(userId, photoId, { caption: message, ...params })
    : bot.api.sendMessage(userId, message, params);
}

function sendReport(character, phraseKey, phraseParams = {}) {
  const { userId } = character;
  const message = character.t(phraseKey, phraseParams);

  sendMessage(userId, message);
}

function sendAdminsReport(message) {
  sendMessage(SettingsManager.ADMIN_USER_ID, message);
}

function sendReportByKeys(character, phraseKeys) {
  const { userId } = character;
  const message = phraseKeys.reduce((str, { key, params = {} }) => {
    return str + `\n\n${character.t(key, params)}`;
  }, '');

  sendMessage(userId, message);
}

function sendReportByUserId(userId, phraseKey, phraseParams = {}) {
  const CharacterModel = require('../../models/character');

  CharacterModel.findOne({ userId }, { userId: 1, userLang: 1 }).exec((err, character) => {
    sendReport(character, phraseKey, phraseParams);
  });
}

function sendNewCharacterReport(character) {
  const { username, firstName, lastName, customName, userLang, userId, refId } = character;
  const reportMessage = `New character registered!\n\nuserId: ${userId}\nusername: ${username}\nfirstname: ${firstName}\nlastname: ${lastName}\ncustomname: ${customName}\nlang: ${userLang}\nrefId: ${refId}`;

  sendMessage(SettingsManager.ADMIN_USER_ID, reportMessage);
}

function sendNewClanReport(clan) {
  const { name, icon } = clan;

  sendMessage(SettingsManager.ADMIN_USER_ID, `New clan registered!\n\nname: ${name}\nicon: ${icon}`);
}

module.exports = {
  sendMessage,
  sendReport,
  sendAdminsReport,
  sendReportByKeys,
  sendReportByUserId,
  sendNewCharacterReport,
  sendNewClanReport
};
