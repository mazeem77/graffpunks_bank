const redis = require('services/redis');
const CharactersManager = require('bot/managers/CharactersManager');
const SettingsManager = require('bot/managers/SettingsManager');
const { sendMessage } = require('bot/helpers/reports');
const { getTimeSeconds, getValueByPercentage } = require('utils');

const INTERVAL_MS = 1000;

class RegenerationManager {
  constructor() {
    this.state = {};
    this.init();

    this.log = this.log.bind(this);
    this.logState = this.logState.bind(this);
  }

  restore() {
    return new Promise(resolve => {
      redis.get('RegenerationManagerData', (err, dataString) => {
        if (dataString) {
          this.state = JSON.parse(dataString);

          const jobsCount = this.getStateCount();

          this.log('Data restored!');
          this.log(`${jobsCount} jobs (cache)`);
        }

        resolve();
      });
    });
  }

  persist() {
    const dataString = JSON.stringify(this.state);

    redis.set('RegenerationManagerData', dataString, err => {
      if (!err) {
        this.log('Data saved!');
      }
    });
  }

  init() {
    this.interval = setInterval(() => this.tick(), INTERVAL_MS);
  }

  tick() {
    Object.keys(this.state).forEach(userId => {
      const isPlaying = this.isPlaying(userId);
      const state = this.state[userId];
      const { _health, maxHealth, successMessage, restorePerSecond, restoreHealth = 0 } = state;

      const tickHealth = _health + restorePerSecond + restoreHealth;

      // console.log(`${Math.round(tickHealth)}/${maxHealth}HP - ${userId}`);

      this.state[userId]._health = tickHealth;

      if (restoreHealth) {
        this.state[userId].restoreHealth = null;
      }

      if (isPlaying || tickHealth >= maxHealth) {
        if (!isPlaying && successMessage) {
          sendMessage(userId, successMessage);
        }

        return this.complete(userId);
      }

      return false;
    });
  }

  log(msg) {
    console.info(`[Regeneration]: ${msg}`);
  }

  logState(userId, state) {
    const { _health, maxHealth, restorePerSecond } = state;

    const hp = `${Math.round(_health)}/${maxHealth} HP`;
    const interval = `~${restorePerSecond.toFixed(3)} HP/s`;
    const info = `${userId}, ${hp}, ${interval}`;

    this.log(`State sync - ${info}`);
  }

  isPlaying(userId) {
    return CharactersManager.isPlaying(userId);
  }

  setState(userId, data, cb) {
    const state = this.state[userId];

    if (state) {
      if (data._health < state._health) {
        data._health = state._health;
      }

      this.state[userId] = {
        ...state,
        ...data
      };
    } else {
      this.state[userId] = data;
    }

    this.persist();

    cb(userId, this.state[userId]);
  }

  regenerate(userId, value) {
    const { _health, maxHealth } = this.getState(userId);
    const restoreHealth = value + _health >= maxHealth ? maxHealth - _health : value;

    this.state[userId].restoreHealth = restoreHealth;

    return Math.round(restoreHealth);
  }

  getStateCount() {
    return Object.keys(this.state).length;
  }

  getHealth(userId, savedHealth) {
    return this.state[userId] ? this.state[userId]._health : savedHealth;
  }

  getState(userId) {
    return this.state[userId];
  }

  sync(character) {
    const {
      userId,
      isLight,
      effects,
      values: { blessing, _health, maxHealth }
    } = character;

    let regenBonus = 0;
    let regenBonusPercent = 0;

    if (isLight) {
      regenBonusPercent += blessing;
    }

    regenBonusPercent += effects.regeneration;

    if (regenBonusPercent > 0) {
      regenBonus = getValueByPercentage(SettingsManager.BASE_REGENERATION_TIME_MS, regenBonusPercent);
    }

    const regenTime = getTimeSeconds(SettingsManager.BASE_REGENERATION_TIME_MS - regenBonus);
    const restorePerSecond = maxHealth / regenTime;
    const successMessage = character.t('characterRegenerated');
    const data = { _health, maxHealth, restorePerSecond, successMessage };

    this.setState(userId, data, this.logState);
  }

  cancel(userId) {
    delete this.state[userId];
  }

  async restart(db) {
    const characters = await db.model('Character').find({ $expr: { $gt: ['$values.maxHealth', '$values._health'] } });

    const restartCount = characters.reduce((count, character) => {
      const { userId } = character;
      const state = this.state[userId];

      if (!state) {
        this.sync(character);
        count += 1;
      }

      return count;
    }, 0);

    this.log(`${restartCount} jobs (db)`);
  }

  async complete(userId) {
    const CharacterModel = require('models/character');
    const { _health, maxHealth } = this.state[userId];
    const healthFinal = _health > maxHealth ? maxHealth : _health;

    this.cancel(userId);

    try {
      await CharacterModel.updateOne({ userId }, { $set: { 'values._health': healthFinal } }).exec();

      this.log(`Finished - ${userId}, ${Math.round(healthFinal)}/${maxHealth} HP`);
    } catch (err) {
      console.error(err);
    }

    return this.persist();
  }
}

module.exports = new RegenerationManager();
