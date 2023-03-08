const MenuHelper = require('bot/helpers/menu');
const SettingsManager = require('../../managers/SettingsManager');
const { isValidName } = require('bot/helpers/character');
const { validateItemsDepreciation } = require('bot/helpers/items');
const ArenaController = require('./ArenaController');

class ArenaMaximusController extends ArenaController {
  async onArenaMaximus($, backMenuParams) {
    const character = await this.loadCharacter($.userId);
    const tx = character.getPhrases();
    const activeJob = character.getActiveJob(tx);

    if (character.banned) {
      return MenuHelper.sendArenaMenu($, tx, {
        message: character.t('heroBannedMessage')
      });
    }

    if (activeJob) {
      const message = character.t('characterBusyMessage', {
        busyLabel: activeJob.label
      });

      return MenuHelper.sendArenaMenu($, tx, { message });
    }

    const params = backMenuParams || { customImage: false, hideImage: false };

    return this.sendFightsMenu($, character, params);
  }

  async sendFightsMenu($, character, params = {}) {
    const { customImage, hideImage, message } = params;
    const tx = character.getPhrases();
    const characterTag = character.renderTag({ showHealth: true });
    const fightsMessage = character.t('arenaMaximusMenuMessage', {
      characterTag,
      tokens: character.inventory.tokens || 0,
      anteSingle: SettingsManager.MAXIMUS_SINGLE_ANTE,
      anteTeams: SettingsManager.MAXIMUS_TEAMS_ANTE,
      anteChaotic: SettingsManager.MAXIMUS_CHAOS_ANTE
    });

    const fightsMenu = {
      layout: [2, 2, 1],
      resizeKeyboard: true,
      message: message || fightsMessage,
      [tx.labelSingleFight]: $ => {
        return this.onFightSearch($, character, {
          mode: 'single',
          arena: 'maximus',
          ante: SettingsManager.MAXIMUS_SINGLE_ANTE
        });
      },
      [tx.labelTeamsFight]: $ => {
        return this.onFightSearch($, character, {
          mode: 'teams',
          arena: 'maximus',
          ante: SettingsManager.MAXIMUS_TEAMS_ANTE
        });
      },
      [tx.labelRoyalFight]: $ => {
        return this.onFightSearch($, character, {
          mode: 'royal',
          arena: 'maximus',
          ante: SettingsManager.MAXIMUS_CHAOS_ANTE
        });
      },
      [tx.labelTrainingFight]: $ => {
        return this.onFightSearch($, character, {
          mode: 'single',
          arena: 'maximus',
          ante: SettingsManager.MAXIMUS_TRAINING_ANTE,
          training: true
        });
      },
      [tx.labelBack]: $ => {
        return MenuHelper.sendArenaMenu($, tx);
      }
    };

    if (customImage) {
      return $.runMenu(fightsMenu, customImage);
    }

    if (hideImage) {
      return $.runMenu(fightsMenu);
    }

    return $.runMenu(fightsMenu, $.files.arena);
  }

  validation(character, params, skipAnte = false) {
    const tx = character.getPhrases();
    const brokenItems = validateItemsDepreciation(character.items, tx.lang);
    const {
      hasActiveItems,
      hasActiveAnimal,
      hasInvalidSkills,
      availableSkills,
      banned,
      displayName,
      inventory,
      stats: { level }
    } = character;

    const teamsMinLevel = 2;
    const errors = [];

    if (!skipAnte && params.ante > inventory.tokens) {
      errors.push(character.t('noTokensForAnte'));
    }

    if (!isValidName(displayName)) {
      errors.push(tx.heroNameForbiddenMessage);
    }

    if (banned) {
      errors.push(character.t('heroBannedMessage'));
    }

    if (hasInvalidSkills) {
      errors.push(character.t('arenaInvalidSkillsMessage', { availableSkills }));
    }

    if (params.training && (hasActiveItems || hasActiveAnimal)) {
      errors.push(character.t('arenaHasItemsMessage'));
    }

    if (params.teams && level < teamsMinLevel) {
      errors.push(character.t('arenaTeamsLowLevel', { teamsMinLevel }));
    }

    if (!brokenItems.valid) {
      errors.push(
        character.t('arenaBrokenItemsMessage', {
          brokenItems: brokenItems.message
        })
      );
    }

    return errors;
  }
}

module.exports = ArenaMaximusController;
