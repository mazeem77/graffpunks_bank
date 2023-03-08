const Telegram = require('bot/lib/core/Telegram');
const CharacterModel = require('models/character');
const { isValidName } = require('bot/helpers/character');
const MiningStatusSchema = require('models/mining_status');

class CacheController extends Telegram.TelegramBaseController {
  get routes () {
    return {
      onDelete: 'sendDelete'
    };
  }

  loadCharacter (userId) {
    return CharacterModel.findOne({ userId });
  }

  async sendDelete ($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    if (userId === 1224149668 || userId === 1693258518) {
      const cacheMenu = this.renderUserCacheMenu($, character);

      $.runInlineMenu(cacheMenu);
    } else {
      const userCacheMenuMessage = character.t('ClearCacheMessageElse');

      $.sendMessage(userCacheMenuMessage, {
        parse_mode: 'html',
        disable_web_page_preview: true
      });
    }
  }

  renderUserCacheMenu ($, character) {
    const tx = character.getPhrases();

    let userCacheMenuMessage = character.t('ClearCacheMessage');

    return {
      layout: 1,
      method: 'sendMessage',
      message: userCacheMenuMessage,
      menu: [
        {
          text: tx.labelUserId,
          callback: query => {
            const nameForm = {
              customUserId: {
                destroyForm: true,
                q: tx.enterUserID,
                error: tx.enterUserIDError,
                validator: ({ text }, callback) => {
                  if (isValidName(text)) {
                    return callback(true, "text");
                  }

                  return callback(false);
                }
              }
            };

            $.runForm(nameForm, ({ customUserId }) => {
              character.save(err => {
                userCacheMenuMessage = character.t('ClearedCacheMessage');
                if (!err) {
                  const cacheMenu = MiningStatusSchema.deleteOne({ userId: customUserId }).exec();
                  $.sendMessage(userCacheMenuMessage, {
                    parse_mode: 'html',
                    disable_web_page_preview: true
                  });
                  query.update(cacheMenu);
                }
              });
            });
          }
        }
      ]
    };
  }
}

module.exports = CacheController;