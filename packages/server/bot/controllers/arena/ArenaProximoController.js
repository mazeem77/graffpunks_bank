const MenuHelper = require('bot/helpers/menu');
const SettingsManager = require('../../managers/SettingsManager');
const ArenaController = require('./ArenaController');
const ProximoController = require('../npc/ProximoController');

class ArenaProximoController extends ArenaController {
  async onArenaProximo($, menuParams) {
    const { feature } = $.updateParams;
    const proximoFeature = feature || (await this.loadProximoFeature());
    const character = await this.loadCharacter($.userId);

    if (proximoFeature && proximoFeature.active) {
      const params = menuParams || { showImage: true };
      return this.sendFightsMenu($, character, params);
    }

    const ProximoDialog = new ProximoController();

    return ProximoDialog.start($);
  }

  sendFightsMenu($, character, params = {}) {
    const tx = character.getPhrases();
    const characterTag = character.renderTag({ showHealth: true });
    const fightsMessage = character.t('arenaProximoMenuMessage', {
      characterTag,
      tokens: character.inventory.tokens || 0,
      anteProximo: SettingsManager.PROXIMO_ANTE
    });

    const fightsMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: params.message || fightsMessage,
      [tx.labelSingleFightProximo]: $ => {
        return this.onFightSearch($, character, {
          mode: 'single',
          arena: 'proximo',
          ante: 500
        });
      },
      [tx.labelBack]: $ => {
        return MenuHelper.sendArenaMenu($, tx);
      }
    };

    if (params.showImage) {
      $.runMenu(fightsMenu, $.files.arena);
    } else {
      $.runMenu(fightsMenu);
    }
  }

  validation(character, params) {
    const tx = character.getPhrases();
    const { hasProximoItem, hasActiveAnimal, inventory } = character;

    const errors = [];

    if (params.ante > inventory.tokens && !SettingsManager.isAnteWhitelisted(character.userId)) {
      errors.push(character.t('noTokensForAnte'));
    }

    if (!hasProximoItem) {
      errors.push(tx.proximoFightNoItem);
    }

    if (hasActiveAnimal) {
      errors.push(tx.proximoFightHasAnimal);
    }

    return errors;
  }
}

module.exports = ArenaProximoController;
