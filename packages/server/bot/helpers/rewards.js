const { get } = require('lodash');
const Random = require('random-js')();
const SettingsManager = require('../managers/SettingsManager');

const GOLD_REWARDS = Object.freeze({
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 3,
  6: 4,
  7: 4,
  8: 4,
  9: 5,
  10: 5,
  11: 5,
  12: 5,
  13: 5,
  14: 5,
  15: 5,
  16: 5
});

const EXP_REWARDS = Object.freeze({
  1: 10,
  2: 12,
  3: 15,
  4: 20,
  5: 25,
  6: 30,
  7: 35,
  8: 40,
  9: 45,
  10: 50,
  11: 55,
  12: 60,
  13: 65,
  14: 70,
  15: 75,
  16: 80
});

const RATING_WIN = 8;
const RATING_LOSE = -6;
const RATING_DRAW = 2;

const getExpModificator = player => {
  if (player.ghost) {
    return 0;
  }

  const { character } = player;
  const { experience } = character.effects;

  const expIncrease = character.stats.level >= 9 ? experience + 25 : experience;
  return expIncrease > 0 ? expIncrease / 100 : 0;
};

const getExpDamageBonus = ({ damageTotal }) => {
  return damageTotal.weapon > 0 ? Math.round(damageTotal.weapon / 30) : 0;
};

const getWinnerBonus = ({ character }) => {
  const { bonusChance } = character.effects;
  const chance = bonusChance / 100;
  const hasBonus = Random.bool(chance);

  return hasBonus ? 1 : 0;
};

const getLevelRewards = params => {
  const { player } = params;
  const level = get(player, 'character.stats.level');

  return {
    rating: 0,
    exp: EXP_REWARDS[level],
    gold: GOLD_REWARDS[level]
  };
};

const getSingleRewards = params => {
  const { winner, player, opponent, loser, draw, training, turnNumber } = params;

  let { rating, gold, exp } = getLevelRewards(params);

  if (winner) {
    rating = RATING_WIN;

    if (!player.ghost && !opponent.ghost) {
      exp += Math.round(exp / 2);
      gold += Math.round(gold / 2);
      rating += Math.round(rating / 2);
    }

    if (opponent.surrender && turnNumber < 3) {
      exp = 0;
      gold = 0;
      rating = 0;
    }
  }

  if (loser) {
    rating = RATING_LOSE;
    exp = Math.round(exp / 3);
    gold = Math.round(gold / 2);
  }

  if (draw) {
    rating = RATING_DRAW;
    exp = Math.round(exp / 2);
    gold = Math.round(gold / 2);
  }

  if (training) {
    rating = 0;
    exp = Math.round(exp / 2);
    gold = Math.round(gold / 2);
  }

  return {
    gold,
    rating,
    exp
  };
};

const getTeamsRewards = params => {
  const { player, winner, loser, draw, flawless } = params;
  let { rating, gold, exp } = getLevelRewards(params);

  if (winner) {
    rating = RATING_WIN;
    exp += 30;

    if (!player.dead && !player.surrender) {
      gold += 1;
      exp += 30;
      rating += 2;
    }

    if (flawless) {
      gold += 1;
      exp += 30;
      rating += 3;
    }
  }

  if (loser) {
    rating = RATING_LOSE;
    exp = Math.round(exp / 3);
    gold = Math.round(gold / 2);
  }

  if (draw) {
    rating = RATING_DRAW;
    exp = Math.round(exp / 2);
    gold = Math.round(gold / 2);
  }

  return {
    gold,
    rating,
    exp
  };
};

const getRoyalRewards = params => {
  const { winner, loser, draw, total } = params;
  let { rating, gold, exp } = getLevelRewards(params);

  if (winner) {
    rating = RATING_WIN;

    gold += 3;
    exp += 50 + total.players * 10;
    rating += 2;
  }

  if (loser) {
    rating = RATING_LOSE;
    exp = Math.round(exp / 3);
    gold = Math.round(gold / 2);
  }

  if (draw) {
    rating = 1;
    exp = Math.round(exp / 2);
    gold = Math.round(gold / 2);
  }

  return {
    gold,
    rating,
    exp
  };
};

const handlers = {
  single: getSingleRewards,
  teams: getTeamsRewards,
  royal: getRoyalRewards
};

function getTokensReward(gold, max) {
  let tokens = Math.round(gold * SettingsManager.TOKENS_GOLD_REWARD_RATE);

  if (tokens > max) {
    tokens = max;
  }

  return tokens;
}

const getRewards = params => {
  const { player, winner, loser, type } = params;

  const rewardsHandler = handlers[type];
  const expModificator = getExpModificator(params.player);
  const expDamageBonus = getExpDamageBonus(params.player);
  const goldBonus = getWinnerBonus(params.player);
  const ratingBonus = getWinnerBonus(params.player);

  let { exp, rating, gold } = rewardsHandler(params);

  const expTotal = exp + expDamageBonus;
  const expBonus = Math.round(expModificator * expTotal);

  const experience = expTotal + expBonus;

  gold += goldBonus;
  rating += ratingBonus;

  let tokens = getTokensReward(gold, 5000);
  let tokensBonus = 0;

  if (params.training) {
    tokens = 0;
  }

  const base = {
    draws: 0,
    wins: 0,
    loses: 0,
    draw: false,
    winner: false,
    loser: false
  };

  if (player.surrender) {
    return {
      ...base,
      wins: 1,
      loser: true,
      gold: 0,
      tokens: 0,
      experience: 0,
      rating: -10
    };
  }

  if (winner) {
    return {
      ...base,
      wins: 1,
      winner: true,
      gold,
      goldBonus,
      tokens,
      tokensBonus,
      experience,
      rating,
      ratingBonus
    };
  }

  if (loser) {
    const tokensLose = tokens > 100 ? 100 : tokens;

    return { ...base, loses: 1, loser: true, gold, tokens: tokensLose, experience, rating };
  }

  return { ...base, draws: 1, draw: true, gold, tokens, experience, rating };
};

module.exports = {
  getRewards,
  getTokensReward
};
