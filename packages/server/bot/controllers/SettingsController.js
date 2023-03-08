const Telegram = require('bot/lib/core/Telegram');
const CharacterModel = require('models/character');
const LANGS = require('data/langs');
const config = require('config');
const { isValidName } = require('bot/helpers/character');

class SettingsController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onSettings: 'sendSettings'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  async sendSettings($) {
    const { userId } = $;

    const character = await this.loadCharacter(userId);
    const settingsMenu = this.renderSettingsMenu($, character);

    $.runInlineMenu(settingsMenu);
  }

  renderSettingsMenu($, character) {
    const tx = character.getPhrases();
    const userName = character.renderTag();
    const settingsMenuMessage = character.t('settingsMenuMessage', {
      userLang: tx.langText,
      userName: userName,
      waxAccount: character.waxWallet ? character.waxWallet.account : 'Not connected'
    });

    const menu = {
      layout: 1,
      method: 'sendMessage',
      message: settingsMenuMessage,
      menu: [
        {
          text: tx.labelLanguage,
          callback: query => {
            const languageMenu = this.renderLanguageMenu($, character);
            query.update(languageMenu);
          }
        }
      ]
    };

    if (character.waxWallet) {
      menu.menu.push({
        text: tx.labelDisconnectWax,
        callback: query => {
          query.confirm({
            message: tx.settingsDisconnectWaxQuestion,
            acceptDelete: true,
            accept: async query => {
              await character.updateOne({ waxWallet: null });
              await query.answer(tx.settingsDisconnectWaxSuccess);

              return this.sendSettings($);
            }
          });
        }
      });
    } else {
      menu.menu.push({
        text: tx.labelConnectWax,
        url: `${config.WEB_URL}/wallet`
      });
    }

    return menu;
  }

  renderLanguageMenu($, character) {
    const tx = character.getPhrases();
    const languageMenuMessage = character.t('settingsLanguageMessage');
    const languageMenuOptions = LANGS.map(lang => ({
      text: lang.text,
      callback: query => {
        character.userLang = lang.code;
        character.save(err => {
          if (!err) {
            const settingsMenu = this.renderSettingsMenu($, character);
            query.update(settingsMenu);
          }
        });
      }
    }));

    return {
      layout: 2,
      method: 'sendMessage',
      message: languageMenuMessage,
      menu: [
        ...languageMenuOptions,
        {
          text: tx.labelBack,
          callback: query => {
            const settingsMenu = this.renderSettingsMenu($, character);
            query.update(settingsMenu);
          }
        }
      ]
    };
  }

  renderNameMenu($, character) {
    const user = $.message.from.toJSON();
    const tx = character.getPhrases();

    const username = user.username || user.first_name;
    const nameMenuMessage = character.t('settingsNameMessage', { username });
    const nameMenuOptionUse = character.t('heroNameOptionUse', { username });

    return {
      layout: 1,
      method: 'sendMessage',
      message: nameMenuMessage,
      menu: [
        {
          text: tx.heroNameOptionCustom,
          callback: query => {
            const nameForm = {
              customName: {
                destroyForm: true,
                q: tx.heroNameFormQuestion,
                error: tx.heroNameFormError,
                validator: ({ text }, callback) => {
                  if (isValidName(text)) {
                    return callback(true, text);
                  }

                  return callback(false);
                }
              }
            };

            $.runForm(nameForm, ({ customName }) => {
              character.customName = customName;
              character.save(err => {
                if (!err) {
                  const settingsMenu = this.renderSettingsMenu($, character);
                  query.update(settingsMenu);
                }
              });
            });
          }
        },
        {
          text: nameMenuOptionUse,
          callback: query => {
            character.username = user.username;
            character.firstName = user.first_name;
            character.customName = null;
            character.save(err => {
              if (!err) {
                const settingsMenu = this.renderSettingsMenu($, character);
                query.update(settingsMenu);
              }
            });
          }
        },
        {
          text: tx.labelBack,
          callback: query => {
            const settingsMenu = this.renderSettingsMenu($, character);
            query.update(settingsMenu);
          }
        }
      ]
    };
  }
}

module.exports = SettingsController;
