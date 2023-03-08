const Telegram = require('bot/lib/core/Telegram');
const CharacterModel = require('models/character');

class CallbackQueryController extends Telegram.TelegramBaseCallbackQueryController {
  handle(callbackQuery) {
    return this.handleOutdated(callbackQuery);
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  async handleOutdated(callbackQuery) {
    const { id, userId } = callbackQuery;
    const character = await this.loadCharacter(userId);
    const text = character.t('inlineMenuOutdated');

    await this.api.answerCallbackQuery(id, { show_alert: true, text });
  }
}

module.exports = CallbackQueryController;
