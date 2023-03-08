const moment = require('moment');
const Random = require('random-js')();
const LootManager = require('bot/managers/LootManager');
const SettingsManager = require('bot/managers/SettingsManager');
const { getValueByPercentage, getPercentageByValue } = require('utils');

class ActivityManager {
  async getMiningReward({ mining, date, completed, event }) {
    console.log('getMiningReward Start!!!', mining, date, completed, event);

    let timeDiff = date ? moment().diff(date, 'minutes') : 0;
    timeDiff = timeDiff < 0 ? 0 : timeDiff;
    console.log('timeDiff', timeDiff);
    const timeSpent = SettingsManager.MINING_JOB_DURATION_MIN - Math.abs(timeDiff);
    console.log('timeSpent', timeSpent);
    const timeSteps = Math.floor(timeSpent / 10);
    console.log('timeSteps', timeSteps);

    const rewardSteps = [...Array(timeSteps).keys()];
    console.log('rewardSteps', rewardSteps);
    const rewardBase = completed ? Random.integer(10, 100) : 0;

    const unitsMined = rewardSteps.reduce((total, step) => {
      const minReward = step > 20 ? step - 20 : step;
      const maxReward = step < 10 ? step + 20 : step + 5;
      const stepReward = Random.integer(minReward, maxReward);

      return total + stepReward;
    }, rewardBase);

    const unitsBonus = getValueByPercentage(unitsMined, mining);
    const units = Math.round(unitsMined + unitsBonus);

    const progress = getPercentageByValue(SettingsManager.MINING_JOB_DURATION_MIN, timeSpent);
    const lootItems = LootManager.getJobLoot(progress, event);

    return {
      units,
      lootItems
    };
  }
}

module.exports = new ActivityManager();
