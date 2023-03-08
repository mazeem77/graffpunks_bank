const agenda = require('services/agenda');
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const AbilityModel = require('models/ability');
const CharacterModel = require('models/character');

const { SKILLS_RESET_COST } = require('data/settings');
const { calculateTotalSkills } = require('bot/helpers/character');

class AcademyController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onAcademy: 'sendAcademyMenu',
      onAbilities: 'sendAbilitiesMenu',
      onServices: 'sendServicesMenu'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId })
      .populate('abilities')
      .populate({
        path: 'items.weapon items.armor items.helmet items.gloves items.shield items.boots items.belt items.cloak items.amulet items.ring items.bag inventory.items',
        populate: { path: 'data' }
      });
  }

  loadAbilityJobs(userId) {
    return agenda.jobs({
      name: 'cancel_ability',
      'data.userId': userId.toString()
    });
  }

  loadAbilities() {
    return AbilityModel.find({});
  }

  async activateAbility(character, ability, offer) {
    const { userId } = character;
    const { priceCredits, duration } = offer;

    const job = await agenda.schedule(`${duration} later`, 'cancel_ability', {
      userId,
      abilityId: ability.id
    });

    character.inventory.credits -= priceCredits;
    character.abilities.push(ability.id);

    await job.save();
    await character.save();
  }

  async sendAcademyMenu($, customMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    const academyMenu = {
      layout: 2,
      message: customMessage || tx.academyMenuMessage,
      resizeKeyboard: true,
      [tx.labelServices]: $ => $.emulateUpdate(),
      [tx.labelAbilities]: $ => $.emulateUpdate(),
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.townMenuBackMessage
        });
      }
    };

    $.runMenu(academyMenu, $.files.wizard);
  }

  async sendAbilitiesMenu($) {
    const { userId } = $;
    const abilitiesMenu = await this.getAbilitiesMenu(userId);

    $.runPaginatedMenu(abilitiesMenu);
  }

  async sendServicesMenu($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const { freeSkillsReset, availableSkills, hasActiveItems, stats } = character;

    const skillsAfterTrain = calculateTotalSkills(stats);
    const isTrainFree = freeSkillsReset > 0 || availableSkills < 0;
    const trainCost = isTrainFree ? tx.labelFree : character.t('countGold', { gold: SKILLS_RESET_COST });
    const trainMessage = character.t('serviceTrainMessage', { trainCost });

    const servicesMenuItems = [
      {
        message: trainMessage,
        menu: [
          {
            text: tx.serviceTrainApply,
            callback: async query => {
              const [isEnoughGold, gold] = await character.isEnough('inventory.gold', SKILLS_RESET_COST);
              const isUseless = availableSkills === skillsAfterTrain;

              const errorMessages = [];
              const cancel = message => {
                query.updatePaginated({ items: servicesMenuItems }, message);
              };

              if (isUseless) {
                return cancel(tx.serviceTrainUseless);
              }

              if (!isTrainFree && !isEnoughGold) {
                errorMessages.push(character.t('messageNoGold', { gold }));
              }

              if (hasActiveItems) {
                errorMessages.push(tx.serviceTrainHasItems);
              }

              if (errorMessages.length > 0) {
                return cancel(errorMessages.join('\n\n'));
              }

              const confirmMessage = character.t('serviceTrainQuestion', {
                skillsAfterTrain
              });
              const successMessage = character.t('serviceTrainSuccess', {
                skillsAfterTrain
              });

              return query.confirm({
                message: confirmMessage,
                accept: async _query => {
                  await character.resetSkills();

                  _query.updatePaginated({ items: servicesMenuItems }, successMessage);
                }
              });
            }
          }
        ]
      }
    ];

    const servicesMenu = {
      layout: [1, 2],
      infinite: true,
      items: servicesMenuItems
    };

    $.runPaginatedMenu(servicesMenu);
  }

  async getAbilitiesMenu(userId) {
    const abilities = await this.loadAbilities();
    const character = await this.loadCharacter(userId);
    const abilityJobs = await this.loadAbilityJobs(userId);

    const tx = character.getPhrases();

    const abilityItems = abilities.map((ability, index) => {
      const abilityJob = abilityJobs.find(({ attrs }) => ability._id.equals(attrs.data.abilityId));
      const number = character.t('labelCountOf', {
        count: index + 1,
        total: abilities.length
      });

      const { message, buttons } = ability.renderDetails(tx, {
        showNumber: number,
        abilityJob
      });

      const menuItem = {
        message,
        menu: []
      };

      if (!abilityJob) {
        menuItem.menu = buttons.map(({ offer, durationText, creditsText }) => ({
          text: `🔸 ${durationText}`,
          callback: async query => {
            const [isEnoughCredits, credits] = await character.isEnough('inventory.credits', offer.priceCredits);

            if (!isEnoughCredits) {
              const messageNoCredits = character.t('messageNoCredits', {
                credits
              });
              query.answer(messageNoCredits);
              query.updatePaginated({ page: index, items: abilityItems });
              return;
            }

            const abilityName = ability.title[tx.lang];
            const confirmMessage = character.t('abilityApplyConfirm', {
              abilityName,
              durationText,
              creditsText
            });
            const successMessage = character.t('abilityApplySuccess', {
              abilityName
            });

            query.confirm({
              message: confirmMessage,
              accept: async _query => {
                await this.activateAbility(character, ability, offer);
                const menu = await this.getAbilitiesMenu(userId);

                _query.answer(successMessage);
                _query.updatePaginated({ ...menu, page: index });
              }
            });
          }
        }));
      }

      return menuItem;
    });

    return {
      layout: [3, 2],
      infinite: true,
      items: abilityItems
    };
  }
}

module.exports = AcademyController;
