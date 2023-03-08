const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');

class TownController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onTown: 'sendTownMenu'
    };
  }

  async sendTownMenu($) {
    const { userId } = $;

    const character = await CharacterModel.findOne({ userId }, { userId: 1, userLang: 1 });
    const count = await CharacterModel.countDocuments({ deleted: false });

    const tx = character.getPhrases();
    const activeJob = character.getActiveJob(tx);

    if (activeJob) {
      return MenuHelper.sendMainMenu($, tx, {
        message: character.t('characterBusyMessage', {
          busyLabel: activeJob.label
        })
      });
    }

    return MenuHelper.sendTownMenu($, tx, {
      message: character.t('townMenuMessage', { count }),
      imageId: $.files.town
    });
  }
}

module.exports = TownController;
