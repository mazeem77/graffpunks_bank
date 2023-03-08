const config = require('config');
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');

class OtherwiseController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onMenu: 'sendMenu',
      onRewards: 'sendRewards',
      onHelp: 'sendHelp',
      onGK: 'sendGK',
    };
  }

  handle($) {
    this.sendMenu($);
  }

  sendMenu($) {
    const { userId } = $;

    CharacterModel.findOne({ userId }, { userLang: 1 }).then(character => {
      if (character) {
        const tx = character.getPhrases();

        MenuHelper.sendMainMenu($, tx, {
          message: tx.mainMenuShortMessage
        });
      }
    });
  }

  sendRewards($) {
    const { userId } = $;

    CharacterModel.findOne({ userId }, { userLang: 1 }).then(character => {
      if (character) {
        const refLink = `${config.BOT_URL}?start=${userId}`;
        const referalMessage = character.t('referalMessage', { refLink });
        const rewardsMessage = character.t('rewardsMessage', {
          referalMessage
        });

        $.sendMessage(rewardsMessage, {
          parse_mode: 'html',
          disable_web_page_preview: true
        });
      }
    });
  }

  sendHelp($) {
    const { userId } = $;

    CharacterModel.findOne({ userId }, { userLang: 1 }).then(character => {
      if (character) {
        const tx = character.getPhrases();

        $.sendMessage(tx.helpMessage, {
          parse_mode: 'html',
          disable_web_page_preview: true
        });
      }
    });
  }

  sendGK($) {
    const { userId } = $;

    CharacterModel.findOne({ userId }, { userLang: 1 }).then(character => {
      if (character) {
        const tx = character.getPhrases();

        $.sendMessage(tx.GKMessage, {
          parse_mode: 'html',
          disable_web_page_preview: true
        });
      }
    });
  }
}

module.exports = OtherwiseController;
