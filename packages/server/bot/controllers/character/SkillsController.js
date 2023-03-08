const CharacterModel = require('models/character');
const { TelegramBaseController } = require('bot/lib/core/Telegram');
const { renderCharacterValues } = require('bot/helpers/character');

class SkillsController extends TelegramBaseController {
  get routes() {
    return {
      onSkills: 'onSkills',
      onSkillIncrease: 'onSkillIncrease'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId })
      .populate({ path: 'clan', select: 'name icon' })
      .populate({ path: 'items.weapon', populate: { path: 'data' } });
  }

  async onSkills($, prevMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const skillsMenu = this.renderSkillsMenu($, character);

    $.runInlineMenu(skillsMenu, prevMessage);
  }

  async onSkillIncrease($) {
    const {
      userId,
      commandParams: { id, value }
    } = $;

    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    const labelId = this.getSkillLabel(id);
    const label = tx[labelId];

    const skillValue = value ? Number(value) : 1;
    const skillData = { id, label, value: skillValue };

    if (!skillData.label) {
      return $.sendMessage(tx.skillsIncreaseNameError);
    }

    if (skillData.value <= 0 || skillData.value > 50) {
      return $.sendMessage(tx.skillsIncreaseValueError);
    }

    return this.handleSkillIncrease(character, skillData)
      .then(({ message }) => {
        $.sendMessage(message);
      })
      .catch(message => {
        $.sendMessage(message);
      });
  }

  getSkillLabel(id) {
    const labels = {
      strength: 'labelStrength',
      agility: 'labelAgility',
      intuition: 'labelIntuition',
      endurance: 'labelEndurance'
    };

    return labels[id];
  }

  renderSkillsMenu($, character) {
    const tx = character.getPhrases();
    const {
      labelStrength,
      labelAgility,
      labelIntuition,
      labelEndurance,
      skillsAvailableQuestion,
      skillsNotAvailableMessage
    } = tx;

    const characterTag = character.renderTag({ showHealth: true });
    const characterValues = renderCharacterValues(tx, character);

    const skillsAvailable = character.t('skillsAvailableMessage', {
      availableSkills: character.skillsTotal
    });

    const skillsMessage =
      character.skillsTotal > 0 ? `${skillsAvailable}\n\n${skillsAvailableQuestion}` : skillsNotAvailableMessage;

    const skillsMenuMessage = `${characterTag}\n\n${characterValues}\n\n${skillsMessage}`;

    const skillsMenu = {
      layout: 2,
      method: 'sendMessage',
      message: skillsMenuMessage,
      menu: []
    };

    if (character.skillsTotal > 0) {
      const handleCallback = ($, character, query, id) => {
        const labelId = this.getSkillLabel(id);
        const label = tx[labelId];
        const confirmMessage = character.t('skillsIncreasedQuestion', {
          label
        });

        query.confirm({
          message: confirmMessage,
          accept: query => {
            this.handleSkillIncrease(character, { id, label, value: 1 })
              .then(({ message, character }) => {
                const updatedMenu = this.renderSkillsMenu($, character);

                query.update(updatedMenu);
                query.answer(message);
              })
              .catch(message => {
                query.prevMenu();
                query.answer(message);
              });
          }
        });
      };

      skillsMenu.menu = [
        {
          text: `${labelStrength} +1`,
          callback: query => handleCallback($, character, query, 'strength')
        },
        {
          text: `${labelAgility} +1`,
          callback: query => handleCallback($, character, query, 'agility')
        },
        {
          text: `${labelIntuition} +1`,
          callback: query => handleCallback($, character, query, 'intuition')
        },
        {
          text: `${labelEndurance} +1`,
          callback: query => handleCallback($, character, query, 'endurance')
        }
      ];
    }

    return skillsMenu;
  }

  async handleSkillIncrease(character, skillData) {
    const { id, value, label } = skillData;
    const [isEnoughSkills] = await character.isEnoughAvailableSkills(value);

    if (isEnoughSkills) {
      character.skills[id] += value;
      character.availableSkills -= value;

      await character.save();

      const message = character.t('skillsIncreasedMessage', {
        availableSkills: character.availableSkills,
        label,
        value
      });

      return { message, character };
    }

    const [isEnoughPotionSkills] = await character.isEnough('potionSkills', value);

    if (isEnoughPotionSkills) {
      if (character.potionSkillsUsed >= 5) {
        return Promise.reject(character.t('skillsIncreasePotionLimit'));
      }

      character.skills[id] += value;
      character.potionSkills -= value;
      character.potionSkillsUsed += value;

      await character.save();

      const message = character.t('skillsIncreasedMessage', {
        availableSkills: character.skillsTotal,
        label,
        value
      });

      return { message, character };
    }

    return Promise.reject(character.t('skillsIncreaseNotAvailable'));
  }
}

module.exports = SkillsController;
