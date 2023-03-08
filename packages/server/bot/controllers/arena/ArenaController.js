const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');
const FeatureModel = require('models/feature');
const { ARENA_PROXIMO } = require('data/features');
const SingleFightController = require('./SingleFightController');
const TeamsFightController = require('./TeamsFightController');
const RoyalFightController = require('./RoyalFightController');
const SettingsManager = require('../../managers/SettingsManager');

class ArenaController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onArena: 'onArena',
      onArenaMaximus: 'onArenaMaximus',
      onArenaProximo: 'onArenaProximo'
    };
  }

  getControllerForMode(mode) {
    const controllers = {
      single: SingleFightController,
      teams: TeamsFightController,
      royal: RoyalFightController
    };

    return controllers[mode];
  }

  getBackHandler(arena) {
    const handlers = {
      maximus: 'onArenaMaximus',
      proximo: 'onArenaProximo'
    };

    return handlers[arena];
  }

  loadProximoFeature() {
    return FeatureModel.findOne({ name: ARENA_PROXIMO.name });
  }

  loadTranslations(userId) {
    return CharacterModel.findOne({ userId }, { userLang: 1 });
  }

  loadCharacter(userId) {
    return CharacterModel.forFight({ userId });
  }

  async onArena($) {
    const { userId } = $;
    const character = await this.loadTranslations(userId);
    const tx = character.getPhrases();

    return MenuHelper.sendArenaMenu($, tx);
  }

  async onFightSearch($, character, params) {
    const { userId, userLang, stats, items, clan, lastOpponentId } = character;
    const isAnteWhitelisted = SettingsManager.isAnteWhitelisted(character.userId);
    const hasGamePass = await character.hasGamePass(params.mode);
    const skipAnte = isAnteWhitelisted || hasGamePass;

    const errors = this.validation(character, params, skipAnte);

    if (errors.length > 0) {
      return this.sendFightsMenu($, character, {
        message: errors.join('\n\n')
      });
    }

    return this.createGameClient($, params, {
      userId,
      userLang,
      stats,
      items,
      clan,
      lastOpponentId
    });
  }

  createGameClient($, params, player) {
    const backHandler = this.getBackHandler(params.arena);
    const FightController = this.getControllerForMode(params.mode);

    const onBack = backMenuParams => this[backHandler]($, backMenuParams);
    const client = new FightController($, params, player, onBack);

    client.search();
  }
}

module.exports = ArenaController;
