const Random = require('random-js')();
const { inRange, some } = require('lodash');

const GIFT_SIZE = {
  sm: {
    items: 1
  },
  md: {
    items: 2
  },
  lg: {
    items: 3
  }
};

class LootManager {
  constructor() {
    this.lootData = [];
    this.lootSorted = {};
  }

  initialize(data) {
    this.lootData = data;
    this.lootSorted = this.sortData(data);
  }

  sortData(data) {
    return data.reduce(
      (sorted, item) => {
        return {
          ...sorted,
          [item.type]: [...sorted[item.type], item]
        };
      },
      {
        item: [],
        gold: [],
        credits: [],
        potion: []
      }
    );
  }

  isMeetsRarity(itemRarity, max) {
    return inRange(itemRarity, 1, max + 1);
  }

  isSameEvent(itemEvent, lootEvent) {
    return itemEvent ? itemEvent === lootEvent : true;
  }

  getItemsQuantityBySize(size) {
    return GIFT_SIZE[size] ? GIFT_SIZE[size].items : 1;
  }

  getShuffledItems() {
    return Random.shuffle(this.lootData);
  }

  getItemsByLootType(type, giftRarity, giftEvent) {
    const typeData = this.lootSorted[type];
    return typeData.filter(({ rarity, event }) => {
      return (
        this.isMeetsRarity(rarity, giftRarity) &&
        this.isSameEvent(event, giftEvent)
      );
    });
  }

  getLootFromGift(rarity, event, size) {
    const lootSize = this.getItemsQuantityBySize(size);
    const lootItems = Object.keys(this.lootSorted).reduce((bundle, type) => {
      const typeItems = this.getItemsByLootType(type, rarity, event);
      const randomItem = Random.pick(typeItems);
      return randomItem ? [...bundle, randomItem] : bundle;
    }, []);

    if (lootSize > 1) {
      const bonusItemsCount = lootSize - 1;
      const bonusItemsData = this.getItemsByLootType('item', rarity, event);
      const bonusItems = Random.sample(bonusItemsData, bonusItemsCount);

      return [...lootItems, ...bonusItems];
    }

    return lootItems;
  }

  getLootByProgress(progressMax, lootEvent) {
    return this.getShuffledItems().reduce((lootItems, item) => {
      const { rarity, dropChance, event, type } = item;
      const meetsRarity = this.isMeetsRarity(rarity, progressMax);
      const meetsEvent = this.isSameEvent(event, lootEvent);

      const shouldDrop = Random.bool(dropChance / 100);
      const hasSameType = some(lootItems, { type });

      return !hasSameType && meetsEvent && meetsRarity && shouldDrop
        ? [...lootItems, item]
        : lootItems;
    }, []);
  }

  getJobLoot(progress, lootEvent) {
    const progressMax = progress + 5;
    return this.getLootByProgress(progressMax, lootEvent);
  }
}

module.exports = new LootManager();
