const { roundBy, getValueByPercentage } = require('utils');
const { translate } = require('i18n/translate');
const { WEB_URL } = require('config');
const { characterNameRegex, emojiRegex } = require('../../data/regex');
const CHARACTER_LEVELS = require('../../data/character_levels');
const chanceBalancer = require('../../data/balancer');
const {
  DEFAULT_SKILL_VALUE,
  CAPACITY_BASE,
  CAPACITY_PER_LEVEL,
  CAPACITY_PER_ENDURANCE,
  MASTERY_PROGRESS_STEP,
  WEAPONS_MASTERY
} = require('../../data/settings');
const { getSupersetItemsCount } = require('./items');

function getDefaultModificators() {
  return {
    strength: 0,
    agility: 0,
    intuition: 0,
    endurance: 0,
    luck: 0,
    intelligence: 0,
    maxHealth: 0,
    minDamage: 0,
    maxDamage: 0,
    defense: 0,
    chanceDodge: 0,
    chanceCritical: 0,
    chanceCounter: 0,
    antiDodge: 0,
    antiCritical: 0,
    criticalPower: 0,
    masterySwords: 0,
    masteryAxes: 0,
    masteryHammers: 0,
    masterySpears: 0,
    masteryDaggers: 0,
    masteryMagic: 0,
    masteryAnimals: 0,
    masteryEquipment: 0,
    vampirism: 0,
    blessing: 0,
    capacity: 0,
    mining: 0
  };
}

function getDefaultEffects() {
  return {
    faceless: 0,
    experience: 0,
    animalExperience: 0,
    regeneration: 0,
    vampirism: 0,
    blessing: 0,
    bonusChance: 0,
    job: 0,
    depreciationReduce: 0,
    masteryWeapons: 0,
    masteryAnimals: 0
  };
}

const renderFacelessTag = (character, params = {}) => {
  const {
    userLang,
    tendency,
    stats: { level },
    values: { health, maxHealth }
  } = character;

  let tag = translate(userLang, 'labelFaceless', { level });

  if (params.showHealth) {
    const hearthBroken = tendency ? '🖤' : '💔';
    const hearthDefault = tendency ? '🖤' : '❤';
    const hearthIcon = health < maxHealth / 2 ? hearthBroken : hearthDefault;

    tag += ` ${hearthIcon} (${health}/${maxHealth})`;
  }

  return tag;
};

/**
 * Renders character tag
 * @param {Object} character
 * @param {Object} [params]
 * @returns {String} character tag label
 */
const renderCharacterTag = (character, params = {}) => {
  const {
    userId,
    username,
    firstName,
    customName,
    clan,
    stats,
    tendency,
    values: { health, maxHealth }
  } = character;

  const { showHealth, hideInfo } = params;

  const telegramUsername = username ? `@${username}` : null;
  const displayName = customName || telegramUsername || firstName;

  const hearthBroken = tendency ? '🖤' : '💔';
  const hearthDefault = tendency ? '🖤' : '❤';
  const hearthIcon = health < maxHealth / 2 ? hearthBroken : hearthDefault;
  const clanIcon = clan && clan.icon ? `${clan.icon} ` : '';

  let tag = `${clanIcon}${displayName}🎖${stats.level}`;

  if (showHealth) {
    tag += ` ${hearthIcon} (${health}/${maxHealth})`;
  }

  if (userId && !hideInfo) {
    tag += ` <a href="${WEB_URL}/heroes/${userId}">[i]</a>`;
  }

  return tag;
};

/**
 * Renders animal tag
 * @param {Object} animal
 * @returns {String} animal tag label
 */
const renderAnimalTag = animal => {
  if (animal) {
    const { name, icon, level, health, maxHealth } = animal;

    const hearthBroken = '💔';
    const hearthDefault = '❤';
    const hearthIcon = health < maxHealth / 2 ? hearthBroken : hearthDefault;

    return `${icon} ${name}🎖${level} ${hearthIcon} (${health}/${maxHealth})`;
  }

  return '';
};

/**
 * Renders character items message
 * @param {Object} tx
 * @param {Object} items
 * @returns {String} character items list
 */
const renderCharacterItems = (tx, items) => {
  const item = area =>
    items[area] ? `<i>${items[area].data._title[tx.lang]}</i>` : tx.labelEmpty;

  return `<b>🔸 ${tx.labelWeapon}:</b> ${item('weapon')}\n<b>🔸 ${
    tx.labelShield
  }:</b> ${item('shield')}\n<b>🔸 ${tx.labelHelmet}:</b> ${item(
    'helmet'
  )}\n<b>🔸 ${tx.labelArmor}:</b> ${item('armor')}\n<b>🔸 ${
    tx.labelGloves
  }:</b> ${item('gloves')}\n<b>🔸 ${tx.labelBoots}:</b> ${item(
    'boots'
  )}\n<b>🔸 ${tx.labelBelt}:</b> ${item('belt')}\n<b>🔸 ${
    tx.labelCloak
  }:</b> ${item('cloak')}\n<b>🔸 ${tx.labelAmulet}:</b> ${item(
    'amulet'
  )}\n<b>🔸 ${tx.labelRing}:</b> ${item('ring')}\n<b>🔸 ${
    tx.labelBag
  }:</b> ${item('bag')}`;
};

/**
 * Renders character pockets message
 * @param {Object} tx
 * @param {Object} pockets
 * @returns {String} character pockets list
 */
const renderCharacterPockets = (tx, pockets) => {
  const { p1 } = pockets;
  const _p1 = p1
    ? `<i>${p1.data._title[tx.lang]}</i> — /pocket`
    : tx.labelEmpty;

  return `<b>🔹 ${tx.labelPocket}:</b> ${_p1}`;
};

/**
 * Returns next mastery level goal
 * @param {?number} masteryValue
 * @returns {number} mastery goal value
 */
const getMasteryGoal = masteryValue =>
  masteryValue && masteryValue > 0
    ? Math.round(masteryValue * MASTERY_PROGRESS_STEP)
    : MASTERY_PROGRESS_STEP;

/**
 * Renders character mastery message
 * @param {Object} tx
 * @param {Object} character
 * @returns {String} character mastery
 */
const renderCharacterMastery = (tx, character) => {
  const { values, masteryTotal, masteryProgress } = character;

  const progress = (mid, pid) =>
    values[mid] < 10
      ? `— (${roundBy(masteryProgress[pid], 2)}/${getMasteryGoal(values[mid])})`
      : '';

  const mastery = (mid, pid) => `${masteryTotal[pid]} ${progress(mid, pid)}`;

  const masterySwords = mastery('masterySwords', 'swords');
  const masteryAxes = mastery('masteryAxes', 'axes');
  const masteryHammers = mastery('masteryHammers', 'hammers');
  const masterySpears = mastery('masterySpears', 'spears');
  const masteryDaggers = mastery('masteryDaggers', 'daggers');
  const masteryAnimals = mastery('masteryAnimals', 'animals');
  const masteryEquipment = mastery('masteryEquipment', 'equipment');

  return `<b>${tx.labelMasterySwords}:</b> ${masterySwords}\n<b>${
    tx.labelMasteryAxes
  }:</b> ${masteryAxes}\n<b>${
    tx.labelMasteryHammers
  }:</b> ${masteryHammers}\n<b>${
    tx.labelMasterySpears
  }:</b> ${masterySpears}\n<b>${
    tx.labelMasteryDaggers
  }:</b> ${masteryDaggers}\n<b>${
    tx.labelMasteryEquipment
  }:</b> ${masteryEquipment}\n<b>${
    tx.labelMasteryAnimals
  }:</b> ${masteryAnimals}`;
};

/**
 * Renders character armor message
 * @param {Object} tx
 * @param {Object} character
 * @returns {String} character armor
 */
const renderCharacterArmor = (tx, character) => {
  const { defense } = character.values;

  return `<b>${tx.labelDefense}:</b> ${defense}`;
};

/**
 * Renders character damage label
 * @param {Object} tx
 * @param {Object} character
 * @returns {String} character damage label
 */
const renderCharacterDamage = (tx, character) => {
  const { minDamage, maxDamage } = character.values;

  return `<b>${tx.labelDamage}:</b> ~ ${minDamage}-${maxDamage}`;
};

/**
 * Renders character skills message
 * @param {Object} tx
 * @param {Object} character
 * @returns {String} character skills
 */

const renderCharacterSkills = (tx, character) => {
  const { skills, modificators } = character;

  const skillData = skills.toObject();
  const skillValues = Object.keys(skillData).reduce((values, id) => {
    values[id] =
      modificators[id] > 0
        ? `${skills[id] + modificators[id]} (${skills[id]}+${modificators[id]})`
        : `${skills[id]}`;

    return values;
  }, {});

  const {
    strength,
    agility,
    intuition,
    endurance,
    luck,
    intelligence
  } = skillValues;

  return `<b>${tx.labelStrength}:</b> ${strength}\n<b>${
    tx.labelAgility
  }:</b> ${agility}\n<b>${tx.labelIntuition}:</b> ${intuition}\n<b>${
    tx.labelEndurance
  }:</b> ${endurance}\n<b>${tx.labelLuck}:</b> ${luck}\n<b>${
    tx.labelIntelligence
  }:</b> ${intelligence}`;
};

/**
 * Renders character values message
 * @param {Object} tx
 * @param {Object} character
 * @returns {String} character values
 */
const renderCharacterValues = (tx, character) => {
  const {
    isDark,
    hasProximoItem,
    items,
    stats: { level },
    values: {
      defense,
      antiDodge,
      antiCritical,
      chanceDodge,
      chanceCritical,
      chanceCounter,
      criticalPower,
      vampirism,
      blessing,
      mining
    }
  } = character;

  const tendencyLabel = isDark ? tx.labelVampirism : tx.labelBlessing;
  const tendencyValue = isDark ? vampirism : blessing;

  const damageValues = renderCharacterDamage(tx, character);
  const skillValues = renderCharacterSkills(tx, character);

  const itemName = hasProximoItem ? items.weapon.data._title[tx.lang] : '';
  const proximoModeWarning = character.t('proximoModeWarning', { itemName });

  const chance = (param, value, sign = '~') => {
    if (value > 0) {
      const chanceBalanced = roundBy(chanceBalancer[param](value, level) * 100);
      const chanceValue = chanceBalanced >= 100 ? 99 : chanceBalanced;
      return `(${sign}${chanceValue}%)`;
    }
    return '';
  };

  const _dodge = `<b>${tx.labelDodge}:</b> ${chanceDodge} ${chance(
    'dodge',
    chanceDodge
  )}`;
  const _critical = `<b>${tx.labelCritical}:</b> ${chanceCritical} ${chance(
    'critical',
    chanceCritical
  )}`;
  const _counter = `<b>${tx.labelCounter}:</b> ${chanceCounter} ${chance(
    'counter',
    chanceCounter
  )}`;
  const _power = `<b>${tx.labelPower}:</b> ${criticalPower} ${chance(
    'power',
    criticalPower,
    '+'
  )}`;

  const _antiDodge = `<b>${tx.labelAntiDodge}:</b> ${antiDodge}`;
  const _antiCritical = `<b>${tx.labelAntiCritical}:</b> ${antiCritical}`;
  const _defense = `<b>${tx.labelDefense}:</b> ${defense}`;
  const _mining = `<b>${tx.labelMining}:</b> ${mining}%`;

  return `${skillValues}\n\n${damageValues}\n${_defense}\n${_dodge}\n${_critical}\n${_counter}\n${_power}\n${_antiDodge}\n${_antiCritical}\n<b>${tendencyLabel}:</b> ${tendencyValue}%\n${_mining}${
    hasProximoItem ? `\n\n${proximoModeWarning}` : ''
  }`;
};

function calculateVampirismHealth(values, dealDamage) {
  const vampirismDamage = dealDamage / 2;
  return getValueByPercentage(vampirismDamage, values.vampirism);
}

function calculateTotalSkills({ level, levelStage }) {
  return Object.keys(CHARACTER_LEVELS).reduce((total, _level) => {
    if (level >= _level) {
      const { skills, stages } = CHARACTER_LEVELS[_level];

      Object.keys(stages)
        .filter(stage => {
          return level > _level || levelStage > stage;
        })
        .forEach(stage => {
          total += stages[stage].skills;
        });

      total += skills;
    }

    return total;
  }, 0);
}

function calculateAvailableSkills(character) {
  const characterData = character.toObject();
  const { skills, stats } = characterData;

  const totalPossibleSkills = calculateTotalSkills(stats);
  const totalUsedSkills = Object.keys(skills).reduce((total, skill) => {
    total += skills[skill] - DEFAULT_SKILL_VALUE;
    return total;
  }, 0);

  return totalPossibleSkills - totalUsedSkills;
}

function getLastStage(level) {
  const { stages } = CHARACTER_LEVELS[level];
  const stageNumbers = Object.keys(stages);

  return stageNumbers[stageNumbers.length - 1];
}

function getNextOrLastStage(stats) {
  const { level, experience } = stats;
  const { stages } = CHARACTER_LEVELS[level];

  const stageNumbers = Object.keys(stages);
  const nextStage = stageNumbers.find(
    stage => experience < stages[stage].expGoal
  );
  const lastStage = stageNumbers[stageNumbers.length - 1];

  return Number(nextStage) || Number(lastStage);
}

function isLastStage(stats) {
  const { level, experience } = stats;
  const { stages } = CHARACTER_LEVELS[level];
  const lastStage = getLastStage(level);

  return experience >= stages[lastStage].expGoal;
}

function calculateCapacity(character) {
  const { modificators, stats, skills } = character;

  let capacity = Math.round(
    stats.level * CAPACITY_PER_LEVEL +
      skills.endurance * CAPACITY_PER_ENDURANCE +
      CAPACITY_BASE
  );

  if (modificators.capacity > 0) {
    capacity += modificators.capacity;
  }

  return capacity;
}

function calculateMasteryModificator(masteryTotal, weapon) {
  let masteryModificator = 1;

  if (!weapon) {
    return masteryModificator;
  }

  if (weapon.data.category === 'swords') {
    masteryModificator = 1 + 0.07 * masteryTotal.swords;
  }

  if (weapon.data.category === 'axes') {
    masteryModificator = 1 + 0.07 * masteryTotal.axes;
  }

  if (weapon.data.category === 'hammers') {
    masteryModificator = 1 + 0.07 * masteryTotal.hammers;
  }

  if (weapon.data.category === 'spears') {
    masteryModificator = 1 + 0.07 * masteryTotal.spears;
  }

  if (weapon.data.category === 'daggers') {
    masteryModificator = 1 + 0.07 * masteryTotal.daggers;
  }

  return masteryModificator;
}

function getMasteryTotal(values, modificators) {
  return Object.keys(WEAPONS_MASTERY).reduce(
    (total, mid) => ({
      ...total,
      [mid]: values[WEAPONS_MASTERY[mid]] + modificators[WEAPONS_MASTERY[mid]]
    }),
    {}
  );
}

function calculateItemsModificators(items, areas) {
  const modificators = getDefaultModificators();

  const handleEffect = ({ decrement, value, id }) => {
    modificators[id] = decrement
      ? modificators[id] - value
      : modificators[id] + value;
  };

  areas.forEach(area => {
    const item = items[area] && items[area].data;

    if (item) {
      item.effects.forEach(handleEffect);

      if (item.isFromSuperset) {
        const supersetItemsCount = getSupersetItemsCount(items, item);
        if (supersetItemsCount === item.superset.quantity) {
          item.superset.effects.forEach(handleEffect);
        }
      }
    }
  });

  return modificators;
}

function getActiveEffects(abilities = []) {
  const defaultEffects = getDefaultEffects();

  const sumEffects = (sum, { effects }) =>
    effects.reduce(
      (total, { type, value }) => ({
        ...total,
        [type]: total[type] + value
      }),
      sum
    );

  return abilities.reduce(
    (total, ability) => sumEffects(total, ability),
    defaultEffects
  );
}

function getItemsActiveAreas(areas, character) {
  const { items, skills, values, tendency } = character;

  const characterItems = items.toObject();
  const modificators = calculateItemsModificators(characterItems, areas);
  const activeAreas = [];

  const skillKeys = [
    'strength',
    'agility',
    'intuition',
    'endurance',
    'luck',
    'intelligence'
  ];

  const masteryKeys = [
    'masteryHammers',
    'masteryAnimals',
    'masteryAxes',
    'masterySpears',
    'masterySwords',
    'masteryDaggers',
    'masteryMagic',
    'masteryEquipment'
  ];

  const requiredKeys = [...skillKeys, ...masteryKeys];

  const getTotalValues = (keys, base) =>
    keys.reduce(
      (total, key) => ({
        ...total,
        [key]: base[key] + modificators[key]
      }),
      {}
    );

  const totalSkills = getTotalValues(skillKeys, skills);
  const totalMastery = getTotalValues(masteryKeys, values);
  const totalValues = {
    ...totalSkills,
    ...totalMastery
  };

  const handleEffect = ({ decrement, value, id }, itemAccepted) => {
    if (itemAccepted) {
      totalValues[id] = decrement
        ? totalValues[id] - value
        : totalValues[id] + value;
    } else {
      totalValues[id] = decrement
        ? totalValues[id] + value
        : totalValues[id] - value;
    }
  };

  areas.forEach(area => {
    const item = items[area].data;
    const itemAccepted = item.requirements
      .filter(required => requiredKeys.includes(required.id))
      .every(required => {
        if (required.id === 'tendency') {
          return required.value === tendency;
        }
        return totalValues[required.id] >= required.value;
      });

    if (itemAccepted && !activeAreas.includes(area)) {
      activeAreas.push(area);
    }

    item.effects.forEach(effect => handleEffect(effect, itemAccepted));
  });

  return activeAreas;
}

function calculateValues(
  skills,
  modificators,
  effects,
  clanModificators,
  masteryModificator
) {
  const { strength, agility, intuition, endurance, luck } = skills;
  const {
    clanMinDamage,
    clanMaxDamage,
    clanDefense,
    clanChanceDodge,
    clanChanceCritical,
    clanVampirism,
    clanBlessing
  } = clanModificators;

  const _blessing = effects.blessing + modificators.blessing;
  const _vampirism = effects.vampirism + modificators.vampirism;

  const blessing = 6 + _blessing + clanBlessing;
  const vampirism = 2 + _vampirism + clanVampirism;

  const defense = modificators.defense + clanDefense;
  const maxHealth = endurance * 8 + modificators.maxHealth;

  const chanceDodge =
    Math.round(agility * 3) + modificators.chanceDodge + clanChanceDodge;
  const chanceCritical =
    Math.round(intuition * 3) +
    modificators.chanceCritical +
    clanChanceCritical;

  const chanceCounter =
    Math.round((agility + luck) / 1.5) + modificators.chanceCounter;
  const criticalPower =
    Math.round((strength + intuition) / 2.25) + modificators.criticalPower;

  const antiDodge =
    Math.round(intuition / 1.25 + agility * 2) + modificators.antiDodge;

  const antiCritical =
    Math.round(strength / 2 + endurance + agility) + modificators.antiCritical;

  const minWeaponDamage = Math.round(
    modificators.minDamage * masteryModificator
  );
  const maxWeaponDamage = Math.round(
    modificators.maxDamage * masteryModificator
  );

  let minDamage = Math.round(strength * 1.5 + minWeaponDamage + clanMinDamage);
  let maxDamage = Math.round(strength * 2 + maxWeaponDamage + clanMaxDamage);

  if (minDamage <= 0) minDamage = 1;
  if (maxDamage <= 0) maxDamage = 2;

  return {
    minDamage,
    maxDamage,
    maxHealth,
    chanceDodge,
    chanceCritical,
    chanceCounter,
    criticalPower,
    antiDodge,
    antiCritical,
    defense,
    vampirism,
    blessing
  };
}

function isValidName(name) {
  return name && characterNameRegex.test(name) && !emojiRegex.test(name);
}

module.exports = {
  renderAnimalTag,
  renderFacelessTag,
  renderCharacterTag,
  renderCharacterItems,
  renderCharacterValues,
  renderCharacterMastery,
  renderCharacterArmor,
  renderCharacterDamage,
  renderCharacterSkills,
  renderCharacterPockets,
  calculateValues,
  calculateVampirismHealth,
  calculateAvailableSkills,
  calculateTotalSkills,
  calculateCapacity,
  calculateMasteryModificator,
  calculateItemsModificators,
  getItemsActiveAreas,
  getDefaultModificators,
  getMasteryTotal,
  getMasteryGoal,
  getNextOrLastStage,
  getActiveEffects,
  getDefaultEffects,
  isLastStage,
  isValidName
};
