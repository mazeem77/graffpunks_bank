const Random = require('random-js')();
const GHOST_NAMES = require('data/ghost_names');
const { sortBy } = require('lodash');
const { getClanDefaultModificators } = require('bot/helpers/clan');
const {
  getDefaultEffects,
  getDefaultModificators,
  calculateItemsModificators,
  calculateTotalSkills,
  calculateValues
} = require('bot/helpers/character');

const GamePlayer = require('./Player');
const GhostAnimal = require('./GhostAnimal');

class GhostPlayer extends GamePlayer {
  constructor (data) {
    super({
      userId: data.userId || 'ghost',
      teamId: data.teamId,
      opponentId: data.opponentId,
      character: {
        stats: {},
        effects: getDefaultEffects()
      }
    });

    this.animal = null;
    this.ghost = true;
    this.confirmed = true;

    this.gameLevel = data.level;
    this.params = data.params;

    this.init(data);
  }

  get isRoyalFight () {
    return this.params.mode === 'royal';
  }

  get isTeamsFight () {
    return this.params.mode === 'teams';
  }

  get isTrainingFight () {
    return this.params.training || false;
  }

  init (data) {
    this.setLevel();
    this.setAnimal(data);
    this.setValues(data);

    this.character.tendency = Random.pick([0, 1]);
    this.character.customName = Random.pick(GHOST_NAMES);
  }

  setAnimal (data) {
    // console.log("Came from setAnimal player")
    this.animal = this.shouldTakeAnimal(data.opponent) ? new GhostAnimal(data) : null;
  }

  setValues (data) {
    const masteryModificator = 1;
    const skills = this.getSkills();
    const modificators = this.getModificators(skills, data);
    const effects = getDefaultEffects();
    const clanModificators = getClanDefaultModificators();
    const values = calculateValues(skills, modificators, effects, clanModificators, masteryModificator);

    values.health = values.maxHealth;

    this.character.values = values;
  }

  setLevel () {
    if (this.gameLevel > 2) {
      let min = this.gameLevel;
      let max = this.gameLevel;

      if (this.isTeamsFight) {
        min = this.gameLevel - 1;
        max = this.gameLevel + 1;
      }

      if (this.isRoyalFight) {
        min = this.gameLevel - 2;
        max = this.gameLevel + 2;
      }

      const level = Random.integer(min, max);

      this.character.stats.level = level > 16 ? 16 : level;
      return;
    }

    this.character.stats.level = this.gameLevel;
  }

  getAttack (opponent) {
    const { maxDamage } = this.character.values;

    let attackAreas = [0, 1, 2, 3];

    if (opponent.animalAlive) {
      attackAreas = [0, 1, 2, 3, 4];

      if (opponent.animal.health <= maxDamage) {
        attackAreas = [4];
      }
    }

    return Random.pick(attackAreas);
  }

  getDefense () {
    const defenseDefault = [[0], [1], [2], [3]];
    const defenseWithShield = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ];
    const defenseAreas = this.hasShield ? defenseWithShield : defenseDefault;

    return Random.pick(defenseAreas);
  }

  getTurnResults (opponent) {
    const attack = this.getAttack(opponent);
    const defense = this.getDefense();
    const attackAnimal = attack === 4;

    return {
      playerId: this.userId,
      opponentId: opponent.userId,
      surrender: false,
      attack: attack,
      defense: defense,
      attackAnimal: attackAnimal
    };
  }

  getModificators (skills, data) {
    const { items, opponent } = data;
    const defaultModificators = getDefaultModificators();

    if (!this.shouldEquipItems()) {
      return defaultModificators;
    }

    const areas = ['weapon', 'armor', 'helmet', 'gloves', 'shield', 'boots', 'belt', 'cloak', 'ring', 'amulet'];

    const areasItems = areas.reduce((obj, area) => {
      const areaItem = this.shouldEquipItem(opponent, items, area);

      if (areaItem) {
        obj[area] = { data: areaItem };
      }
      return obj;
    }, {});

    const activeAreas = Object.keys(areasItems);

    this.hasShield = activeAreas.includes('shield');

    return calculateItemsModificators(areasItems, activeAreas);
  }

  getSkills () {
    const ghostLevel = this.character.stats.level;
    const availableSkills = calculateTotalSkills({
      level: ghostLevel,
      levelStage: 1
    });

    const baseValues = {
      strength: 5,
      agility: 5,
      intuition: 5,
      endurance: 5,
      luck: 5,
      intelligence: 5
    };

    const skillBuilds = [
      ['strength', 'strength', 'agility', 'endurance'],
      ['strength', 'strength', 'intuition', 'endurance'],
      ['strength', 'strength', 'strength', 'endurance'],
      ['strength', 'strength', 'strength', 'endurance'],
      ['strength', 'strength', 'strength', 'endurance']
    ];

    const skillValues = Array(availableSkills).fill(1);
    const skillKeys = Random.pick(skillBuilds);

    return skillValues.reduce((skills, value) => {
      const randomSkillId = Random.pick(skillKeys);
      skills[randomSkillId] += value;
      return skills;
    }, baseValues);
  }

  shouldTakeAnimal (opponent) {
    const chances = {
      1: 0.1,
      2: 0.2,
      3: 0.3,
      4: 0.4,
      5: 0.5,
      6: 0.6,
      7: 0.7,
      8: 0.9,
      9: 0.9,
      10: 1
    };

    if (this.isTrainingFight) {
      return false;
    }

    if ((opponent && opponent.hasAnimal) || this.gameLevel > 4) {
      return true;
    }

    return Random.bool(chances[this.gameLevel]);
  }

  shouldEquipItems () {
    return !this.isTrainingFight && this.gameLevel > 1;
  }

  shouldEquipItem (opponent, items, area) {
    const opponentHasItem = opponent && opponent.items[area];
    const equipChance = this.gameLevel > 4 ? 1 : 0.85;
    const shouldEquip = Random.bool(equipChance);

    if (!opponent || opponentHasItem || shouldEquip) {
      return this.pickItem(items, area);
    }

    return null;
  }

  getBestItem (items) {
    const sortedItems = sortBy(items, 'price');
    return sortedItems[0];
  }

  pickItem (items, area) {
    const { level } = this.character.stats;

    const availableLevelsItems = Object.keys(items[area]);
    const recentLevel = availableLevelsItems[availableLevelsItems.length - 1];

    const currentLevelItems = items[area][level];
    const recentLevelItems = items[area][recentLevel];

    if (currentLevelItems && currentLevelItems.length > 0) {
      return this.getBestItem(currentLevelItems);
    }

    if (recentLevelItems && recentLevelItems.length > 0) {
      return this.getBestItem(recentLevelItems);
    }

    return null;
  }
}

module.exports = GhostPlayer;
