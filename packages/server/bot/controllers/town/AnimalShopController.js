const Random = require('random-js')();
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const AssetsManager = require('bot/managers/AssetsManager');
const CharacterModel = require('models/character');
const CharacterAnimalModel = require('models/character_animal');
const ANIMAL_NAMES = require('data/animal_names');

class AnimalShopController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onAnimalShop: 'sendAnimalShopMenu'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  createCharacterAnimal(userId, animalData) {
    const animalName = Random.pick(ANIMAL_NAMES);

    return CharacterAnimalModel.create({
      userId: userId,
      name: animalName,
      data: animalData._id,
      icon: animalData.icon,
      title: animalData.title,
      minDamage: animalData.minDamage,
      maxDamage: animalData.maxDamage,
      health: animalData.maxHealth,
      maxHealth: animalData.maxHealth
    });
  }

  getAnimals() {
    return AssetsManager.getAnimals();
  }

  async sendAnimalShopMenu($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    const animalShopMenu = {
      layout: 1,
      message: `<b>${tx.labelAnimalsShop}</b>\n\n${tx.animalShopIndexMessage}`,
      resizeKeyboard: true,
      [tx.labelSelectAnimal]: async $ => {
        const animals = this.getAnimals();
        const animalMenuItems = this.renderAnimalMenuItems(character, animals);

        await $.runMenu({
          ...animalShopMenu,
          message: tx.animalShopListMessage
        });

        return $.runPaginatedMenu({
          infinite: true,
          items: animalMenuItems
        });
      },
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.townMenuBackMessage
        });
      }
    };

    $.runMenu(animalShopMenu, $.files.beastTrainer);
  }

  renderAnimalMenuItems(character, animals) {
    const tx = character.getPhrases();
    const {
      userId,
      values: { masteryAnimals },
      inventory: { gold, credits },
      hasAnimal
    } = character;

    const handleBuy = async (query, animal, params) => {
      const { masteryRequired, priceGold, priceCredits } = animal;
      const { forGold, forCredits, title, index } = params;

      const errors = [];

      if (hasAnimal) {
        errors.push(tx.shopMessageAnimalExists);
      }

      if (masteryAnimals < masteryRequired) {
        errors.push(tx.shopMessageNoMasteryAnimals);
      }

      if (forGold && gold < priceGold) {
        errors.push(character.t('messageNoGold', { gold }));
      }

      if (forCredits && credits < priceCredits) {
        errors.push(character.t('messageNoCredits', { credits }));
      }

      if (errors.length > 0) {
        const errorMessage = errors.join('\n\n');
        return query.updatePaginated(
          {
            page: index,
            layout: [1, 2],
            items: this.renderAnimalMenuItems(character, animals)
          },
          errorMessage
        );
      }

      const price = forGold
        ? character.t('countGold', { gold: priceGold })
        : character.t('countCredits', { credits: priceCredits });

      const confirmMessage = character.t('animalBuyConfirmMessage', {
        title,
        price
      });

      return query.confirm({
        message: confirmMessage,
        accept: async _query => {
          const { _id } = await this.createCharacterAnimal(userId, animal);

          character.animal = _id;

          if (forGold) character.inventory.gold -= priceGold;
          if (forCredits) character.inventory.credits -= priceCredits;

          await character.save();

          const successMessage = character.t('animalBuySuccessMessage', {
            title
          });

          return _query.updatePaginated(
            {
              page: index,
              layout: [1, 2],
              items: this.renderAnimalMenuItems(character, animals)
            },
            successMessage
          );
        }
      });
    };

    return animals.map((animal, index) => {
      const { priceGold, priceCredits } = animal;
      const title = animal.title[tx.lang];
      const details = animal.renderDetails(tx, {
        showNumber: index + 1,
        showPrice: true
      });

      return {
        id: animal.id,
        message: details,
        menu: [
          {
            text: character.t('labelBuyForGold', { value: priceGold }),
            callback: query => handleBuy(query, animal, { forGold: true, title, index })
          },
          {
            text: character.t('labelBuyForCredits', { value: priceCredits }),
            callback: query => handleBuy(query, animal, { forCredits: true, title, index })
          }
        ]
      };
    });
  }
}

module.exports = AnimalShopController;
