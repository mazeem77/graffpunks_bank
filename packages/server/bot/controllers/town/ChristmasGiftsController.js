const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');
const InventoryItemModel = require('models/inventory_item');
const AssetsManager = require('bot/managers/AssetsManager');

class ChristmasGiftsController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onChristmasGifts: 'onChristmasGifts'
    };
  }

  get giftsRating() {
    return {
      sm: 100,
      md: 250,
      lg: 500
    };
  }

  async loadCharacter(userId) {
    const character = await CharacterModel.findOne({ userId }).exec();

    if (!character.progress) {
      await character.save();
    }

    return character.populate({ path: 'progress' }).execPopulate();
  }

  getGifts() {
    return AssetsManager.getGiftItems({
      giftEvent: 'new-year'
    });
  }

  getGiftsMenu($, tx) {
    return {
      layout: 1,
      image: $.files.christmasTree,
      resizeKeyboard: true,
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.townMenuBackMessage
        });
      }
    };
  }

  getGiftRating(size) {
    return this.giftsRating[size];
  }

  getGiftsDetails(character, giftsData) {
    const {
      stats: { rating },
      progress,
      userLang
    } = character;

    return giftsData.reduce(
      (details, gift, index) => {
        const { id, giftSize } = gift;

        const giftRating = this.getGiftRating(giftSize);
        const giftTag = gift.renderTag(userLang);

        const isLast = progress.christmasGifts.length === 2;
        const isTaken = progress.christmasGifts.indexOf(id) !== -1;
        const isAvailable = rating >= giftRating;

        const giftStatus = isTaken
          ? character.t('christmasGiftTaken')
          : character.t('christmasGiftRating', { giftRating });

        details.giftsInfo += `\n${index + 1}. ${giftTag} — ${giftStatus}`;

        if (isAvailable && !isTaken) {
          details.giftsButtons[giftTag] = $ =>
            this.handleGiftTake($, character, {
              id,
              giftTag,
              giftRating,
              isLast
            });
        }

        return details;
      },
      {
        giftsInfo: character.t('christmasGiftsInfo', { rating }),
        giftsButtons: {}
      }
    );
  }

  handleGiftTake($, character, giftData) {
    const { userId } = character;
    const { id, giftRating, isLast } = giftData;

    const tx = character.getPhrases();
    const characterTag = character.renderTag();

    const confirmMessage = character.t('christmasGiftConfirm', giftData);

    const onSubmit = async $ => {
      const item = await InventoryItemModel.create({
        userId: userId,
        data: id
      });

      await character.progress.updateOne({
        $push: { christmasGifts: id }
      });

      await character.updateOne({
        $inc: { 'stats.rating': `-${giftRating}` },
        $push: { 'inventory.items': item._id }
      });

      await this.onChristmasGifts($);

      const christmasGreeting = isLast
        ? character.t('christmasGreeting', { characterTag })
        : '';
      const successMessage = character.t('christmasGiftSuccess', {
        ...giftData,
        christmasGreeting
      });

      return $.sendMessage(successMessage);
    };

    const onReject = $ => this.onChristmasGifts($);

    MenuHelper.sendConfirmMenu($, tx, confirmMessage, onSubmit, onReject);
  }

  async onChristmasGifts($) {
    const { userId } = $;

    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    const giftsMenu = this.getGiftsMenu($, tx);
    const giftsData = this.getGifts();

    if (giftsData.length <= 0) {
      return $.runMenu({
        message: tx.christmasGiftsEmpty,
        ...giftsMenu
      });
    }

    const { giftsInfo, giftsButtons } = this.getGiftsDetails(
      character,
      giftsData
    );
    const giftsMessage = character.t('christmasGiftsMessage', { giftsInfo });

    return $.runMenu({
      message: giftsMessage,
      ...giftsButtons,
      ...giftsMenu
    });
  }
}

module.exports = ChristmasGiftsController;
