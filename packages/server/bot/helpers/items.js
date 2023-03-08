const { WEAPONS_MASTERY } = require('data/settings');
const { round, hasProp, isInRange } = require('utils');

const ITEMS_TYPES = {
  weapon: { icon: '🗡' },
  armor: { icon: '🛡' },
  potion: { icon: '⚗' },
  amulet: { icon: '📿' },
  ring: { icon: '💍' },
  bag: { icon: '🎒' },
  equipment: { icon: '⛏' },
  gift: { icon: '🎁' }
};

const ITEMS_CATEGORY_LABELS = {
  swords: 'labelSwords',
  axes: 'labelAxes',
  hammers: 'labelHammers',
  spears: 'labelSpears',
  daggers: 'labelDaggers',
  helmets: 'labelHelmets',
  gloves: 'labelGloves',
  armors: 'labelArmors2',
  shields: 'labelShields',
  belts: 'labelBelts',
  boots: 'labelBoots',
  rings: 'labelRings',
  cloaks: 'labelCloaks',
  amulets: 'labelAmulets',
  bags: 'labelBags',
  potions: 'labelPotions',
  equipment: 'labelEquipment'
};

function getRarityLabel(rarity, tx) {
  const isRare = isInRange(rarity, 26, 50);
  const isVeryRare = isInRange(rarity, 51, 75);
  const isLegendary = isInRange(rarity, 76, 100);

  if (isRare) return tx.labelRarityRare;
  if (isVeryRare) return tx.labelRarityVeryRare;
  if (isLegendary) return tx.labelRarityLegendary;

  return tx.labelRarityCommon;
}

function isSameSuperset(i1, i2) {
  const s1 = i1 && i1.superset && i1.superset.id;
  const s2 = i2 && i2.superset && i2.superset.id;

  return s1 === s2;
}

function getSupersetItemsCount(items, item) {
  return Object.keys(items).reduce((quantity, _area) => {
    const _item = items[_area] && items[_area].data;
    if (_item && isSameSuperset(_item, item)) {
      quantity += 1;
    }
    return quantity;
  }, 0);
}

function getItemPocketId(pockets, itemId) {
  const _pockets = pockets.toObject();
  return Object.keys(_pockets).find(pocketId => _pockets[pocketId] && _pockets[pocketId]._id.equals(itemId));
}

function getTotalWeight(items) {
  return items.reduce((total, item) => {
    return total + item.data.weight;
  }, 0);
}

function getSellingPrice(items) {
  const sellingPrice = items.reduce((total, { data, depreciation, maxDepreciation }) => {
    const priceIndex = data.price / data.maxDurability;
    const depreciationCost = (depreciation * priceIndex) / 3;
    const price = (priceIndex * maxDepreciation) / 3 - depreciationCost;
    return total + (price || 1);
  }, 0);

  return round(sellingPrice);
}

function getRepairPrice(items) {
  const repairPrice = items.reduce((total, { data, depreciation }) => {
    const priceIndex = data.price / data.maxDurability;
    const price = (depreciation * priceIndex) / 2;
    return total + price;
  }, 0);

  return round(repairPrice);
}

function renderItemEffects(tx, effects) {
  return effects.reduce((str, effect) => {
    const { label, decrement, value, valueIcon, valueSign } = effect;
    const defaultSign = decrement ? '-' : '+';
    const effectIcon = valueIcon || '';
    const effectSign = hasProp(effect, 'valueSign') ? valueSign : defaultSign;
    const effectValue = `${effectSign}${value}${effectIcon}\n`;

    return str + `<b>${tx[label]}:</b> ${effectValue}`;
  }, '');
}

function validateItemRequirements(tx, character, item) {
  const { items, stats, tendency } = character;
  const masteryTypes = Object.values(WEAPONS_MASTERY);
  const result = {
    valid: true,
    values: [],
    messages: []
  };

  if (items.weapon && items.weapon.data.twoHanded && item.area === 'shield') {
    result.valid = false;
    result.messages.push(tx.inventoryMessageTwoHandedInUse);
  }

  if (item.twoHanded && items.shield) {
    result.valid = false;
    result.messages.push(tx.inventoryMessageShieldInUse);
  }

  item.requirements.forEach(required => {
    if (required.id === 'level') {
      if (required.value > stats.level) {
        result.valid = false;
        result.values.push(required.id);
        result.messages.push(tx.inventoryMessageLowLevel);
      }
    }

    if (required.id === 'tendency') {
      if (required.value !== tendency) {
        result.valid = false;
        result.values.push(required.id);
        result.messages.push(tx.inventoryMessageNoTendency);
      }
    }

    const value = masteryTypes.includes(required.id)
      ? character.values[required.id] + character.modificators[required.id]
      : character.skills[required.id] + character.modificators[required.id];

    if (required.value > value) {
      result.valid = false;
      result.values.push(required.id);
      result.messages.push(tx.inventoryMessageLowSkills);
    }
  });

  result.messages = Array.from(new Set(result.messages));

  return result;
}

function renderItemRequirements(tx, character, requirements, validation) {
  return requirements.reduce((str, param) => {
    const paramRequired = validation.values.includes(param.id);
    const paramStr = str + `<b>${tx[param.label]}:</b>`;
    let paramValue = `${param.value}\n`;

    if (param.id === 'tendency') {
      paramValue = `${!param.value ? tx.labelTendencyLight : tx.labelTendencyDark}\n`;
    }

    if (param.id === 'legendary') {
      paramValue = `${tx.labelLegendaryRequirement}\n`;
    }

    return paramRequired ? `${paramStr} ❗${paramValue}` : `${paramStr} ${paramValue}`;
  }, '');
}

function validateItemsDepreciation(items, lang) {
  const result = { valid: true, message: '' };
  const brokenItems = [];

  Object.keys(items).forEach(area => {
    const item = items[area];

    if (item && item.depreciation >= item.maxDepreciation) {
      result.valid = false;
      brokenItems.push(`<b>${item.data._title[lang]}</b>`);
    }
  });

  result.message = brokenItems.join(', ');

  return result;
}

function renderItemUsage(tx, item) {
  if (!hasProp(item, 'depreciation')) {
    return item.data.maxDurability;
  }

  if (item.used || item.maxDepreciation <= 0) {
    return item.data.isPotion ? tx.labelUsed : tx.labelObsolete;
  }

  if (item.depreciation >= item.maxDepreciation) {
    return `❗️${tx.labelBroken}/${item.maxDepreciation}`;
  }

  return `${item.depreciation}/${item.maxDepreciation}`;
}

function renderDamageTypes(tx, damageTypes) {
  return damageTypes.reduce((str, { labelType, labelChance }) => {
    return str + `<b>🔸 ${tx[labelType]}:</b> ${labelChance}\n`;
  }, '');
}

function renderGiftDetails(tx, item) {
  const {
    data: { _title, _description, rarity, giftSize, weight }
  } = item;

  const title = _title[tx.lang];
  const description = _description[tx.lang];
  const itemSizeLabel = tx[`labelSize.${giftSize}`];
  const itemRarityLabel = getRarityLabel(rarity, tx);
  const itemSize = `<b>${tx.labelItemSize}:</b> ${itemSizeLabel}`;
  const itemRarity = `<b>${tx.labelItemRarity}:</b> ${itemRarityLabel}`;
  const itemWeight = `<b>⚖️ ${tx.labelWeight}:</b> ${weight.toFixed(1)}`;

  return `<b>🎁 ${title}</b>\n\n${description}\n\n${itemWeight}\n${itemSize}\n${itemRarity}`;
}

function renderItemDetails(tx, character, item, validation, isInUse, isHasAlready) {
  const {
    _title,
    _description,
    price,
    priceCreditsCalculated,
    twoHanded,
    type,
    weight,
    requirements,
    effects,
    superset,
    onlyCredits,
    artefact,
    category,
    isProximoWeapon,
    isFromSuperset,
    isPotion
  } = item.data;

  const {
    lang,
    labelOfGold,
    labelPrice,
    labelDurability,
    labelWeight,
    labelRequirements,
    labelEffects,
    labelSupersetEffects,
    labelWeaponType,
    labelTwoHanded,
    labelOneHanded,
    labelItemFeatures,
    labelItemArtefact,
    labelItemFromSet,
    labelItemNoFeatures,
    labelProximoItems,
    labelItemCategory,
    labelItemEquipment,
    labelPortions
  } = tx;

  const isWeapon = type === 'weapon';
  const isEquipment = type === 'equipment';

  const description = _description[lang];
  const itemRequirements = renderItemRequirements(tx, character, requirements, validation);
  const itemEffects = renderItemEffects(tx, effects);
  const weaponType = `<b>⚔ ${labelWeaponType}:</b> ${twoHanded ? labelTwoHanded : labelOneHanded}\n`;

  const features = [];

  if (artefact) features.push(labelItemArtefact);
  if (isFromSuperset) {
    const itemsObject = character.inventory.items.toObject();
    const supersetItemsCount = getSupersetItemsCount(itemsObject, item.data);
    features.push(`${labelItemFromSet} (${supersetItemsCount}/${superset.quantity})`);
  }
  if (isProximoWeapon) features.push(labelProximoItems);
  if (isEquipment) features.push(labelItemEquipment);

  const itemCredits = priceCreditsCalculated > 0 && !isPotion ? `/ 💎 ${priceCreditsCalculated}` : '';

  const itemPrice = onlyCredits ? `💎 ${priceCreditsCalculated}` : `${price} ${labelOfGold} ${itemCredits}`;

  const itemCategoryLabelId = ITEMS_CATEGORY_LABELS[category];
  const itemCategory = tx[itemCategoryLabelId];

  const itemUsageLabel = isPotion ? labelPortions : labelDurability;
  const itemUsage = `<b>🔰 ${itemUsageLabel}:</b> ${renderItemUsage(tx, item)}`;
  const itemFeatures = features.length > 0 ? features.join(', ') : labelItemNoFeatures;

  const itemTitle = item.number ? `${_title[lang]} (${item.number})` : _title[lang];

  let itemDetails = `<b>${artefact ? '⚱' : ''}${itemTitle}</b> ${isHasAlready ? '🎒' : ''}${isInUse ? '☑️' : ''}${
    description ? `\n${description}\n\n` : '\n\n'
  }<b>💰 ${labelPrice}:</b> ${itemPrice}\n${itemUsage}\n<b>⚖️ ${labelWeight}:</b> ${weight.toFixed(1)}\n${
    isWeapon ? weaponType : ''
  }<b>${labelItemCategory}:</b> ${itemCategory}\n<b>${labelItemFeatures}:</b> ${itemFeatures}\n`;

  if (itemRequirements.length > 0) {
    itemDetails += `\n${labelRequirements}:\n${itemRequirements}`;
  }

  itemDetails += `\n${labelEffects}:\n${itemEffects}`;

  if (isFromSuperset && superset.effects.length > 0) {
    itemDetails += `\n${labelSupersetEffects}:\n${renderItemEffects(tx, superset.effects)}`;
  }

  return itemDetails;
}

function getItemTypeData(type) {
  return ITEMS_TYPES[type];
}

function renderItemTag(tx, character, item, params = {}) {
  const { area, type, _title } = item.data;
  const { hideUseIcon, hideUsage } = params;
  const {
    items,
    inventory: { pockets }
  } = character;

  const typeData = getItemTypeData(type);
  const typeIcon = typeData ? typeData.icon : '';

  if (item.isGift) {
    return `${typeIcon} ${_title[tx.lang]}`;
  }

  const inPocketId = getItemPocketId(pockets, item.id);
  const isActive = items[area] && items[area]._id.equals(item.id);
  const isInUse = !hideUseIcon && (inPocketId || isActive);
  const useIcon = isInUse ? '☑️' : '';
  const usageInfo = !hideUsage ? `(${renderItemUsage(tx, item)})` : '';

  return `${useIcon} ${typeIcon} ${_title[tx.lang]} ${usageInfo}`;
}

module.exports = {
  getSupersetItemsCount,
  getTotalWeight,
  getSellingPrice,
  getRepairPrice,
  renderItemTag,
  renderItemDetails,
  renderGiftDetails,
  validateItemRequirements,
  validateItemsDepreciation,
  getItemPocketId,
  getItemTypeData,
  getRarityLabel
};
