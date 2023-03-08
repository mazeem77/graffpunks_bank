const { saveAsync } = require('utils');
const ClanModel = require('../../models/clan');
const CharacterModel = require('../../models/character');

const loadCharacters = () =>
  CharacterModel.find({
    deleted: false,
    'stats.rating': { $gte: 10 }
  }).sort({ 'stats.rating': -1 });

const loadClans = () =>
  ClanModel.find({
    rating: { $gte: 10 }
  })
    .populate({
      path: 'members',
      populate: {
        path: 'character'
      }
    })
    .sort({ rating: -1 });

const resetClans = () => ClanModel.updateMany({}, { rating: 0 });
const resetCharacters = () =>
  CharacterModel.updateMany({}, { 'stats.rating': 0 });

const saveCharacter = async (character, index) => {
  const { rating } = character.stats;

  const ratingGold = Math.round(rating / 4);

  const isTop5 = index <= 4;
  const isTop10 = index > 4 && index <= 9;
  const isTop25 = index > 9 && index <= 24;

  const goldRewardMax = 500;
  const goldReward = ratingGold < goldRewardMax ? ratingGold : goldRewardMax;

  const rewards = {
    gold: goldReward,
    credits: 0,
    status: null,
    message: ''
  };

  if (isTop5) {
    rewards.gold += 100;
    rewards.credits += 2;
    rewards.status = 'heroTop5';
    rewards.message = character.t('labelHeroTop5', {
      goldBonus: 100,
      creditsBonus: 2
    });
  }

  if (isTop10) {
    rewards.gold += 50;
    rewards.status = 'heroTop10';
    rewards.message = character.t('labelHeroTop10', { goldBonus: 50 });
  }

  if (isTop25) {
    rewards.gold += 25;
    rewards.status = 'heroTop25';
    rewards.message = character.t('labelHeroTop25', { goldBonus: 25 });
  }

  const rewardMessage = character.t('heroSeasonFinished', {
    goldReward,
    bonusMessage: rewards.message
  });

  await character.updateOne({
    $set: {
      'stats.rating': 0,
      'stats.ratingStatus': rewards.status
    },
    $inc: {
      'inventory.gold': rewards.gold,
      'inventory.credits': rewards.credits
    }
  });

  return character.message(rewardMessage);
};

const saveClan = async (clan, index) => {
  const messages = [];
  const isTop5 = index <= 4;

  const ratingGold = Math.round(clan.rating / 4);

  const goldRewardMax = 1000;
  const goldReward = ratingGold < goldRewardMax ? ratingGold : goldRewardMax;
  const goldBonus = 250;

  const updateQuery = {
    $set: {
      rating: 0,
      ratingStatus: isTop5 ? 'clanTop5' : null
    },
    $inc: {
      'inventory.gold': isTop5 ? goldReward + goldBonus : goldReward
    }
  };

  await clan.updateOne(updateQuery);

  messages.push({
    key: 'clanSeasonFinished',
    params: { goldReward }
  });

  if (isTop5) {
    messages.push({
      key: 'labelClanTop5',
      params: { goldBonus }
    });
  }

  clan.notifyMembers(messages);
};

const resetMaximusSeasonJob = async (job, done) => {
  const characters = await loadCharacters();
  const clans = await loadClans();

  if (characters) {
    await saveAsync(characters, saveCharacter);
    await resetCharacters();
  }

  if (clans) {
    await saveAsync(clans, saveClan);
    await resetClans();
  }

  done();
};

module.exports = resetMaximusSeasonJob;
