require('./character_progress');

const mongoose = require('mongoose');
const paginate = require('./plugins/paginate');
const { get } = require('lodash');
const { round, handleError, humanizeTime, getTimeLeft } = require('utils');
const CharactersManager = require('../bot/managers/CharactersManager');
const RegenerationManager = require('../bot/managers/RegenerationManager');
const ChroniclesManager = require('../bot/managers/ChroniclesManager');
const CHARACTER_LEVELS = require('../data/character_levels');
const { getTokensReward } = require('../bot/helpers/rewards');
const { getPhrases, translate } = require('../i18n/translate');
const {
  DEFAULT_SKILL_VALUE,
  SKILLS_RESET_COST,
  WEAPONS_MASTERY,
  MASTERY_WEAPONS_MAX_LEVEL
} = require('../data/settings');

const { sendRandomAssetFromPool, mintRandomAsset, mintAsset, hasGamePassAsset } = require('../services/tokens');

const { Schema } = mongoose;

const { calculateClanModificators, getClanDefaultModificators } = require('../bot/helpers/clan');

const { sendReport, sendReportByUserId, sendNewCharacterReport, sendMessage } = require('../bot/helpers/reports');

const { getRatingStatusData } = require('../bot/helpers/rating');

const {
  isLastStage,
  renderCharacterTag,
  calculateValues,
  calculateTotalSkills,
  calculateCapacity,
  calculateMasteryModificator,
  calculateItemsModificators,
  getItemsActiveAreas,
  getNextOrLastStage,
  getMasteryTotal,
  getMasteryGoal,
  getActiveEffects,
  getDefaultEffects
} = require('../bot/helpers/character');

const { getItemPocketId } = require('../bot/helpers/items');

function calculateBaseValues(weapon, areas) {
  const skills = {
    strength: DEFAULT_SKILL_VALUE,
    agility: DEFAULT_SKILL_VALUE,
    intuition: DEFAULT_SKILL_VALUE,
    endurance: DEFAULT_SKILL_VALUE,
    luck: DEFAULT_SKILL_VALUE,
    intelligence: DEFAULT_SKILL_VALUE
  };

  const modificators = calculateItemsModificators({ weapon: weapon }, areas);
  const clanModificators = getClanDefaultModificators();

  return calculateValues(skills, modificators, clanModificators, 1);
}

function calculateFinalValues(character, modificators, effects, weapon, areas) {
  const { skills, clan, hasProximoItem, values } = character;
  const masteryTotal = getMasteryTotal(values, modificators);

  if (hasProximoItem) {
    return calculateBaseValues(weapon, areas);
  }

  const clanModificators = calculateClanModificators(clan);
  const masteryModificator = calculateMasteryModificator(masteryTotal, weapon);

  const skillsTotal = {
    strength: skills.strength + modificators.strength,
    agility: skills.agility + modificators.agility,
    intuition: skills.intuition + modificators.intuition,
    endurance: skills.endurance + modificators.endurance,
    luck: skills.luck + modificators.luck,
    intelligence: skills.intelligence + modificators.intelligence
  };

  return calculateValues(skillsTotal, modificators, effects, clanModificators, masteryModificator);
}

const CharacterSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    refId: { type: String, default: null },
    lastOpponentId: { type: String, default: null },
    userLang: { type: String, required: true },
    customName: { type: String, default: null },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    tendency: { type: Number, default: 0 },
    clan: { type: Schema.Types.ObjectId, ref: 'Clan', default: null },
    avatar: { type: Schema.Types.ObjectId, ref: 'Avatar', default: null },
    stats: {
      level: { type: Number, default: 1 },
      levelStage: { type: Number, default: 1 },
      experience: { type: Number, default: 0 },
      experienceMax: { type: Number, default: CHARACTER_LEVELS[1].expGoal },
      experienceStageMax: {
        type: Number,
        default: CHARACTER_LEVELS[1].stages[1].expGoal
      },
      rating: { type: Number, default: 0 },
      ratingStatus: { type: String, default: null },
      wins: { type: Number, default: 0 },
      loses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 }
    },
    proximoStats: {
      rating: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      loses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 }
    },
    modificators: {
      maxHealth: { type: Number, default: 0 },
      minDamage: { type: Number, default: 0 },
      maxDamage: { type: Number, default: 0 },
      chanceDodge: { type: Number, default: 0 },
      chanceCritical: { type: Number, default: 0 },
      chanceCounter: { type: Number, default: 0 },
      antiDodge: { type: Number, default: 0 },
      antiCritical: { type: Number, default: 0 },
      criticalPower: { type: Number, default: 0 },
      defense: { type: Number, default: 0 },
      masterySwords: { type: Number, default: 0 },
      masteryAxes: { type: Number, default: 0 },
      masteryHammers: { type: Number, default: 0 },
      masterySpears: { type: Number, default: 0 },
      masteryDaggers: { type: Number, default: 0 },
      masteryMagic: { type: Number, default: 0 },
      masteryAnimals: { type: Number, default: 0 },
      masteryEquipment: { type: Number, default: 0 },
      vampirism: { type: Number, default: 0 },
      blessing: { type: Number, default: 0 },
      strength: { type: Number, default: 0 },
      agility: { type: Number, default: 0 },
      intuition: { type: Number, default: 0 },
      endurance: { type: Number, default: 0 },
      luck: { type: Number, default: 0 },
      intelligence: { type: Number, default: 0 },
      capacity: { type: Number, default: 0 },
      mining: { type: Number, default: 0 }
    },
    values: {
      _health: { type: Number, default: 40 },
      maxHealth: { type: Number, default: 40 },
      minDamage: { type: Number, default: 7 },
      maxDamage: { type: Number, default: 10 },
      chanceDodge: { type: Number, default: 10 },
      chanceCritical: { type: Number, default: 10 },
      chanceCounter: { type: Number, default: 5 },
      antiDodge: { type: Number, default: 5 },
      antiCritical: { type: Number, default: 5 },
      criticalPower: { type: Number, default: 5 },
      defense: { type: Number, default: 0 },
      masterySwords: { type: Number, default: 0 },
      masteryAxes: { type: Number, default: 0 },
      masteryHammers: { type: Number, default: 0 },
      masterySpears: { type: Number, default: 0 },
      masteryDaggers: { type: Number, default: 0 },
      masteryMagic: { type: Number, default: 0 },
      masteryAnimals: { type: Number, default: 0 },
      masteryEquipment: { type: Number, default: 0 },
      vampirism: { type: Number, default: 2 },
      blessing: { type: Number, default: 5 }
    },
    effects: { type: Schema.Types.Mixed },
    masteryProgress: {
      swords: { type: Number, default: 0 },
      axes: { type: Number, default: 0 },
      hammers: { type: Number, default: 0 },
      spears: { type: Number, default: 0 },
      daggers: { type: Number, default: 0 },
      magic: { type: Number, default: 0 },
      animals: { type: Number, default: 0 },
      equipment: { type: Number, default: 0 }
    },
    skills: {
      agility: { type: Number, default: 5 },
      strength: { type: Number, default: 5 },
      intuition: { type: Number, default: 5 },
      endurance: { type: Number, default: 5 },
      luck: { type: Number, default: 5 },
      intelligence: { type: Number, default: 5 }
    },
    availableSkills: { type: Number, default: CHARACTER_LEVELS[1].skills },
    potionSkills: { type: Number, default: 0 },
    potionSkillsUsed: { type: Number, default: 0 },
    inventory: {
      gold: {
        type: Number,
        default: CHARACTER_LEVELS[1].gold,
        get: round,
        set: round
      },
      credits: { type: Number, default: 1 },
      tokens: { type: Number, default: 1000 },
      capacity: { type: Number, default: 60 },
      items: [{ type: Schema.Types.ObjectId, ref: 'InventoryItem' }],
      pockets: {
        p1: {
          type: Schema.Types.ObjectId,
          ref: 'InventoryItem',
          default: null
        },
        p2: {
          type: Schema.Types.ObjectId,
          ref: 'InventoryItem',
          default: null
        },
        p3: { type: Schema.Types.ObjectId, ref: 'InventoryItem', default: null }
      }
    },
    waxWallet: { type: Schema.Types.Mixed, default: null },
    items: {
      weapon: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      armor: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      helmet: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      gloves: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      shield: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      boots: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      belt: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      cloak: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      amulet: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      ring: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        default: null
      },
      bag: { type: Schema.Types.ObjectId, ref: 'InventoryItem', default: null }
    },
    abilities: [{ type: Schema.Types.ObjectId, ref: 'Ability' }],
    dailyQuest: { type: Schema.Types.ObjectId, ref: 'CharacterDailyQuest' },
    dailyQuestApplied: { type: Boolean, default: false },
    freeSkillsReset: { type: Number, default: 1 },
    progress: {
      type: Schema.Types.ObjectId,
      ref: 'CharacterProgress',
      default: null
    },
    animal: {
      type: Schema.Types.ObjectId,
      ref: 'CharacterAnimal',
      default: null
    },
    deleted: { type: Boolean, default: false },
    banned: { type: Boolean, default: false }
  },
  {
    minimize: false,
    timestamps: { createdAt: '_created', updatedAt: '_updated' },
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

function handleReferalReward(character, phraseKey, refReward) {
  const characterTag = character.renderTag();

  character
    .model('Character')
    .updateOne({ userId: character.refId }, { $inc: { 'inventory.gold': refReward } }, err => {
      if (!err) {
        sendReportByUserId(character.refId, phraseKey, {
          characterTag,
          refReward
        });
      }
    });
}

CharacterSchema.virtual('skillsTotal').get(function () {
  const { availableSkills, potionSkills } = this;
  let total = 0;

  if (availableSkills > 0) total += availableSkills;
  if (potionSkills > 0) total += potionSkills;

  return total;
});

CharacterSchema.virtual('displayName').get(function () {
  const { username, firstName, customName } = this;
  const telegramUsername = username ? `@${username}` : null;
  return customName || telegramUsername || firstName;
});

CharacterSchema.virtual('isLight').get(function () {
  return this.tendency === 0;
});

CharacterSchema.virtual('isDark').get(function () {
  return this.tendency === 1;
});

CharacterSchema.virtual('tendencyKey').get(function () {
  const tendencies = {
    1: 'dark',
    0: 'light'
  };

  return tendencies[this.tendency];
});

CharacterSchema.virtual('avatarImage').get(function () {
  if (this.avatar) {
    return `${process.env.WEB_URL}/images/avatars/avatar${this.avatar.fileNumber}.jpg`;
  }

  return null;
});

CharacterSchema.virtual('hasAnimal').get(function () {
  return this.animal;
});

CharacterSchema.virtual('hasActiveAnimal').get(function () {
  return get(this.animal, 'active');
});

CharacterSchema.virtual('hasProximoItem').get(function () {
  return get(this.items, 'weapon.data.isProximoWeapon');
});

CharacterSchema.virtual('miningEquipment').get(function () {
  const hasMiningEquipment = get(this.items, 'weapon.data.isMiningEquipment');
  return hasMiningEquipment ? this.items.weapon : null;
});

CharacterSchema.path('effects').get(value => value || getDefaultEffects());

CharacterSchema.virtual('values.mining').get(function () {
  const {
    miningEquipment,
    masteryTotal,
    effects,
    modificators: { mining }
  } = this;

  const miningTotal = effects ? effects.job + mining : mining;
  return miningEquipment ? miningTotal + masteryTotal.equipment : miningTotal;
});

CharacterSchema.virtual('values.health').get(function () {
  const displayHealth = RegenerationManager.getHealth(this.userId, this.values._health);
  return Math.round(displayHealth);
});

CharacterSchema.virtual('weaponCategory').get(function () {
  return get(this.items, 'weapon.data.category');
});

CharacterSchema.virtual('masteryTotal').get(function () {
  const { values, modificators } = this;
  return getMasteryTotal(values, modificators);
});

CharacterSchema.virtual('hasInvalidSkills').get(function () {
  return this.availableSkills < 0;
});

CharacterSchema.virtual('hasActiveItems').get(function () {
  const activeItems = Object.keys(this.items).filter(area => this.items[area] && this.items[area].data);

  return activeItems.length > 0;
});

CharacterSchema.methods.pay = async function (params = {}) {
  const { gold, credits } = params;

  const inc = {};

  if (gold) inc['inventory.gold'] = `-${gold}`;
  if (credits) inc['inventory.credits'] = `-${credits}`;

  await this.updateOne({ $inc: inc });
};

CharacterSchema.methods.resetSkills = async function () {
  const { freeSkillsReset, availableSkills, stats } = this;
  const skillsTotal = calculateTotalSkills(stats);
  const isResetFree = freeSkillsReset > 0 || availableSkills < 0;

  if (isResetFree) {
    if (freeSkillsReset > 0) {
      this.freeSkillsReset -= 1;
    }
  } else {
    this.inventory.gold -= SKILLS_RESET_COST;
  }

  this.skills.agility = DEFAULT_SKILL_VALUE;
  this.skills.strength = DEFAULT_SKILL_VALUE;
  this.skills.intuition = DEFAULT_SKILL_VALUE;
  this.skills.endurance = DEFAULT_SKILL_VALUE;
  this.skills.luck = DEFAULT_SKILL_VALUE;
  this.skills.intelligence = DEFAULT_SKILL_VALUE;
  this.availableSkills = skillsTotal;

  await this.save();
};

CharacterSchema.methods.reset = async function () {
  const { expGoal, stages, gold, skills } = CHARACTER_LEVELS[1];

  this.stats.level = 1;
  this.stats.levelStage = 1;
  this.stats.experience = 0;
  this.stats.experienceMax = expGoal;
  this.stats.experienceMaxStage = stages[1].expGoal;

  this.stats.rating = 0;
  this.stats.wins = 0;
  this.stats.loses = 0;
  this.stats.draws = 0;
  this.stats.ratingStatus = null;

  this.masteryProgress.swords = 0;
  this.masteryProgress.axes = 0;
  this.masteryProgress.hammers = 0;
  this.masteryProgress.spears = 0;
  this.masteryProgress.daggers = 0;
  this.masteryProgress.magic = 0;
  this.masteryProgress.animals = 0;

  this.values.masterySwords = 0;
  this.values.masteryAxes = 0;
  this.values.masteryHammers = 0;
  this.values.masterySpears = 0;
  this.values.masteryDaggers = 0;
  this.values.masteryMagic = 0;
  this.values.masteryAnimals = 0;
  this.values.masteryEquipment = 0;

  this.skills.strength = DEFAULT_SKILL_VALUE;
  this.skills.agility = DEFAULT_SKILL_VALUE;
  this.skills.intuition = DEFAULT_SKILL_VALUE;
  this.skills.endurance = DEFAULT_SKILL_VALUE;
  this.skills.luck = DEFAULT_SKILL_VALUE;
  this.skills.intelligence = DEFAULT_SKILL_VALUE;

  this.availableSkills = skills;
  this.inventory.gold = gold;

  this.items.weapon = null;
  this.items.armor = null;
  this.items.helmet = null;
  this.items.gloves = null;
  this.items.shield = null;
  this.items.boots = null;
  this.items.belt = null;
  this.items.cloak = null;
  this.items.amulet = null;
  this.items.ring = null;
  this.items.bag = null;

  await this.model('CharacterAnimal').deleteMany({ _id: this.animal }, handleError);
  await this.model('InventoryItem').deleteMany({ _id: { $in: this.inventory.items } }, handleError);
  await this.model('CharacterDailyQuest').deleteMany({ _id: this.dailyQuest }, handleError);

  this.inventory.items = [];
  this.animal = null;
  this.dailyQuest = null;
  this.dailyQuestApplied = false;
  this.refId = null;

  await this.save();
};

CharacterSchema.methods.handleEquipmentUsage = async function (usageValue) {
  const {
    userLang,
    items: { weapon },
    values: { masteryEquipment }
  } = this;

  if (weapon && usageValue > 0) {
    const depreciation = usageValue / 1000;

    if (masteryEquipment < MASTERY_WEAPONS_MAX_LEVEL) {
      this.masteryProgress.equipment += depreciation;

      const masteryGoal = getMasteryGoal(masteryEquipment);

      if (this.masteryProgress.equipment >= masteryGoal) {
        this.values.masteryEquipment += 1;
        this.masteryProgress.equipment = 0;
        this.notify('characterNewMasteryLevel.equipment');
      }
    }

    weapon.depreciation += depreciation;

    if (weapon.depreciation >= weapon.maxDepreciation) {
      const itemTitle = weapon.getTitle(userLang);
      this.notify('characterItemBroken', { itemTitle });
    }

    await weapon.save();
  }
};

CharacterSchema.methods.saveLoot = async function (lootItems, params = {}) {
  const { giftId, isFormatted = true } = params;
  const itemTags = [];
  const lootItemIds = lootItems.reduce((ids, item) => [...ids, item.id], []);

  const saveItem = async item => {
    const { data, quantity, isItem, isPotion, isGold, isCredits } = item;
    const itemTitle = item.renderTag(this.userLang, { isFormatted });

    if (isItem || isPotion) {
      const inventoryItem = await this.model('InventoryItem').create({
        data: data._id,
        userId: this.userId,
        depreciation: data.minDurability || 0,
        maxDepreciation: isPotion ? quantity : data.maxDurability
      });

      this.inventory.items.push(inventoryItem._id);
    }

    if (isGold) {
      this.inventory.gold += quantity;
    }

    if (isCredits) {
      this.inventory.credits += quantity;
    }

    itemTags.push(itemTitle);
  };

  const saveItems = async () => {
    await Promise.all(
      lootItems.map(async item => {
        await saveItem(item);
      })
    );
  };

  if (giftId) {
    this.inventory.items.pull(giftId);
  }

  await saveItems();
  await this.save();
  await this.model('LootItem').updateMany({ _id: { $in: lootItemIds } }, { $inc: { dropCount: 1 } }, { multi: true });

  return itemTags;
};

CharacterSchema.methods.removeItems = async function (removedItems) {
  const removeItem = async item => {
    const isActive = item.isActive(this.items);
    const inPocketId = getItemPocketId(this.inventory.pockets, item.id);

    if (inPocketId) {
      this.inventory.pockets[inPocketId] = null;
    }

    if (isActive) {
      this.items[item.data.area] = null;
    }

    this.inventory.items.pull(item.id);
    await item.remove();
  };

  const removeItems = async () => {
    await Promise.all(
      removedItems.map(async item => {
        await removeItem(item);
      })
    );
  };

  await removeItems();
  await this.save();

  return this;
};

CharacterSchema.methods.isClanChief = function () {
  return this.clan && this.clan.chief && this._id.equals(this.clan.chief.id);
};

CharacterSchema.methods.isClanCouncil = function () {
  return this.clan && this.clan.council.find(member => member.character && member.character._id.equals(this.id));
};

CharacterSchema.methods.getClanMember = function () {
  return this.clan && this.clan.members.find(member => member.character._id.equals(this.id));
};

CharacterSchema.methods.getPhrases = function () {
  return getPhrases(this.userLang);
};

CharacterSchema.methods.t = function (key, params = {}) {
  return translate(this.userLang, key, params);
};

CharacterSchema.methods.translateMany = function (keys = []) {
  const tx = this.getPhrases();
  return keys.reduce((phrases, key) => {
    phrases[key] = tx[key];
    return phrases;
  }, {});
};

CharacterSchema.methods.notify = function (key, params) {
  sendReport(this, key, params);
};

CharacterSchema.methods.message = function (message) {
  sendMessage(this.userId, message);
};

CharacterSchema.methods.renderTag = function (params = {}) {
  return renderCharacterTag(this, params);
};

CharacterSchema.methods.renderStats = function (tx = this.getPhrases(), params = {}) {
  const { stats } = this;
  const characterTag = !params.hideTag ? `${this.renderTag()}\n\n` : '';
  const maximusStatus = getRatingStatusData(tx, 'maximus', stats.ratingStatus);

  // return `${characterTag}<b>${tx.labelMaximusLeague}</b>\n${tx.labelRating}: ${stats.rating}\n${tx.labelWins}: ${stats.wins}\n${tx.labelLoses}: ${stats.loses}\n${tx.labelDraws}: ${stats.draws}\n${tx.labelLeagueStatus}: ${maximusStatus.label}\n\n<b>${tx.labelProximoLeague}</b>\n${tx.labelRating}: ${proximoStats.rating}\n${tx.labelWins}: ${proximoStats.wins}\n${tx.labelLoses}: ${proximoStats.loses}\n${tx.labelDraws}: ${proximoStats.draws}`;

  return `${characterTag}<b>${tx.labelMaximusLeague}</b>\n${tx.labelRating}: ${stats.rating}\n${tx.labelWins}: ${stats.wins}\n${tx.labelLoses}: ${stats.loses}\n${tx.labelDraws}: ${stats.draws}\n${tx.labelLeagueStatus}: ${maximusStatus.label}`;
};

CharacterSchema.methods.getActiveJob = function (tx = this.getPhrases()) {
  const activeJob = CharactersManager.getBusyJob(this.userId);

  if (!activeJob) {
    return null;
  }

  const title = tx[`labelJob.${activeJob.name}`];
  const timeLeft = getTimeLeft(activeJob.data.nextRunAt, {
    units: ['h', 'm'],
    language: `short-${tx.lang}`,
    spacer: '',
    round: true
  });

  return {
    job: activeJob,
    label: translate(tx.lang, 'stateLabel', { title, timeLeft })
  };
};

CharacterSchema.methods.getRegenerationState = function (tx) {
  const regeneration = RegenerationManager.getState(this.userId);

  if (regeneration) {
    const { _health, maxHealth, restorePerSecond } = regeneration;
    const healthLeft = maxHealth - _health;

    const title = tx['healthState.regeneration'];
    const timeLeftSeconds = Math.round((healthLeft / restorePerSecond) * 1000);
    const timeLeft = humanizeTime(timeLeftSeconds, {
      units: ['m', 's'],
      language: `short-${tx.lang}`,
      spacer: '',
      round: true
    });

    return translate(tx.lang, 'stateLabel', { title, timeLeft });
  }

  return null;
};

CharacterSchema.methods.hasGamePass = async function (type) {
  if (!this.waxWallet) {
    return false;
  }

  return await hasGamePassAsset(this.waxWallet.account, type);
};

CharacterSchema.methods.isEnough = async function (path, goal) {
  const data = await this.model('Character').findById(this.id, path).exec();

  const value = get(data, path);
  const isEnough = value && value >= goal;

  return [isEnough, value];
};

CharacterSchema.methods.isEnoughGold = function (value) {
  return this.isEnough('inventory.gold', value);
};

CharacterSchema.methods.isEnoughCredits = function (value) {
  return this.isEnough('inventory.credits', value);
};

CharacterSchema.methods.isEnoughAvailableSkills = async function (value) {
  return this.isEnough('availableSkills', value);
};

CharacterSchema.methods.getActiveAbility = function (abilityId) {
  return this.abilities.find(ability => ability._id.equals(abilityId));
};

CharacterSchema.statics.forFight = function (params) {
  return this.findOne(params).populate([
    { path: 'animal' },
    { path: 'clan', select: 'name icon' },
    { path: 'items.weapon', populate: { path: 'data' } },
    { path: 'items.armor', populate: { path: 'data' } },
    { path: 'items.helmet', populate: { path: 'data' } },
    { path: 'items.gloves', populate: { path: 'data' } },
    { path: 'items.shield', populate: { path: 'data' } },
    { path: 'items.boots', populate: { path: 'data' } },
    { path: 'items.belt', populate: { path: 'data' } },
    { path: 'items.cloak', populate: { path: 'data' } },
    { path: 'items.amulet', populate: { path: 'data' } },
    { path: 'items.ring', populate: { path: 'data' } }
  ]);
};

CharacterSchema.path('freeSkillsReset').validate(value => {
  return value >= 0;
});

CharacterSchema.path('inventory.gold').validate(value => {
  return value >= 0;
});

CharacterSchema.pre('save', async function (next) {
  if (this.isNew) {
    sendNewCharacterReport(this);
    ChroniclesManager.characterNew(this);

    if (this.refId) {
      const refReward = CHARACTER_LEVELS[1].goldRef;
      handleReferalReward(this, 'referalNewMessage', refReward);
    }
  }

  if (!this.progress) {
    const progress = await this.model('CharacterProgress').create({
      userId: this.userId,
      character: this._id
    });

    this.progress = progress._id;
  }

  // Level updates
  const levelData = CHARACTER_LEVELS[this.stats.level];
  const nextStage = getNextOrLastStage(this.stats);
  const nextStageData = levelData.stages[nextStage];

  const isStageLast = isLastStage(this.stats);
  const isStageFinal = this.stats.levelStage === nextStage + 1;

  if (this.stats.experience >= this.stats.experienceMax) {
    const nextLevel = this.stats.level + 1;
    const nextLevelData = CHARACTER_LEVELS[nextLevel];

    if (nextLevelData) {
      const { expGoal, skills, gold, goldRef, stages, asset } = nextLevelData;
      const tokens = getTokensReward(gold, 50000);

      this.stats.level = nextLevel;
      this.stats.levelStage = 1;

      this.stats.experienceMax = expGoal;
      this.stats.experienceStageMax = stages[1].expGoal;

      this.potionSkillsUsed = 0;
      this.availableSkills += skills;
      this.inventory.tokens += tokens;

      this.notify('characterNewLevel', { skills, tokens });
      ChroniclesManager.characterNewLevel(this);

      if (this.refId) {
        handleReferalReward(this, 'referalLevelMessage', goldRef);
      }

      if (this.waxWallet && asset) {
        if (asset.action === 'mint') {
          mintAsset(this.waxWallet, asset.wallet, asset.templateId);
        }

        this.notify('characterNewAssetGift');
      }
    }
  } else {
    this.stats.experienceMax = levelData.expGoal;
  }

  if (!isStageFinal) {
    if (this.stats.experience >= this.stats.experienceStageMax) {
      const { skills, gold, goldRef, asset } = nextStageData;
      const tokens = getTokensReward(gold, 50000);

      this.availableSkills += skills;
      this.inventory.tokens += tokens;
      this.stats.levelStage = nextStage;
      this.stats.experienceStageMax = nextStageData.expGoal;

      if (isStageLast) {
        this.stats.levelStage = nextStage + 1;
      }

      this.notify('characterNewLevelStage', { skills, tokens });

      if (this.refId) {
        handleReferalReward(this, 'referalLevelStageMessage', goldRef);
      }

      if (this.waxWallet && asset) {
        if (asset.action === 'pool') {
          sendRandomAssetFromPool(this.waxWallet, asset.wallet);
        }

        if (asset.action === 'mint') {
          mintRandomAsset(this.waxWallet, asset.wallet);
        }

        this.notify('characterNewAssetGift');
      }
    } else {
      this.stats.levelStage = nextStage;
      this.stats.experienceStageMax = nextStageData.expGoal;
    }
  }

  // Mastery updates
  const {
    values: { masteryAnimals },
    weaponCategory
  } = this;
  const weaponMasteryId = WEAPONS_MASTERY[weaponCategory];
  const weaponMastery = this.values[weaponMasteryId];
  const animalsMasteryGoal = getMasteryGoal(masteryAnimals);
  const weaponMasteryGoal = getMasteryGoal(weaponMastery);

  if (weaponCategory && this.masteryProgress[weaponCategory] >= weaponMasteryGoal) {
    this.values[weaponMasteryId] += 1;
    this.masteryProgress[weaponCategory] = 0;
    this.notify(`characterNewMasteryLevel.${weaponCategory}`);
  }

  if (this.masteryProgress.animals >= animalsMasteryGoal) {
    this.values.masteryAnimals += 1;
    this.masteryProgress.animals = 0;
    this.notify('characterNewMasteryLevel.animals');
  }

  // Skills updates
  // this.availableSkills = calculateAvailableSkills(this);

  // Values updates
  const character = await this.populate('clan')
    .populate('abilities')
    .populate({
      path: 'items.weapon items.armor items.helmet items.gloves items.shield items.boots items.belt items.cloak items.amulet items.ring items.bag inventory.items',
      populate: { path: 'data' }
    })
    .execPopulate();

  const { userId, userLang, values, items } = character;

  const itemsData = items.toObject();
  const deactivatedItems = [];

  const areas = Object.keys(itemsData).filter(area => itemsData[area] && itemsData[area].data);
  const activeAreas = getItemsActiveAreas(areas, character);
  const modificators = calculateItemsModificators(itemsData, activeAreas);
  const effects = getActiveEffects(this.abilities);
  const activeWeapon = activeAreas.includes('weapon') && itemsData.weapon ? itemsData.weapon : null;

  const valuesFinal = calculateFinalValues(character, modificators, effects, activeWeapon, areas);

  areas.forEach(area => {
    if (activeAreas && !activeAreas.includes(area)) {
      deactivatedItems.push(items[area].getTitle(userLang));
      this.items[area] = null;
    }
  });

  if (deactivatedItems.length > 0) {
    this.notify('itemsDeactivatedMessage', {
      items: deactivatedItems.join(', ')
    });
  }

  this.effects = effects;
  this.modificators = modificators;
  this.values = {
    ...values,
    ...valuesFinal
  };

  this.inventory.capacity = calculateCapacity(this);

  if (this.values.maxHealth < this.values.health) {
    this.values._health = this.values.maxHealth;
    RegenerationManager.cancel(userId);
  }

  if (this.values.maxHealth > this.values.health) {
    RegenerationManager.sync(this);
  }

  return next();
});

mongoose.Promise = global.Promise;

CharacterSchema.plugin(paginate);

module.exports = mongoose.model('Character', CharacterSchema);
