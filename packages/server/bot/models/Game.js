const uuid = require('uuid');
const Random = require('random-js')();
const isEmpty = require('lodash/isEmpty');
const ClanModel = require('models/clan');
const CharacterModel = require('models/character');
const CharactersManager = require('bot/managers/CharactersManager');
const SettingsManager = require('bot/managers/SettingsManager');
const chanceBalancer = require('data/balancer');
const { sendReportByKeys } = require('bot/helpers/reports');
const { sleep, getValueByPercentage } = require('utils');
const { MASTERY_WEAPONS_MAX_LEVEL, MASTERY_ANIMALS_MAX_LEVEL, WEAPONS_MASTERY } = require('data/settings');

const GAME_START_TIME_DEFAULT = 60000;

class Game {
  constructor(client, manager) {
    this.gameId = uuid.v4();
    this.params = client.params;

    this.isPending = true;
    this.isFinished = false;
    this.isCanceled = false;
    this.isDraw = false;

    this.clients = {};
    this.players = {};

    this.total = {
      levels: 0,
      players: 0,
      ghosts: 0
    };

    this.timeToStart = client.timeToStartCustom || GAME_START_TIME_DEFAULT;

    this.turnNumber = 1;
    this.turnPlayers = [];

    this.refresh = () => manager.onRefresh();
    this.destroy = () => manager.onDestroy(this.gameId);

    this.setClient(client);
  }

  getState() {
    return {
      gameId: this.gameId,
      draw: this.isDraw,
      canceled: this.isCanceled,
      finished: this.isFinished,
      turnNumber: this.turnNumber,
      players: this.players,
      turnPlayers: this.turnPlayers,
      timeToStart: this.timeToStart,
      teams: this.teams,
      params: this.params,
      total: this.total
    };
  }

  isProximoFight() {
    return this.params.arena === 'proximo';
  }

  isTrainingFight() {
    return this.params.training || false;
  }

  get playerIds() {
    return Object.keys(this.players);
  }

  get isRoyal() {
    return this.params.mode === 'royal';
  }

  get isTeams() {
    return this.params.mode === 'teams';
  }

  get isSingle() {
    return this.params.mode === 'single';
  }

  get averageLevel() {
    return Math.round(this.total.levels / this.total.players);
  }

  hasPlayer(playerId) {
    return this.players[playerId];
  }

  hasRealPlayers() {
    return this.playerIds.find(playerId => !this.players[playerId].ghost);
  }

  hasActivePlayers() {
    return this.playerIds.find(playerId => this.players[playerId].active);
  }

  emit(action, data) {
    Object.values(this.clients).forEach(client => {
      client[action](data);
    });
  }

  triggerEvent(action, data) {
    this.emit(action, data);
  }

  setClient(client) {
    this.clients[client.playerId] = client;
  }

  removePlayer(playerId) {
    delete this.clients[playerId];
    delete this.players[playerId];
  }

  getBestOpponent(opponentIds, playerId) {
    const player = this.players[playerId];

    const absl = (p1, p2) => Math.abs(p1.character.stats.level - p2.character.stats.level);

    const sorted = opponentIds.sort((prevId, currentId) => {
      const prev = this.players[prevId];
      const current = this.players[currentId];

      return absl(current, player) < absl(prev, player);
    });

    return sorted[0];
  }

  getNextOpponent(player) {
    const opponentIds = this.turnPlayers.filter(opponentId => opponentId !== player.playerId);

    const nearestOpponentId = opponentIds.find(opponentId => {
      const opponent = this.players[opponentId];
      return opponent.opponentId === player.playerId;
    });

    const nextOpponentId = nearestOpponentId || Random.pick(opponentIds);

    return this.players[nextOpponentId];
  }

  getClientIds() {
    return Object.keys(this.clients);
  }

  getPlayerIds() {
    return Object.keys(this.players);
  }

  getAliveIds() {
    return this.playerIds.filter(playerId => this.players[playerId].alive);
  }

  setPlaying(value) {
    this.getClientIds().forEach(userId => {
      CharactersManager.setPlaying(userId, value);
    });
  }

  incrementTurn() {
    this.turnNumber = this.turnNumber + 1;
  }

  clearTurnResults() {
    Object.keys(this.players).forEach(playerId => {
      this.players[playerId].setResults(null);
      this.players[playerId].clearChances();
    });
  }

  isResultsReady() {
    const activePlayers = this.getPlayerIds().filter(playerId => this.players[playerId].active);

    return activePlayers.every(playerId => !isEmpty(this.players[playerId].results));
  }

  getGhostResults(ghost, player) {
    return ghost.getTurnResults(player);
  }

  calculateChances(p1, p2) {
    const v1 = p1.character.values;
    const v2 = p2.character.values;

    const { level } = p1.character.stats;

    const damageBlocked = v2.defense * 0.35;

    const minDamageFinal = v1.minDamage - damageBlocked;
    const maxDamageFinal = v1.maxDamage - damageBlocked;

    const criticalValue = v1.chanceCritical - v2.antiCritical;
    const dodgeValue = v1.chanceDodge - v2.antiDodge;
    const counterValue = v1.chanceCounter;

    const chanceDodge = chanceBalancer.dodge(dodgeValue, level);
    const chanceCritical = chanceBalancer.critical(criticalValue, level);
    const chanceCounter = chanceBalancer.counter(counterValue, level);
    const powerValue = chanceBalancer.power(v1.criticalPower);

    const criticalIncrease = (1 + powerValue).toFixed(2);

    const critical = Random.bool(chanceCritical);
    const dodge = Random.bool(chanceDodge);
    const counter = Random.bool(chanceCounter);

    const damage = Random.integer(minDamageFinal, maxDamageFinal);

    let damageCritical = critical ? Math.floor(damage * criticalIncrease) : damage;

    let damageCounter = counter ? Math.floor(Random.integer(minDamageFinal, maxDamageFinal) * 0.75) : 0;

    let damageFinal = damageCritical;

    damageFinal = damageFinal > 0 ? damageFinal : 1;
    damageCounter = damageCounter > 0 ? damageCounter : 1;
    damageCritical = damageCritical > 0 ? damageCritical : 1;

    let hasAnimal = false;
    let animalDamage = null;
    let animalAttack = null;
    let animalHitAnimal = false;

    if (p1.animalAlive) {
      const areas = p2.animalAlive ? [0, 1, 2, 3, 4, 4, 4, 4] : [0, 1, 2, 3];

      hasAnimal = true;
      animalAttack = Random.pick(areas);
      animalHitAnimal = animalAttack === 4;
      animalDamage = Random.integer(p1.animal.minDamage, p1.animal.maxDamage);
    }

    return {
      dodge: dodge,
      counter: counter,
      critical: critical,
      damage: damage,
      damageCounter: damageCounter,
      damageCritical: damageCritical,
      damageFinal: damageFinal,
      damageTotal: damageFinal,
      hasAnimal: hasAnimal,
      animalAttack: animalAttack,
      animalDamage: animalDamage,
      animalHitAnimal: animalHitAnimal
    };
  }

  calculateFinalResults(p1, p2) {
    if (!p2.chances[p1.playerId]) {
      p2.setChances({
        [p1.playerId]: this.calculateChances(p2, p1)
      });
    }

    const c1 = p1.chances[p1.opponentId];
    const c2 = p2.chances[p1.playerId];

    const r1 = { ...p1.results, ...c1 };
    const r2 = { ...p2.results, ...c2 };

    const isOpponentTarget = r2.opponentId === r1.playerId;

    r1.hit = !r2.defense || !r2.defense.includes(r1.attack);
    r1.hitFinal = (r1.hit || r1.critical) && !r2.dodge && !r1.attackAnimal;
    r1.dodgeFinal = isOpponentTarget && !r2.attackAnimal && r1.dodge;
    r1.counterFinal = r1.dodgeFinal && !r2.attackAnimal && r1.counter;
    r1.hitMissed = !r1.attackAnimal && r2.dodge;
    r1.hitCriticalBlocked = !r1.hit && r1.critical;

    r1.animalHit = r1.animalHitAnimal || !r2.defense || !r2.defense.includes(r1.animalAttack);

    if (r1.hitCriticalBlocked) {
      r1.damageFinal = Math.round(r1.damageFinal / 2);
    }

    if (r1.hitFinal) {
      p1.dealDamage(r1.damageFinal);
      p2.receiveDamage(r1.damageFinal, r1.attack, r1.hitCriticalBlocked);
    }

    if (r1.counterFinal) {
      p1.dealDamage(r1.damageCounter);
      p2.receiveDamage(r1.damageCounter, r1.attack, false);
    }

    if (r1.hasAnimal) {
      if (!r1.animalHit) {
        r1.animalDamage = Math.round(r1.animalDamage / 4);
        p2.receiveDamage(r1.animalDamage, r1.animalAttack, true);
      } else if (r1.animalHitAnimal) {
        p2.receiveDamageAnimal(r1.animalDamage, true);
      } else {
        p2.receiveDamage(r1.animalDamage, r1.animalAttack, false);
      }
    }

    if (r1.attackAnimal) {
      p1.dealDamage(r1.damageCritical);
      p2.receiveDamageAnimal(r1.damageCritical, false);
    }

    return r1;
  }

  async updateClan(clanId, rewards) {
    const incrExp = Math.round(rewards.experience / 4);
    const incrRating = rewards.winner ? Math.round(rewards.rating / 4) : -2;
    const incrGold = rewards.winner ? 1 : 0;

    await ClanModel.updateOne(
      { _id: clanId },
      {
        $inc: {
          rating: incrRating,
          experience: incrExp,
          'inventory.gold': incrGold
        }
      }
    ).exec();
  }

  async updateProximoWeapon(character) {
    const areaItem = character.items.weapon;
    let itemReport = null;

    areaItem.depreciation += 1;

    if (areaItem.depreciation >= areaItem.maxDepreciation) {
      const itemTitle = areaItem.data._title[character.userLang];
      itemReport = {
        key: 'characterItemBroken',
        params: { itemTitle }
      };
    }

    await areaItem.save();
    return itemReport;
  }

  async saveAfterProximo(character, player) {
    const reportEvents = [];
    const { rewards } = player;

    character.proximoStats.wins += rewards.wins;
    character.proximoStats.loses += rewards.loses;
    character.proximoStats.draws += rewards.draws;
    character.proximoStats.experience += rewards.experience;
    character.proximoStats.rating += rewards.rating;

    if (character.proximoStats.rating < 0) {
      character.proximoStats.rating = 0;
    }

    if (rewards.winner) {
      // Update mastery
      const { weaponCategory } = character;
      const weaponMasteryId = WEAPONS_MASTERY[weaponCategory];
      const weaponMastery = character.values[weaponMasteryId];

      if (character.items.weapon && weaponMastery < MASTERY_WEAPONS_MAX_LEVEL) {
        character.masteryProgress[weaponCategory] += 1;
      }
    }

    const itemReport = await this.updateProximoWeapon(character);

    if (itemReport) {
      reportEvents.push(itemReport);
    }

    await character.save(err => {
      if (!err && reportEvents.length > 0) {
        sleep(1000).then(() => sendReportByKeys(character, reportEvents));
      }
    });
  }

  async saveAfterMaximus(character, player, opponent) {
    const reportEvents = [];
    const { rewards, damageTotal } = player;
    const { effects } = character;

    if (opponent) {
      character.lastOpponentId = opponent.userId;
    }

    if (rewards.tokens > 0) {
      character.inventory.tokens += rewards.tokens;

      reportEvents.push({
        key: 'tokensReceived',
        params: { value: rewards.tokens }
      });
    }

    character.stats.wins += Number(rewards.wins);
    character.stats.loses += Number(rewards.loses);
    character.stats.draws += Number(rewards.draws);
    character.stats.experience += Number(rewards.experience);
    character.stats.rating += Number(rewards.rating);

    if (character.stats.rating < 0) {
      character.stats.rating = 0;
    }

    character.values._health = player.getFinalHealth();

    if (rewards.winner) {
      // Update mastery
      const { weaponCategory } = character;
      const weaponMasteryId = WEAPONS_MASTERY[weaponCategory];
      const weaponMastery = character.values[weaponMasteryId];

      if (character.items.weapon && weaponMastery < MASTERY_WEAPONS_MAX_LEVEL) {
        character.masteryProgress[weaponCategory] += effects.masteryWeapons || 1;
      }

      if (character.hasActiveAnimal && character.values.masteryAnimals < MASTERY_ANIMALS_MAX_LEVEL) {
        character.masteryProgress.animals += effects.masteryAnimals || 1;
      }

      // Update quests based on wins
      if (character.dailyQuest && character.dailyQuest.isGoalWins) {
        character.dailyQuest.progress += 1;
        await character.dailyQuest.save();
      }
    }

    // Update animal
    if (character.hasActiveAnimal && !character.animal.isMaxLevel) {
      const { masteryAnimals } = character.values;
      const { animalExperience } = effects;

      const expBonusMin = 1 * masteryAnimals;
      const expBonusMax = 3 * masteryAnimals;
      const masteryBonus = masteryAnimals ? Random.integer(expBonusMin, expBonusMax) : 0;

      const exp = rewards.experience / 4 + masteryBonus;
      const effectBonus = getValueByPercentage(exp, animalExperience);
      const expTotal = exp + effectBonus;

      character.animal.experience += Math.round(expTotal);
      await character.animal.save();
    }

    // Update clan
    if (character.clan) {
      await this.updateClan(character.clan, rewards);
    }

    const updateItem = async area => {
      const { depreciationReduce } = effects;
      const areaItem = character.items[area];
      const areaDamage =
        area === 'weapon' ? Math.round((damageTotal.weapon + damageTotal.weaponBlocked) / 4) : damageTotal[area];

      const damageReduce = getValueByPercentage(areaDamage, depreciationReduce);
      const damage = areaDamage - damageReduce;

      if (areaItem && damage > 0) {
        areaItem.depreciation += damage / 1000;

        if (areaItem.depreciation >= areaItem.maxDepreciation) {
          const itemTitle = areaItem.data._title[character.userLang];
          reportEvents.push({
            key: 'characterItemBroken',
            params: { itemTitle }
          });
        }

        await areaItem.save();
      }
    };

    const updateItems = async () => {
      const areas = Object.keys(damageTotal);
      await Promise.all(
        areas.map(async area => {
          await updateItem(area);
        })
      );
    };

    const hasGamePass = await character.hasGamePass(this.params.mode);

    if (this.params.ante > 0 && !SettingsManager.isAnteWhitelisted(character.userId) && !hasGamePass) {
      character.inventory.tokens -= this.params.ante;
    }

    await updateItems();
    await character.save();

    if (reportEvents.length > 0) {
      await sleep(1000);
      sendReportByKeys(character, reportEvents);
    }
  }

  async updateCharacter(...args) {
    try {
      if (this.isProximoFight()) {
        await this.saveAfterProximo(...args);
        return;
      }

      await this.saveAfterMaximus(...args);
    } catch (err) {
      console.error(err);
    }
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId }).populate([
      { path: 'animal' },
      { path: 'items.weapon', populate: { path: 'data' } },
      { path: 'items.armor', populate: { path: 'data' } },
      { path: 'items.helmet', populate: { path: 'data' } },
      { path: 'items.gloves', populate: { path: 'data' } },
      { path: 'items.shield', populate: { path: 'data' } },
      { path: 'items.boots', populate: { path: 'data' } },
      { path: 'items.belt', populate: { path: 'data' } },
      { path: 'items.cloak', populate: { path: 'data' } },
      { path: 'items.amulet', populate: { path: 'data' } },
      { path: 'items.ring', populate: { path: 'data' } },
      { path: 'dailyQuest', populate: { path: 'data' } }
    ]);
  }

  onGameFinish() {
    this.setPlaying(false);

    const userIds = this.getClientIds();

    const updateCharacters = async () => {
      await Promise.all(
        userIds.map(async userId => {
          const character = await this.loadCharacter(userId);
          const player = this.players[character.userId];

          // Only for GameSingle
          const opponent = this.players[player.opponentId];

          await this.updateCharacter(character, player, opponent);
        })
      );
    };

    updateCharacters().then(() => {
      this.triggerEvent('onGameFinished', this.getState());
      this.destroy();
      this.refresh();
    });
  }
}

module.exports = Game;
