const Telegram = require('bot/lib/core/Telegram');
const CharacterModel = require('models/character');
const { isValidName } = require('bot/helpers/character');

class FacelessController extends Telegram.TelegramBaseController {
  get routes () {
    return {
      onFaceless: 'sendFaceless'
    };
  }

  loadCharacter (userId) {
    return CharacterModel.findOne({ userId });
  }
  async clearFacelessFunc (userId) {
    const FacelessMenu = await CharacterModel.findOne({ userId });
    const Abilities = FacelessMenu.abilities;
    for (let i = 0; i < Abilities.length; i++) {
      console.log('FacelessMenu: ', Abilities[i]);
      if (Abilities[i] == '5c260ba32e805c12da805f85') {
        console.log('deleting Faceless');
        const FacelessMenuUpdate = await CharacterModel.updateOne(
          { _id: id },
          { $pull: { abilities: '5c260ba32e805c12da805f85' } }
        );
      }
    }
  }

  async sendFaceless ($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    if (userId === 1224149668 || userId === 1693258518) {
      const FacelessMenu = this.renderUserFacelessMenu($, character);

      $.runInlineMenu(FacelessMenu);
    } else {
      const userFacelessMenuMessage = character.t('ClearFacelessMessageElse');

      $.sendMessage(userFacelessMenuMessage, {
        parse_mode: 'html',
        disable_web_page_preview: true
      });
    }
  }

  renderUserFacelessMenu ($, character) {
    const tx = character.getPhrases();

    let userFacelessMenuMessage = character.t('ClearFacelessMessage');

    return {
      layout: 1,
      method: 'sendMessage',
      message: userFacelessMenuMessage,
      menu: [
        {
          text: tx.labelUserId,
          callback: query => {
            const nameForm = {
              customUserId: {
                destroyForm: true,
                q: tx.enterUserIDFL,
                error: tx.enterUserIDFLError,
                validator: ({ text }, callback) => {
                  if (isValidName(text)) {
                    return callback(true, text);
                  }

                  return callback(false);
                }
              }
            };

            $.runForm(nameForm, async ({ customUserId }) => {
              character.save(err => {
                userFacelessMenuMessage = character.t('ClearedFacelessMessage');
                if (!err) {
                  console.log(customUserId);
                  this.clearFacelessFunc(customUserId);
                  $.sendMessage(userFacelessMenuMessage, {
                    parse_mode: 'html',
                    disable_web_page_preview: true
                  });
                  // query.update(FacelessMenu);
                }
              });
            });
          }
        }
      ]
    };
  }
}

module.exports = FacelessController;
