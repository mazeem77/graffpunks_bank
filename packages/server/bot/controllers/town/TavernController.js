const Random = require('random-js')();
const agenda = require('services/agenda');
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const AbilityModel = require('models/ability');
const CharacterModel = require('models/character');
const ItemModel = require('models/item');
const InventoryItemModel = require('models/inventory_item');
const AssetBurnModel = require('models/asset_burn');
const DailyQuestModel = require('models/daily_quest');
const CharacterDailyQuestModel = require('models/character_daily_quest');
const { sendRandomAssetFromPool } = require('../../../services/tokens');

const BURN_TEMPLATE_REWARDS = {
  411573: {
    gold: 10
  },
  460298: {
    gold: 10
  },
  411575: {
    credits: 10
  },
  460301: {
    credits: 10
  },
  435046: {
    skills: 1
  },
  460306: {
    skills: 1
  },
  435051: {
    skills: 6
  },
  462130: {
    skills: 6
  },
  435048: {
    item: {
      name: 'potionPunkMe',
      id: '61f02381b5cd1c1228068116'
    }
  },
  460308: {
    item: {
      name: 'potionPunkMe',
      id: '61f02381b5cd1c1228068116'
    }
  },
  435050: {
    item: {
      name: 'potionHealth100',
      id: '595b22376e22600018869eff'
    }
  },
  462423: {
    item: {
      name: 'potionHealth100',
      id: '595b22376e22600018869eff'
    }
  }
};

class TavernController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onTavern: 'sendTavernMenu'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'dailyQuest',
      populate: { path: 'data' }
    });
  }

  async loadAbilityPotion(userId) {
    const abilityPotionItem = await ItemModel.findOne({ potionType: 'ability' });
    return InventoryItemModel.findOne({ userId, data: abilityPotionItem._id, used: false }).populate({ path: 'data' });
  }

  loadDailyQuests() {
    return DailyQuestModel.find({ active: true });
  }

  loadCharacterDailyQuests(userId) {
    return CharacterDailyQuestModel.find({ userId }, { name: 1 });
  }

  async rewardAssetBurns(character) {
    const { userId } = character;
    const tx = character.getPhrases();

    if (!character.waxWallet) {
      return tx.noWallet;
    }

    try {
      const burns = await AssetBurnModel.find({ wallet: character.waxWallet.account, rewarded: false });

      if (burns.length === 0) {
        return tx.noBurnsFound;
      }

      const rewards = { gold: 0, credits: 0, skills: 0, items: [] };

      burns.forEach(burn => {
        const reward = BURN_TEMPLATE_REWARDS[burn.templateId];

        if (reward && reward.gold) {
          rewards.gold += reward.gold;
        }

        if (reward && reward.credits) {
          rewards.credits += reward.credits;
        }

        if (reward && reward.skills) {
          rewards.skills += reward.skills;
        }

        if (reward && reward.item) {
          rewards.items.push(reward.item);
        }
      });

      await AssetBurnModel.updateMany({ wallet: character.waxWallet.account, rewarded: false }, { rewarded: true });
      await character.updateOne({
        $inc: {
          'inventory.gold': rewards.gold,
          'inventory.credits': rewards.credits,
          potionSkills: rewards.skills
        }
      });

      if (rewards.items.length > 0) {
        const payload = rewards.items.map(item => ({ userId, data: item.id, maxDepreciation: 1 }), []);
        const items = await InventoryItemModel.insertMany(payload);

        await character.updateOne({ $push: { 'inventory.items': items } });
      }

      let message = tx.burnRewardsMessage;

      if (rewards.gold > 0) {
        message += `\n\n${character.t('burnRewardGold', { value: rewards.gold })}`;
      }

      if (rewards.credits > 0) {
        message += `\n\n${character.t('burnRewardCredits', { value: rewards.credits })}`;
      }

      if (rewards.skills > 0) {
        message += `\n\n${character.t('burnRewardSkills', { value: rewards.skills })}`;
      }

      if (rewards.items.length > 0) {
        message += `\n\n${character.t('burnRewardItems', { value: rewards.items.length })}`;
      }

      return message;
    } catch (err) {
      return tx.burnRewardError;
    }
  }

  async punkMe(character) {
    const { userId } = character;
    const tx = character.getPhrases();
    const potion = await this.loadAbilityPotion(userId);

    if (!potion) {
      return tx.noAbilityPotionsFound;
    }

    const randomAbility = await AbilityModel.getRandom(character.abilities);

    if (!randomAbility) {
      return tx.randomAbilityError;
    }

    const job = await agenda.schedule(`6 hours later`, 'cancel_ability', {
      userId,
      abilityId: randomAbility.id
    });

    potion.depreciation += 1;
    potion.used = potion.maxDepreciation === potion.depreciation;
    character.abilities.push(randomAbility.id);

    await job.save();
    await character.save();
    await potion.save();

    const title = randomAbility.title[tx.lang];
    return character.t('randomAbilityActivated', { title });
  }

  async getRandomQuest(userId) {
    const dailyQuests = await this.loadDailyQuests();
    const characterDailyQuests = await this.loadCharacterDailyQuests(userId);

    const completed = characterDailyQuests.reduce((names, quest) => [...names, quest.name], []);
    const filtered = dailyQuests.filter(quest => !completed.includes(quest.name));

    return filtered.length > 0 ? Random.pick(filtered) : null;
  }

  async sendTavernMenu($, customMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    if (character.dailyQuest) {
      return this.sendActiveQuestMenu($, tx, character, customMessage);
    }

    const tavernMenu = {
      layout: 1,
      message: customMessage || tx.tavernMenuMessage,
      resizeKeyboard: true,
      [tx.labelSearchDailyQuest]: async $ => {
        if (character.dailyQuestApplied) {
          return this.sendTavernMenu($, tx.tavernDailyQuestAppliedMessage);
        }

        const quest = await this.getRandomQuest(userId);

        if (quest) {
          return this.sendQuestMenu($, tx, character, quest);
        }

        return $.runMenu({
          ...tavernMenu,
          message: tx.tavernMenuNoQuestMessage
        });
      },
      [tx.labelGetBurnRewards]: async $ => {
        const resultMessage = await this.rewardAssetBurns(character);
        return this.sendTavernMenu($, resultMessage);
      },
      [tx.labelPunkMe]: async $ => {
        const resultMessage = await this.punkMe(character);
        return this.sendTavernMenu($, resultMessage);
      },
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.townMenuBackMessage
        });
      }
    };

    return $.runMenu(tavernMenu, $.files.bartender);
  }

  sendQuestMenu($, tx, character, quest) {
    const { userId } = character;
    const dailyQuestMessage = this.renderQuestDetails(tx, quest);
    const dailyQuestMenu = {
      layout: 1,
      message: dailyQuestMessage,
      resizeKeyboard: true,
      [tx.labelTakeDailyQuest]: async $ => {
        await CharacterDailyQuestModel.create({
          userId: userId,
          name: quest.name,
          data: quest._id
        });

        return this.sendTavernMenu($, tx.tavernQuestApplySuccess);
      },
      [tx.labelBack]: $ => this.sendTavernMenu($)
    };

    $.runMenu(dailyQuestMenu);
  }

  sendActiveQuestMenu($, tx, character, customMessage) {
    const dailyQuestData = character.dailyQuest.data;
    const dailyQuestMessage = this.renderQuestDetails(tx, dailyQuestData, {
      characterQuest: character.dailyQuest
    });

    const dailyQuestMenu = {
      layout: 1,
      message: customMessage || dailyQuestMessage,
      resizeKeyboard: true
    };

    const backOption = {
      [tx.labelGetBurnRewards]: async $ => {
        const resultMessage = await this.rewardAssetBurns(character);
        return this.sendTavernMenu($, resultMessage);
      },
      [tx.labelPunkMe]: async $ => {
        const resultMessage = await this.punkMe(character);
        return this.sendTavernMenu($, resultMessage);
      },
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.townMenuBackMessage
        });
      }
    };

    const cancelOption = {
      [tx.labelCancelDailyQuest]: async $ => {
        await character.dailyQuest.remove();

        return MenuHelper.sendTownMenu($, tx, {
          message: tx.tavernQuestCancelSuccess
        });
      }
    };

    const completeOption = {
      [tx.labelRewardDailyQuest]: async $ => {
        const {
          oneTime,
          rewards: { rating, experience, gold, credits }
        } = dailyQuestData;

        character.stats.rating += rating;
        character.stats.experience += experience;
        character.inventory.gold += gold;
        character.inventory.credits += credits;

        if (!oneTime) {
          await character.dailyQuest.remove();
        }

        character.dailyQuest = null;

        if (character.waxWallet) {
          sendRandomAssetFromPool(character.waxWallet);
          character.notify('characterNewAssetGift');
        }

        await character.save();

        return MenuHelper.sendTownMenu($, tx, {
          message: tx.tavernQuestCompleteSuccess
        });
      }
    };

    if (character.dailyQuest.completed) {
      return $.runMenu({
        ...dailyQuestMenu,
        ...completeOption,
        ...backOption
      });
    }

    return $.runMenu({
      ...dailyQuestMenu,
      ...cancelOption,
      ...backOption
    });
  }

  renderQuestDetails(tx, quest, options = {}) {
    const { characterQuest } = options;
    const { title, description, rewards, goalText } = quest;
    const { gold, credits, rating, experience } = rewards;
    const rewardLabels = [];

    if (gold > 0) rewardLabels.push(`💰 +${gold} ${tx.labelOfGold}`);
    if (credits > 0) rewardLabels.push(`💎 +${credits} ${tx.titleCredit3}`);
    if (rating > 0) rewardLabels.push(`💯 +${rating} ${tx.labelRatingPoints}`);
    if (experience > 0) rewardLabels.push(`🌟 +${experience} ${tx.labelExp}`);

    const details = `<b>${title[tx.lang]}</b>\n\n${description[tx.lang]}`;
    const reward = `<b>${tx.labelQuestReward}:</b> ${rewardLabels.join(', ')}`;
    const goal = `<b>${tx.labelQuestGoal}:</b> ${goalText[tx.lang]}`;

    if (characterQuest) {
      const progressLabel = characterQuest.getProgressLabel(tx);
      const progress = `\n<b>${tx.labelQuestProgress}:</b> ${progressLabel}`;

      return `${details}\n\n${goal}${progress}\n\n${reward}`;
    }

    return `${details}\n\n${goal}\n\n${reward}`;
  }
}

module.exports = TavernController;
