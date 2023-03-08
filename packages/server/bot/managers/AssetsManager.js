const ItemModel = require('../../models/item');
const AnimalModel = require('../../models/animal');
const LootItemModel = require('../../models/loot_item');
const LootManager = require('./LootManager');

const { filter } = require('lodash');

const loadAnimals = () => AnimalModel.find({});
const loadItems = () => ItemModel.find({});
const loadLoot = () => LootItemModel.find({ active: true }).populate('data');

class AssetsManager {
  constructor() {
    this.items = null;
    this.animals = null;
  }

  async initialize() {
    this.loot = await loadLoot();
    this.items = await loadItems();
    this.animals = await loadAnimals();

    this.setGiftItems();

    LootManager.initialize(this.loot);
  }

  isGhostItem(item) {
    return item.display && !item.onlyPlayers;
  }

  isGift(item) {
    return item.type === 'gift';
  }

  setGiftItems() {
    this.gifts = this.items.filter(this.isGift);
  }

  getGiftItems(params = {}) {
    return filter(this.gifts, params);
  }

  getAllItems() {
    return this.items;
  }

  getLootItems() {
    return this.loot;
  }

  getGhostItems() {
    return this.items.filter(this.isGhostItem);
  }

  getAnimals() {
    return this.animals;
  }
}

module.exports = new AssetsManager();
