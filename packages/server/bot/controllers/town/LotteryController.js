const moment = require('moment');
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');
const LotteryTourModel = require('models/lottery_tour');
const { LOTTERY_COMMISSION_BASE } = require('data/settings');
const { round } = require('utils');

class LotteryController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onLottery: 'sendLotteryMenu'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  loadLotteryTour() {
    return LotteryTourModel.findOne({ active: true });
  }

  async sendLotteryMenu($, customMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const lotteryTour = await this.loadLotteryTour();
    const lotteryJob = await lotteryTour.getAgendaJob();

    const tx = character.getPhrases();
    const tourRates = lotteryTour.rates.toObject();
    const tourFinishDate = Date.parse(lotteryJob.attrs.nextRunAt);
    const tourFinishLeft = moment().locale(tx.lang).to(tourFinishDate);
    const playerBetExists = lotteryTour.isTourMember(character.id);

    const tourRatesDetails = Object.keys(tourRates).reduce((str, rateName, index) => {
      const { amount, players, bank } = tourRates[rateName];
      const reward = players.length > 0 ? `${round(bank - (bank * LOTTERY_COMMISSION_BASE) / 100)}💰` : '-';
      const chance = players.length > 0 ? `<b>(${round(100 / players.length)}%)</b>` : '';
      const label = tx[`lotteryBetName.${rateName}`];

      str += `\n\n<b>${index + 1}. ${label}</b>\n💰 ${tx.lotteryBetAmount}: ${amount}💰\n👥 ${tx.lotteryBetQuantity}: ${
        players.length
      }\n🏆 ${tx.lotteryBetWinBank}: ${reward} ${chance}`;

      return str;
    }, '');

    const lotteryMenuMessage = `${tx.lotteryMenuMessage}\n\n<b>🔸 ${tx.labelLotteryStatus}:</b> ${
      tx.labelLotteryStatusOpen
    }\n<b>💸 ${tx.lotteryBetCommission}:</b> ${LOTTERY_COMMISSION_BASE}%\n<b>⏳ ${
      tx.labelLotteryFinishTime
    }:</b> ${tourFinishLeft}${tourRatesDetails}\n\n<i>${playerBetExists ? tx.lotteryBetExists : ''}</i>`;

    const lotteryMenu = {
      layout: 1,
      message: customMessage || lotteryMenuMessage,
      resizeKeyboard: true
    };

    const betOptions = Object.keys(tourRates).reduce((options, rateName) => {
      const { amount } = tourRates[rateName];
      const betOption = {
        [`${tx.lotteryAddBet} ${amount}💰`]: async $ => {
          const [isEnoughGold] = await character.isEnoughGold(amount);

          if (!isEnoughGold) {
            return this.sendLotteryMenu($, tx.shopMessageNoGold);
          }

          return MenuHelper.sendConfirmMenu(
            $,
            tx,
            tx.lotteryAddBetQuestion,
            async $ => {
              lotteryTour.rates[rateName].bank += amount;
              lotteryTour.rates[rateName].players.push(character.id);
              character.inventory.gold -= amount;

              await lotteryTour.save();
              await character.save();

              return this.sendLotteryMenu($);
            },
            $ => {
              return this.sendLotteryMenu($);
            }
          );
        }
      };

      return { ...options, ...betOption };
    }, {});

    const cancelOptions = {
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.townMenuBackMessage
        });
      },
      anyMatch: $ => this.sendLotteryMenu($)
    };

    if (playerBetExists) {
      $.runMenu(Object.assign(lotteryMenu, cancelOptions), $.files.loanShark);
    } else {
      $.runMenu(Object.assign(lotteryMenu, betOptions, cancelOptions), $.files.loanShark);
    }
  }
}

module.exports = LotteryController;
