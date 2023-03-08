const ConfigModel = require('../../models/config');

class SettingsManager {
  constructor() {
    this.settings = {
      BASE_REGENERATION_TIME_MS: 30000,
      MINING_JOB_DURATION_MIN: 360,
      MINING_ANTE: 500,
      MINING_NFT_REWARDS_ENABLED: true,

      PROXIMO_ANTE: 500,
      MAXIMUS_SINGLE_ANTE: 100,
      MAXIMUS_TEAMS_ANTE: 200,
      MAXIMUS_CHAOS_ANTE: 300,
      MAXIMUS_TRAINING_ANTE: 0,

      CREDITS_EXCHANGE_RATE: 25,
      TOKENS_GOLD_EXCHANGE_RATE: 1000,
      TOKENS_CREDITS_EXCHANGE_RATE: 25000,
      TOKENS_GOLD_REWARD_RATE: 100,
      TOKENS_WITHDRAW_RATE: 100,

      TOKENS_WALLET_COMMON: 'pnkofgraf.gm',
      TOKENS_WALLET_RARE: 'punkofgraff2',
      TOKEN_NAME: 'LFGK',

      ADMIN_USER_ID: '275760233',
      ANTE_WHITELIST_IDS: ['1693258518'],
      GAME_PASS_WHITELIST_IDS: [],
      MINT_TEMPLATE_IDS: ['459988', '460308', '462423', '460298']

    };
    this.UNLOCKED_MINING = {};
    this.SHORT_BREAK = {};
    this.LOCKED_MINING = {};
    this.LONG_BREAK = {};
    this.GATE_ONE = {};
    this.GATE_TWO = {};
  }

  get MINT_TEMPLATE_IDS() {
    return this.settings.MINT_TEMPLATE_IDS;
  }

  get TOKEN_NAME() {
    return this.settings.TOKEN_NAME;
  }

  get BASE_REGENERATION_TIME_MS() {
    return this.settings.BASE_REGENERATION_TIME_MS;
  }

  get MINING_JOB_DURATION_MIN() {
    return this.settings.MINING_JOB_DURATION_MIN;
  }

  get MINING_NFT_REWARDS_ENABLED() {
    return this.settings.MINING_NFT_REWARDS_ENABLED;
  }

  get MINING_ANTE() {
    return this.settings.MINING_ANTE;
  }

  get PROXIMO_ANTE() {
    return this.settings.PROXIMO_ANTE;
  }

  get MAXIMUS_SINGLE_ANTE() {
    return this.settings.MAXIMUS_SINGLE_ANTE;
  }

  get MAXIMUS_TEAMS_ANTE() {
    return this.settings.MAXIMUS_TEAMS_ANTE;
  }

  get MAXIMUS_CHAOS_ANTE() {
    return this.settings.MAXIMUS_CHAOS_ANTE;
  }

  get MAXIMUS_TRAINING_ANTE() {
    return this.settings.MAXIMUS_TRAINING_ANTE;
  }

  get CREDITS_EXCHANGE_RATE() {
    return this.settings.CREDITS_EXCHANGE_RATE;
  }

  get TOKENS_GOLD_EXCHANGE_RATE() {
    return this.settings.TOKENS_GOLD_EXCHANGE_RATE;
  }

  get TOKENS_CREDITS_EXCHANGE_RATE() {
    return this.settings.TOKENS_CREDITS_EXCHANGE_RATE;
  }

  get TOKENS_GOLD_REWARD_RATE() {
    return this.settings.TOKENS_GOLD_REWARD_RATE;
  }

  get TOKENS_WITHDRAW_RATE() {
    return this.settings.TOKENS_WITHDRAW_RATE;
  }

  get TOKENS_WALLET_COMMON() {
    return this.settings.TOKENS_WALLET_COMMON;
  }

  get TOKENS_WALLET_RARE() {
    return this.settings.TOKENS_WALLET_RARE;
  }

  get ADMIN_USER_ID() {
    return this.settings.ADMIN_USER_ID;
  }

  get ANTE_WHITELIST_IDS() {
    return this.settings.ANTE_WHITELIST_IDS;
  }

  get GAME_PASS_WHITELIST_IDS() {
    return this.settings.GAME_PASS_WHITELIST_IDS;
  }

  isAnteWhitelisted(userId) {
    return this.ANTE_WHITELIST_IDS.includes(userId);
  }

  async initialize() {
    try {
      const mainSettings = await ConfigModel.findOne({ name: 'main' });

      Object.keys(mainSettings.values).forEach(key => {
        this.settings[key] = mainSettings.values[key];
      });
    } catch (err) {
      console.error('[SERVER]: Unable to initialize DB settings');
    }
  }
}

module.exports = new SettingsManager();
