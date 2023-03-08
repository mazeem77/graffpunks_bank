const Random = require('random-js')();
const { isEqual } = require('lodash');
const { transformPhrase, translate, getFightPhrases } = require('i18n/translate');
const { renderAnimalTag } = require('bot/helpers/character');
const { getTimeMinutes, humanizeTime, dot, sign } = require('utils');
const CharacterModel = require('models/character');
const GamesManager = require('bot/managers/GamesManager');
const FightMenu = require('./FightMenuController');

class FightController {
  constructor(scope, params, player, onBack) {
    this._gameId = null;
    this._teamId = null;

    this.player = player;
    this.params = params;
    this.onBack = onBack;

    this.scope = scope;
    this.commentatorPhrases = [...this.tx.fightCommentatorCommonPhrases];

    this.refusePenalty = 25;

    this.timeToStartCustom = null;
    this.timeToStartOptions = [
      60000, // 1 min
      120000, // 2 min
      180000, // 3 min
      300000 // 5 min
    ];

    this.menu = new FightMenu(scope, params, player);
  }

  set gameId(gameId) {
    this._gameId = gameId;
    this.menu.gameId = gameId;
  }

  get gameId() {
    return this._gameId;
  }

  set teamId(teamId) {
    this._teamId = teamId;
  }

  get teamId() {
    return this._teamId;
  }

  get tx() {
    return getFightPhrases(this.playerLang);
  }

  get playerId() {
    return this.player.userId;
  }

  get playerLang() {
    return this.player.userLang;
  }

  get playerLevel() {
    return this.player.stats.level;
  }

  get playerRating() {
    return this.player.stats.rating;
  }

  get lastOpponentId() {
    return this.player.lastOpponentId;
  }

  t(key, params) {
    return translate(this.playerLang, key, params, 'fight');
  }

  setCharacter(character) {
    this.character = character;
  }

  isProximo() {
    return this.params.arena === 'proximo';
  }

  isPlayerId(playerId) {
    return isEqual(playerId, this.playerId);
  }

  getFinishImage() {
    const images = [this.scope.files.fightFinish1, this.scope.files.fightFinish2, this.scope.files.fightFinish3];

    return Random.pick(images);
  }

  sendBackMenu(message, image) {
    GamesManager.playerUnsubscribe(this.playerId);

    return this.onBack({
      message: message || this.t('fightArenaBackMessage'),
      customImage: image,
      hideImage: !image
    });
  }

  onGameExists() {
    this.sendBackMenu(this.t('fightExistsMessage'));
  }

  onGameRejected() {
    this.sendBackMenu(this.t('fightFullMessage'));
  }

  onGameRefused(customMessage) {
    this.sendBackMenu(customMessage || this.t('fightCanceledMessage'));
  }

  onPlayerLeave() {
    const refuseMessage = this.t('fightRefusedMessage', {
      refusePenalty: this.refusePenalty
    });
    const ratingPenalty = this.playerRating > this.refusePenalty ? this.refusePenalty : this.playerRating;

    CharacterModel.updateOne({ userId: this.playerId }, { $inc: { 'stats.rating': `-${ratingPenalty}` } }).exec();

    this.onGameRefused(refuseMessage);
  }

  getTimeLeftToStart(timeToStart) {
    const timeIcon = timeToStart < 30000 ? '⌛️' : '⏳';
    const timeLeft = humanizeTime(timeToStart, {
      units: ['m', 's'],
      language: `short-${this.tx.lang}`,
      spacer: ' ',
      round: true
    });

    return this.t('timeLeftToStart', { timeIcon, timeLeft });
  }

  getHitLabel(player, opponent, attackId, labels) {
    const playerTag = this.menu.getTag(player);
    const opponentTag = this.menu.getTag(opponent, {
      showHealth: false,
      hideInfo: true
    });
    const attack = this.getAttackLabel(attackId);
    const hitLabel = Random.pick(labels);
    const hitPhrase = transformPhrase(hitLabel, { attack, opponentTag });

    return `${playerTag} ${hitPhrase}`;
  }

  getDamageLabel(isCritical, isBlocked, damage) {
    let labels = this.tx.fightDamageLabels;

    if (isCritical) {
      labels = this.tx.fightDamageCriticalLabels;
    }

    if (isBlocked) {
      labels = this.tx.fightDamageCriticalBlockedLabels;
    }

    const damageLabel = Random.pick(labels);
    return transformPhrase(damageLabel, { damage });
  }

  getDodgeLabel(isDodge, isCounter, damage) {
    let labels = null;

    if (isDodge) {
      labels = this.tx.fightDodgeLabels;
    }

    if (isCounter) {
      labels = this.tx.fightDodgeCounterLabels;
    }

    if (labels) {
      const dodgeLabel = Random.pick(labels);
      return transformPhrase(dodgeLabel, { damage });
    }

    return '';
  }

  getKillLabel(isAnimal) {
    const labels = isAnimal ? this.tx.fightAnimalKillLabels : this.tx.fightKillLabels;
    const label = Random.pick(labels);

    return transformPhrase(label);
  }

  getAttackLabel(value, isAnimal) {
    const areaData = this.menu.areas.attack.find(area => area.value === value);
    const areaLabels = isAnimal ? areaData.animalLabels : areaData.labels;

    return Random.pick(areaLabels);
  }

  getAnimalMove(player) {
    const {
      animal,
      animalDeadByAnimal,
      animalDead,
      results: { surrender, hasAnimal, animalAttack, animalDamage }
    } = player;

    if (surrender || !hasAnimal) {
      return '';
    }

    const damage = animalDamage;
    const tag = renderAnimalTag(animal);
    const attack = this.getAttackLabel(animalAttack, true);

    const { fightAnimalHitLabels, fightAnimalDeadLabels, fightAnimalDeadByAnimalLabels } = this.tx;

    const deadLabels = animalDeadByAnimal ? fightAnimalDeadByAnimalLabels : fightAnimalDeadLabels;

    const hitLabel = Random.pick(fightAnimalHitLabels);
    const deadLabel = animalDead ? Random.pick(deadLabels) : '';

    return transformPhrase(hitLabel, { tag, attack, damage, deadLabel });
  }

  getPlayerMove(p1, p2) {
    const { fightHitLabels, fightHitBlockedLabels, fightHitMissedLabels } = this.tx;

    const {
      attack,
      attackAnimal,
      hitFinal,
      hitMissed,
      hitCriticalBlocked,
      damageFinal,
      damageCritical,
      critical,
      dodgeFinal,
      counterFinal,
      damageCounter
    } = p1.results;

    if (attackAnimal) {
      const hit = this.getHitLabel(p1, p2, attack, fightHitLabels);
      const damage = this.getDamageLabel(critical, hitCriticalBlocked, damageCritical);
      const dodge = this.getDodgeLabel(dodgeFinal, counterFinal, damageCounter);
      const killAnimal = p2.animalDead ? this.getKillLabel(true) : '';

      return `${hit} ${damage} ${killAnimal}${dot(dodge)}`;
    }

    if (hitFinal) {
      const hit = this.getHitLabel(p1, p2, attack, fightHitLabels);
      const damage = this.getDamageLabel(critical, hitCriticalBlocked, damageFinal);
      const dodge = this.getDodgeLabel(dodgeFinal, counterFinal, damageCounter);
      const kill = p2.dead ? this.getKillLabel() : '';

      return `${hit} ${damage}${kill}${dot(dodge)}`;
    }

    const labels = hitMissed ? fightHitMissedLabels : fightHitBlockedLabels;
    const hit = this.getHitLabel(p1, p2, attack, labels);
    const dodge = this.getDodgeLabel(dodgeFinal, counterFinal, damageCounter);

    return `${hit}${dot(dodge)}`;
  }

  getTurnPlayers(players) {
    const sortResults = id => {
      const { playerId, opponentId } = players[id];
      return this.isPlayerId(playerId) || this.isPlayerId(opponentId);
    };

    return Object.keys(players)
      .filter(playerId => players[playerId].results)
      .sort(sortResults);
  }

  getTurnResultsMessage(game) {
    const { turnNumber, finished, draw, players } = game;
    const turnMessage = this.t('fightTurnFinishedMessage', { turnNumber });

    const turnPlayers = this.getTurnPlayers(players);

    const resultsMessage = turnPlayers.reduce((message, playerId) => {
      const p1 = players[playerId];
      const p2 = players[p1.opponentId];

      try {
        if (p1.results.surrender) {
          const tag = this.menu.getTag(p1);
          return `${message}\n\n${tag} ${this.tx.surrenderMessage}`;
        }

        const playerMove = this.getPlayerMove(p1, p2);
        const animalMove = this.getAnimalMove(p1);

        return `${message}\n\n${playerMove}${dot(animalMove)}`;
      } catch (err) {
        console.error(`[FightController]: ${err}`);
      }

      return message;
    }, turnMessage);

    const commentatorMessage = this.getCommentatorMessage({
      turnNumber,
      finished,
      draw
    });

    const resultsFinalMessage = resultsMessage || '';

    return `${resultsFinalMessage}\n\n${commentatorMessage}`;
  }

  getCommentatorMessage(params) {
    const { turnNumber, finished, draw } = params;
    const { fightCommentatorLabel, fightCommentatorFinishPhrases, fightCommentatorDrawPhrases } = this.tx;

    const finishPhrases = draw ? fightCommentatorDrawPhrases : fightCommentatorFinishPhrases;
    const phrases = finished ? finishPhrases : this.commentatorPhrases;

    const phrase = Random.pick(phrases);
    const message = transformPhrase(phrase, { turnNumber });

    return `<i>${fightCommentatorLabel}: ${message}</i>`;
  }

  getRewardsMessage(player) {
    const { labelExpShort, labelRatingShort, labelDamageShort } = this.tx;
    const {
      rewards: { experience, rating, ratingBonus, tokens, tokensBonus },
      damageTotal,
      vampirismHealth
    } = player;

    const labels = [
      `🌟 ${sign(experience)} ${labelExpShort}`,
      `💯 ${sign(rating, ratingBonus)} ${labelRatingShort}`,
      `🪙 ${sign(tokens, tokensBonus)}`,
      `🗡 ${damageTotal.weapon} ${labelDamageShort}`
    ];

    if (player.character.isDark) {
      labels.push(`❣️ ${sign(vampirismHealth)}HP`);
    }

    return `<b>${labels.join(', ')}</b>`;
  }

  getFightRefuseMenu(messageKey) {
    const { refusePenalty } = this;
    const refuseInfo = this.t('fightRefuseInfo', { refusePenalty });
    const refuseMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: this.t(messageKey, { refuseInfo }),
      [this.t('labelFightRefuse')]: {
        layout: 2,
        resizeKeyboard: true,
        message: this.t('fightRefuseQuestion'),
        [this.t('labelYes')]: () => {
          this.onPlayerLeave();
          GamesManager.playerLeaveGame(this.gameId, this.playerId, this.teamId);
        },
        [this.t('labelNo')]: () => {
          this.scope.runMenu(refuseMenu);
        }
      }
    };

    return refuseMenu;
  }

  getFightCreateMenu() {
    return this.timeToStartOptions.reduce((menu, timeMs) => {
      const minutes = getTimeMinutes(timeMs);
      const label = this.t('labelFightCreateMinutes', { minutes });
      return {
        ...menu,
        [label]: () => {
          this.timeToStartCustom = timeMs;
          return GamesManager.playerCreateGame(this);
        }
      };
    }, {});
  }
}

module.exports = FightController;
