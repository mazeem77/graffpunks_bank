const isNumber = require('lodash/isNumber');
const { calculateVampirismHealth } = require('../helpers/character');

const DAMAGE_AREAS = {
  0: 'helmet',
  1: 'armor',
  2: 'belt',
  3: 'boots'
};

class Player {
  constructor(data) {
    this.userId = data.userId;
    this.playerId = data.userId;
    this.character = data.character;

    this.teamId = data.teamId || null;
    this.opponentId = data.opponentId || null;
    this.opponentTeamId = data.opponentTeamId || null;

    this.ghost = false;
    this.confirmed = false;
    this.canceled = false;
    this.surrender = false;
    this.dead = false;
    this.rewards = {};
    this.chances = {};
    this.results = null;

    this.damageTotal = {
      weapon: 0,
      weaponBlocked: 0,
      shield: 0,
      helmet: 0,
      gloves: 0,
      armor: 0,
      boots: 0,
      belt: 0,
      cloak: 0,
      ring: 0,
      amulet: 0
    };

    this.animal = null;
    this.animalDead = false;
    this.animalDeadByAnimal = false;
    this.vampirismHealth = 0;

    if (data.character.items) {
      this.hasShield = data.character.items.shield;
    }

    if (data.character.animal && data.character.animal.active) {
      this.animal = data.character.animal;
    }
  }

  get defeated() {
    return this.dead || this.surrender;
  }

  get alive() {
    return !this.dead && !this.surrender;
  }

  get active() {
    return !this.ghost && this.alive;
  }

  get animalAlive() {
    return this.animal && !this.animalDead;
  }

  dealDamage(damage) {
    this.damageTotal.weapon += damage;
  }

  receiveDamage(damage, attackArea, isBlocked) {
    const area = DAMAGE_AREAS[attackArea];

    this.character.values.health -= damage;

    this.damageTotal.gloves += Math.round(damage / 6);
    this.damageTotal.cloak += Math.round(damage / 8);
    this.damageTotal.ring += Math.round(damage / 8);
    this.damageTotal.amulet += Math.round(damage / 8);

    if (isBlocked) {
      if (this.hasShield) {
        this.damageTotal.shield += damage;
      } else {
        this.damageTotal.weaponBlocked += damage;
      }
    } else {
      this.damageTotal[area] += damage;
    }

    if (this.character.values.health <= 0) {
      this.character.values.health = 0;
      this.setDead();
    }
  }

  receiveDamageAnimal(damage, isByAnimal) {
    if (this.animal) {
      this.animal.health -= damage;

      if (this.animal.health <= 0) {
        this.animal.health = 0;
        this.setDeadAnimal(isByAnimal);
      }
    }
  }

  setResults(results) {
    this.results = results;

    if (results && results.surrender) {
      this.setSurrender();
    }
  }

  setChances(chances) {
    this.chances = {
      ...this.chances,
      ...chances
    };
  }

  clearChances() {
    this.chances = {};
  }

  setOpponent({ opponentId, opponentTeamId }) {
    this.opponentId = opponentId;

    if (opponentTeamId) {
      this.opponentTeamId = opponentTeamId;
    }
  }

  getHealth() {
    return this.character.values.health;
  }

  getFinalHealth() {
    const { health, maxHealth } = this.character.values;

    let finalHealth = health;

    if (this.character.isDark) {
      this.vampirismHealth = calculateVampirismHealth(
        this.character.values,
        this.damageTotal.weapon
      );

      finalHealth += this.vampirismHealth;
    }

    if (finalHealth > maxHealth || !isNumber(finalHealth)) {
      finalHealth = this.character.values.maxHealth;
    }

    return finalHealth;
  }

  setRewards(rewards) {
    this.rewards = rewards;
  }

  setDeadAnimal(isByAnimal) {
    this.animalDead = true;
    this.animalDeadByAnimal = isByAnimal;
  }

  setDead() {
    this.dead = true;
  }

  setSurrender() {
    this.surrender = true;
  }

  setEmotion(emotion) {
    this.emotion = emotion;
  }

  confirm() {
    this.confirmed = true;
  }

  cancel() {
    this.canceled = true;
    this.surrender = true;
  }
}

module.exports = Player;
