const config = require('config');
const Telegram = require('bot/lib/core/Telegram');
const CharacterModel = require('models/character');
const tokensService = require('services/tokens');
const SettingsManager = require('../../managers/SettingsManager');
const { getValueByPercentage } = require('../../../utils');

class BankController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onBank: 'sendBankMenu'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  async renderBankMenu($, customMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    return {
      layout: 1,
      message: customMessage || tx.bankMenuMessage,
      menu: [
        {
          text: tx.labelBuyTokens,
          url: `${config.WEB_URL_BANK}/bank`
        },
        {
          text: tx.labelWithdrawTokens,
          callback: async query => {
            if (!character.waxWallet) {
              return query.answer(tx.noWallet);
            }

            if (character.stats.level < 2) {
              return query.answer(tx.withdrawNotAvailable);
            }

            const withdrawMenu = await this.renderWithdrawMenu($);
            query.update(withdrawMenu);
          }
        },
        {
          text: tx.labelBuyGold,
          callback: async query => {
            const buyGoldTokensMenu = await this.renderBuyGoldTokensMenu($);
            query.update(buyGoldTokensMenu);
          }
        },
        {
          text: tx.labelBuyCredits,
          callback: async query => {
            const buyCreditsTokensMenu = await this.renderBuyCreditsTokensMenu($);
            query.update(buyCreditsTokensMenu);
          }
        },
        {
          text: tx.labelExchangeCredits,
          callback: async query => {
            const creditsExchangeMenu = await this.renderCreditsExchangeMenu($);
            query.update(creditsExchangeMenu);
          }
        }
      ]
    };
  }

  async sendBankMenu($) {
    const { userId } = $;
    const bankMenu = await this.renderBankMenu($);
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    $.sendPhoto($.files.banker, { caption: tx.bankIntroMessage }).then(() => {
      $.runInlineMenu(bankMenu);
    });
  }

  async renderWithdrawMenu($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const { inventory, waxWallet } = character;
    const wallet = waxWallet ? waxWallet.account : null;

    const getMenuMessage = () =>
      character.t('withdrawMenuMessage', {
        wallet,
        tokens: inventory.tokens,
        rate: SettingsManager.TOKENS_WITHDRAW_RATE
      });

    const menuMessage = getMenuMessage(inventory.tokens);
    const buyValues = [1000, 2500, 5000, 10000, 15000, 20000, 25000, 50000, 100000];
    const buyOptions = buyValues
      .filter(value => value <= inventory.tokens)
      .map(value => ({
        text: `🪙 ${value}`,
        callback: async query => {
          const [isEnoughTokens] = await character.isEnough('inventory.tokens', value);

          if (!isEnoughTokens) {
            const messageNoTokens = character.t('messageNoTokens', {
              tokens: inventory.tokens
            });

            return query.prevMenu(messageNoTokens);
          }

          const lfgk = getValueByPercentage(value, SettingsManager.TOKENS_WITHDRAW_RATE);
          const confirmMessage = character.t('withdrawQuestion', { value, wallet, lfgk });

          return query.confirm({
            message: confirmMessage,
            accept: async _query => {
              const [isEnoughTokens] = await character.isEnough('inventory.tokens', value);

              if (isEnoughTokens) {
                const result = await tokensService.withdrawTokens(wallet, lfgk);

                if (result) {
                  await character.updateOne({ $inc: { 'inventory.tokens': `-${value}` } });

                  const updateMenu = await this.renderWithdrawMenu($);
                  const updateMessage = character.t('withdrawSuccess', { value, wallet, lfgk });

                  _query.update(updateMenu, updateMessage);
                } else {
                  const updateMenu = await this.renderWithdrawMenu($);
                  const updateMessage = character.t('withdrawError');

                  _query.update(updateMenu, updateMessage);
                }
              } else {
                const messageNoTokens = character.t('messageNoTokens', {
                  tokens: inventory.tokens
                });

                return _query.prevMenu(messageNoTokens);
              }
            }
          });
        }
      }));

    return {
      layout: 2,
      message: menuMessage,
      menu: [
        ...buyOptions,
        {
          text: tx.labelBack,
          callback: async query => {
            const bankMenu = await this.renderBankMenu($);
            query.update(bankMenu);
          }
        }
      ]
    };
  }

  async renderBuyCreditsTokensMenu($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const { inventory } = character;

    const getMenuMessage = () =>
      character.t('buyCreditsTokensMenuMessage', {
        rate: SettingsManager.TOKENS_CREDITS_EXCHANGE_RATE,
        tokens: inventory.tokens
      });

    const menuMessage = getMenuMessage(inventory.tokens);
    const buyValues = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100];
    const buyOptions = buyValues.map(value => ({
      text: `💎 ${value}`,
      callback: async query => {
        const tokens = Math.round(value * SettingsManager.TOKENS_CREDITS_EXCHANGE_RATE);
        const [isEnoughTokens] = await character.isEnough('inventory.tokens', tokens);

        if (!isEnoughTokens) {
          const messageNoTokens = character.t('messageNoTokens', {
            tokens: inventory.tokens
          });

          return query.prevMenu(messageNoTokens);
        }

        const confirmMessage = character.t('buyCreditsTokensQuestion', {
          tokens,
          value
        });

        return query.confirm({
          message: confirmMessage,
          accept: async _query => {
            const [isEnoughTokens] = await character.isEnough('inventory.tokens', tokens);

            if (!isEnoughTokens) {
              const messageNoTokens = character.t('messageNoTokens', {
                tokens: inventory.tokens
              });

              return query.prevMenu(messageNoTokens);
            }

            await character.updateOne({ $inc: { 'inventory.tokens': `-${tokens}`, 'inventory.credits': value } });

            const updateMessage = character.t('buyCreditsTokensSuccess', { tokens, value });
            const updatedMenu = await this.renderBuyCreditsTokensMenu($);

            _query.update(updatedMenu, updateMessage);
          }
        });
      }
    }));

    return {
      layout: 2,
      message: menuMessage,
      menu: [
        ...buyOptions,
        {
          text: tx.labelBack,
          callback: async _query => {
            const bankMenu = await this.renderBankMenu($);
            _query.update(bankMenu);
          }
        }
      ]
    };
  }

  async renderBuyGoldTokensMenu($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const { inventory } = character;

    const getMenuMessage = () =>
      character.t('buyGoldTokensMenuMessage', {
        rate: SettingsManager.TOKENS_GOLD_EXCHANGE_RATE,
        tokens: inventory.tokens
      });

    const menuMessage = getMenuMessage();
    const buyValues = [1, 5, 10, 25, 50, 100, 200, 500];
    const buyOptions = buyValues.map(value => ({
      text: `💰 ${value}`,
      callback: async query => {
        const tokens = Math.round(value * SettingsManager.TOKENS_GOLD_EXCHANGE_RATE);
        const [isEnoughTokens] = await character.isEnough('inventory.tokens', tokens);

        if (!isEnoughTokens) {
          const messageNoTokens = character.t('messageNoTokens', {
            tokens: inventory.tokens
          });

          return query.prevMenu(messageNoTokens);
        }

        const confirmMessage = character.t('buyGoldTokensQuestion', {
          tokens,
          value
        });

        return query.confirm({
          message: confirmMessage,
          accept: async _query => {
            const [isEnoughTokens] = await character.isEnough('inventory.tokens', tokens);

            if (!isEnoughTokens) {
              const messageNoTokens = character.t('messageNoTokens', {
                tokens: inventory.tokens
              });

              return _query.prevMenu(messageNoTokens);
            }

            await character.updateOne({ $inc: { 'inventory.tokens': `-${tokens}`, 'inventory.gold': value } });

            const updateMessage = character.t('buyGoldTokensSuccess', { tokens, value });
            const updatedMenu = await this.renderBuyGoldTokensMenu($);

            _query.update(updatedMenu, updateMessage);
          }
        });
      }
    }));

    return {
      layout: 2,
      message: menuMessage,
      menu: [
        ...buyOptions,
        {
          text: tx.labelBack,
          callback: async _query => {
            const bankMenu = await this.renderBankMenu($);
            _query.update(bankMenu);
          }
        }
      ]
    };
  }

  async renderCreditsExchangeMenu($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const { inventory } = character;

    const getMenuMessage = credits =>
      character.t('exchangeMenuMessage', {
        gold: SettingsManager.CREDITS_EXCHANGE_RATE,
        credits
      });

    const exchangeMessage = getMenuMessage(inventory.credits);
    const exchangeValues = [1, 2, 3, 5, 10, 25, 50, 100];
    const exchangeOptions = exchangeValues
      .filter(value => value <= inventory.credits)
      .map(credits => ({
        text: `💎 ${credits}`,
        callback: async query => {
          const [isEnoughCredits] = await character.isEnough('inventory.credits', credits);

          if (!isEnoughCredits) {
            const messageNoCredits = character.t('messageNoCredits', {
              credits: inventory.credits
            });

            return query.prevMenu(messageNoCredits);
          }

          const gold = Math.round(credits * SettingsManager.CREDITS_EXCHANGE_RATE);
          const confirmMessage = character.t('exchangeConfirmQuestion', {
            credits,
            gold
          });

          return query.confirm({
            message: confirmMessage,
            accept: async _query => {
              if (!isEnoughCredits) {
                const messageNoCredits = character.t('messageNoCredits', {
                  credits: inventory.credits
                });

                return _query.prevMenu(messageNoCredits);
              }

              await character.updateOne({ $inc: { 'inventory.credits': `-${credits}`, 'inventory.gold': gold } });
              const updatedMenu = await this.renderCreditsExchangeMenu($);

              _query.update(updatedMenu, tx.exchangeConfirmSuccess);
            }
          });
        }
      }));

    return {
      layout: 1,
      message: exchangeMessage,
      menu: [
        ...exchangeOptions,
        {
          text: tx.labelBack,
          callback: async query => {
            const bankMenu = await this.renderBankMenu($);
            query.update(bankMenu);
          }
        }
      ]
    };
  }
}

module.exports = BankController;
