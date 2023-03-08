const GhostPlayer = require('../models/GhostPlayer');
const AssetsManager = require('./AssetsManager');

class GhostsManager {
  constructor () {
    this.ghostItems = null;
    this.ghostAnimals = null;
  }

  async initialize () {
    const itemsData = AssetsManager.getGhostItems();
    const animalsData = AssetsManager.getAnimals();

    this.setItems(itemsData);
    this.setAnimals(animalsData);
  }

  setItems (data) {
    const areas = {
      weapon: {},
      armor: {},
      helmet: {},
      gloves: {},
      shield: {},
      boots: {},
      belt: {},
      cloak: {},
      ring: {},
      amulet: {}
    };

    this.ghostItems = data.reduce((items, item) => {
      const level = item.levelRequired || 1;

      if (items[item.area]) {
        items[item.area][level] = items[item.area][level] ? [...items[item.area][level], item] : [item];
      }

      return items;
    }, areas);
  }

  setAnimals (data) {
    // console.log("Came from setAnimal manager")
    this.ghostAnimals = data;
  }

  createGhostPlayer (params) {
    // console.log('createGhostPlayer Params: ', params);
    return new GhostPlayer({
      ...params,
      items: this.ghostItems,
      animals: this.ghostAnimals
    });
  }
}

module.exports = new GhostsManager();
