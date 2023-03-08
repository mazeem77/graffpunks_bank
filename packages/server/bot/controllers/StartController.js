const config = require('config');
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');
const LANGS = require('data/langs');

class StartController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onStart: 'onStart'
    };
  }

  onStart($) {
    const { userId } = $;

    CharacterModel.findOne({ userId }).then(character => {
      if (character) {
        const tx = character.getPhrases();

        MenuHelper.sendMainMenu($, tx, {
          message: tx.indexAccountExistsMessage
        });

        if (character.deleted) {
          character.deleted = false;
          character.save();
        }

        return;
      }

      const onSelect = userLang => {
        const userData = $.message.from.toJSON();
        const refId = $.message.text.replace('/start ', '');
        const user = { ...userData, userLang, refId };

        return this.createUserCharacter($, user);
      };

      const menuMessage = '🇬🇧 Select your language\n🇷🇺 Выбери язык игры';
      const menuOptions = LANGS.map(lang => ({
        text: lang.text,
        callback: query => {
          onSelect(lang.code);
          query.delete();
        }
      }));

      const menu = {
        layout: 1,
        method: 'sendMessage',
        message: menuMessage,
        menu: menuOptions
      };

      $.runInlineMenu(menu);
    });
  }

  async createUserCharacter($, user) {
    const refId =
      user.refId !== '/start' && user.refId !== user.userId ? user.refId : null;

    const character = await CharacterModel.create({
      refId: refId,
      userId: user.id,
      userLang: user.userLang,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      customName: null
    });

    const tx = character.getPhrases();
    const characterTag = character.renderTag();
    const refLink = `${config.BOT_URL}?start=${character.userId}`;
    const referalMessage = character.t('referalMessage', { refLink });
    const welcomeMessage = character.t('indexWelcomeMessage', {
      characterTag,
      referalMessage
    });

    MenuHelper.sendMainMenu($, tx, {
      message: welcomeMessage,
      imageId: $.files.intro
    });
  }
}

module.exports = StartController;
