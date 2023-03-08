const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');

class AnimalController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onAnimal: 'sendHeroAnimal'
    };
  }

  sendHeroAnimal($) {
    const userId = $.message.from.id;

    CharacterModel.findOne({ userId })
      .populate({ path: 'clan', select: 'name icon' })
      .populate({
        path: 'animal',
        populate: { path: 'data' }
      })
      .then(character => {
        if (character) {
          const tx = character.getPhrases();
          const { animal } = character;

          if (animal) {
            this.sendAnimalMenu($, tx, character, animal);
          } else {
            MenuHelper.sendHeroMenu($, tx, {
              message: tx.animalEmptyMessage
            });
          }
        }
      })
      .catch(err => console.log('error', err));
  }

  sendAnimalMenu($, tx, character, animal, prevMessage) {
    const { masteryAnimals } = character.values;
    const {
      icon,
      name,
      active,
      title,
      level,
      health,
      maxHealth,
      minDamage,
      maxDamage,
      data,
      experience,
      experienceMax,
      availableTrainings
    } = animal;

    const animalTag = `${icon} ${name}🎖${level} — <b>${
      active ? tx.animalActivated : tx.animalDeactivated
    }</b>`;
    const animalDetails = `${animalTag}\n\n<b>${
      tx.labelLevel
    }:</b> ${level}\n<b>${
      tx.labelExperience
    }:</b> ${experience}/${experienceMax}\n<b>${tx.labelAnimalClass}:</b> ${
      title[tx.lang]
    }\n\n<b>${tx.labelAnimalDamage}:</b> ${minDamage}-${maxDamage}\n<b>${
      tx.labelAnimalHealth
    }:</b> ${health}/${maxHealth}\n\n<b>${
      tx.labelAnimalTrainings
    }:</b> ${availableTrainings}\n\n${tx.animalTrainingInfo}`;

    const trainHealth = Math.round(
      5 + data.maxHealth / 15 + masteryAnimals * 2
    );
    const trainMinDamage = Math.round(
      1 + data.minDamage / 4 + masteryAnimals / 4
    );
    const trainMaxDamage = Math.round(
      2 + data.maxDamage / 3 + masteryAnimals / 3
    );

    const animalMenu = {
      layout: 2,
      method: 'sendMessage',
      message: animalDetails,
      menu: [
        {
          text: active ? tx.animalDeactivate : tx.animalActivate,
          callback: query => {
            character.animal.active = !active;
            character.animal.save((err, _animal) => {
              if (_animal) {
                this.sendAnimalMenu($, tx, character, _animal, query.message);
              }
            });
          }
        },
        {
          text: tx.animalDelete,
          callback: query => {
            query.confirm({
              message: tx.animalDeleteQuestion,
              acceptAnswer: tx.animalDeleteSuccess,
              acceptDelete: true,
              accept: () => {
                character.animal.remove((err, removed) => {
                  if (removed) {
                    this.sendHeroAnimal($);
                  }
                });
              }
            });
          }
        }
      ]
    };

    if (availableTrainings > 0) {
      const animalTrainMenu = [
        {
          text: tx.labelTrainAnimalDamage,
          callback: query => {
            character.animal.minDamage += trainMinDamage;
            character.animal.maxDamage += trainMaxDamage;
            character.animal.availableTrainings -= 1;

            character.animal.save((err, _animal) => {
              if (_animal) {
                query.answer(tx.trainSuccess);
                this.sendAnimalMenu($, tx, character, _animal, query.message);
              }
            });
          }
        },
        {
          text: tx.labelTrainAnimalHealth,
          callback: query => {
            character.animal.health += trainHealth;
            character.animal.maxHealth += trainHealth;
            character.animal.availableTrainings -= 1;

            character.animal.save((err, _animal) => {
              if (_animal) {
                query.answer(tx.trainSuccess);
                this.sendAnimalMenu($, tx, character, _animal, query.message);
              }
            });
          }
        }
      ];

      animalMenu.menu = [...animalTrainMenu, ...animalMenu.menu];
    }

    $.runInlineMenu(animalMenu, prevMessage);
  }
}

module.exports = AnimalController;
