const Random = require('random-js')();
const inRange = require('lodash/inRange');
const ANIMAL_NAMES = require('data/animal_names');

class GhostAnimal {
  constructor (data) {
    this.init(data);
  }

  getRandomAnimal (animals, animalMastery) {
    const animalsData = animals.filter(animal => {
      const minMastery = animalMastery - 1;
      const maxMastery = animalMastery + 1;

      return inRange(animal.masteryRequired, minMastery, maxMastery);
    });

    return Random.pick(animalsData);
  }

  getLevel (opponent, ghostLevel) {
    const baseLevel = opponent && opponent.hasAnimal ? opponent.animal.level : ghostLevel;

    let animalMinLevel = baseLevel - 1;
    let animalMaxLevel = baseLevel;

    if (animalMinLevel < 1) {
      animalMinLevel = 1;
    }

    if (animalMaxLevel > 15) {
      animalMaxLevel = 15;
    }

    if (animalMaxLevel > ghostLevel) {
      animalMaxLevel = ghostLevel;
    }

    return Random.integer(animalMinLevel, animalMaxLevel);
  }

  getMastery (opponent, ghostLevel) {
    const baseMastery = ghostLevel > 10 ? 10 : ghostLevel;
    return opponent ? opponent.values.masteryAnimals : Random.integer(baseMastery - 2, baseMastery);
  }

  train (data, level, mastery) {
    const trainingsCount = Array(level - 1).fill(1);
    const trainMinDamage = Math.round(1 + data.minDamage / 5 + mastery / 5);
    const trainMaxDamage = Math.round(1 + data.maxDamage / 4 + mastery / 4);

    return trainingsCount.forEach(() => {
      this.minDamage += trainMinDamage;
      this.maxDamage += trainMaxDamage;
    });
  }

  init (data) {
    const { opponent, animals, level } = data;

    const animalMastery = this.getMastery(opponent, level);
    const animalLevel = this.getLevel(opponent, level);
    let animalData = this.getRandomAnimal(animals, animalMastery);

    const animalName = Random.pick(ANIMAL_NAMES);

    try {
      console.log('animalData: ', animalData);
    } catch (err) {
      console.log('Error: ', err);
    }

    this.dead = false;
    this.active = true;

    this.name = animalName;
    this.level = animalLevel;

    if (animalData?.icon === undefined) {
      console.log('After Undefined');
      this.icon = '🐕';
      this.minDamage = 1;
      this.maxDamage = 2;
      this.maxHealth = 30;
      this.health = 30;
    } else {
      this.icon = animalData.icon;
      this.minDamage = animalData.minDamage;
      this.maxDamage = animalData.maxDamage;
      this.maxHealth = animalData.maxHealth;
      this.health = animalData.maxHealth;
    }

    return this.train(this, animalLevel, animalMastery);
  }
}

module.exports = GhostAnimal;
