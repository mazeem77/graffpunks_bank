const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const CharacterModel = require('models/character');
const AvatarModel = require('models/avatar');
const { renderCharacterValues, renderCharacterMastery, isLastStage, isValidName } = require('bot/helpers/character');
const { sendRandomAsset } = require('services/tokens');

class CharacterController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onStats: 'onStats',
      onHero: 'onStats',
      onProfile: 'onProfile',
      onMastery: 'onMastery',
      onAvatar: 'onAvatar',
      onAchievements: 'onAchievements'
    };
  }

  loadWithData(userId) {
    return CharacterModel.findOne({ userId })
      .populate({ path: 'avatar' })
      .populate({ path: 'clan', select: 'name icon' })
      .populate({
        path: 'animal items.weapon',
        populate: { path: 'data' }
      });
  }

  loadWithClan(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'clan',
      select: 'name icon'
    });
  }

  loadAvatars() {
    return AvatarModel.find({});
  }

  getAvatarMenuItems(character, avatars) {
    const tx = character.getPhrases();

    return avatars.map((avatar, index) => {
      const image = `${process.env.WEB_URL}/images/avatars/avatar${avatar.fileNumber}.jpg?v=${Math.floor(Math.random() * 1000) + 1}`;
      const title = avatar.caption[tx.lang];
      const isSelected = character.avatar && character.avatar.equals(avatar.id);

      const countOf = character.t('labelCountOf', {
        count: index + 1,
        total: avatars.length
      });

      const selected = isSelected ? tx.labelSelected : '';
      const caption = `${title} (${countOf}) ${selected}`;

      const avatarItem = {
        id: avatar.id,
        params: [{ image, caption }],
        menu: []
      };

      if (!isSelected) {
        avatarItem.menu.push({
          text: tx.labelSelectAvatar,
          callback: async query => {
            character.avatar = avatar.id;

            const avatarMenuItems = this.getAvatarMenuItems(character, avatars);

            await character.save();
            await query.answer(tx.messageAvatarSelected);
            await query.updatePaginated({
              page: index,
              infinite: true,
              layout: [1, 2],
              method: 'sendPhoto',
              items: avatarMenuItems
            });
          }
        });
      }

      return avatarItem;
    });
  }

  async onAvatar($) {
    const { userId } = $;
    const avatars = await this.loadAvatars();
    const character = await this.loadWithData(userId);
    const tx = character.getPhrases();

    if (!avatars.length) {
      return $.sendMessage(tx.messageNoAvatars);
    }

    const avatarMenuItems = this.getAvatarMenuItems(character, avatars);

    return $.runPaginatedMenu({
      infinite: true,
      layout: [1, 2],
      method: 'sendPhoto',
      items: avatarMenuItems
    });
  }

  async onStats($) {
    const { userId } = $;
    const character = await this.loadWithData(userId);
    const tx = character.getPhrases();
    const statsMessage = this.renderHeroStats($, tx, character);

    MenuHelper.sendHeroMenu($, tx, {
      message: statsMessage
    });
  }

  async onProfile($) {
    const { userId } = $;
    const character = await this.loadWithData(userId);
    const tx = character.getPhrases();

    const { avatarImage } = character;
    const profileMessage = this.renderHeroProfile($, tx, character);

    if (avatarImage) {
      return $.sendPhoto(avatarImage, {
        caption: profileMessage
      });
    }

    return $.sendMessage(profileMessage);
  }

  async onMastery($) {
    const { userId } = $;
    const character = await this.loadWithClan(userId);

    const tx = character.getPhrases();
    const characterTag = character.renderTag({ showHealth: true });
    const characterMastery = renderCharacterMastery(tx, character);
    const masteryMessage = `${characterTag}\n\n${characterMastery}\n\n${tx.masteryInfo}`;

    MenuHelper.sendHeroMenu($, tx, {
      message: masteryMessage
    });
  }

  // Not implemented
  async onAchievements($) {
    const { userId } = $;
    const character = await this.loadWithClan(userId);

    const tx = character.getPhrases();
    const characterTag = character.renderTag({ showHealth: true });
    const achievementsMessage = `${characterTag}`;

    MenuHelper.sendHeroMenu($, tx, {
      message: achievementsMessage
    });
  }

  renderState(tx, character) {
    const activeJob = character.getActiveJob(tx);
    const regenerating = character.getRegenerationState(tx);

    const states = [];

    if (activeJob) {
      states.push(activeJob.label);
    }

    if (regenerating) {
      states.push(regenerating);
    }

    Object.keys(character.effects).forEach(type => {
      const value = character.effects[type];

      if (value > 0) {
        states.push(character.t(`effect.${type}`, { value }));
      }
    });

    return states.length > 0 ? `${states.join('\n')}\n\n` : '';
  }

  renderHeroStats($, tx, character) {
    const { availableSkills, freeSkillsReset, inventory, isLight, stats, displayName } = character;

    const { level, experience, experienceStageMax, experienceMax } = stats;

    const characterTag = character.renderTag({ showHealth: true });
    const characterStats = character.renderStats(tx, { hideTag: true });
    const characterState = this.renderState(tx, character);

    const experienceStats = isLastStage(stats)
      ? `${experience} / <b>${experienceMax}</b>`
      : `${experience} → ${experienceStageMax} /... / <b>${experienceMax}</b>`;

    const characterTendency = isLight ? tx.labelTendencyLightText : tx.labelTendencyDarkText;

    const statsMessage = `${characterState}<b>${tx.labelLevel}:</b> ${level}\n<b>${tx.labelExperience}:</b> ${experienceStats}\n<b>${tx.labelClanTendency}:</b> ${characterTendency}\n<b>💰 ${tx.labelGold}:</b> ${inventory.gold}\n<b>💎 ${tx.labelCredits}:</b> ${inventory.credits}\n<b>${tx.labelTokens}:</b> ${inventory.tokens}\n\n${characterStats}\n`;

    let profileMessage = `${characterTag}\n\n${statsMessage}\n`;

    if (freeSkillsReset > 0) {
      const resetsMessage = character.t('skillsResetsMessage', {
        freeSkillsReset
      });
      profileMessage += `\n${resetsMessage}`;
    }

    if (availableSkills > 0) {
      const skillsMessage = character.t('skillsAvailableMessage', {
        availableSkills
      });
      profileMessage += `\n${skillsMessage}\n\n${tx.skillsGoToSectionMessage}`;
    }

    if (!isValidName(displayName)) {
      profileMessage += `\n\n${tx.heroNameForbiddenMessage}`;
    }

    return profileMessage;
  }

  renderHeroProfile($, tx, character) {
    const { animal, hasActiveAnimal } = character;
    const characterTag = character.renderTag({ showHealth: true });
    const animalTag = hasActiveAnimal ? animal.renderTag() : tx.labelEmpty;

    const characterValues = renderCharacterValues(tx, character);
    const characterAnimal = `<b>${tx.labelAnimal}:</b> ${animalTag}`;

    return `${characterTag}\n\n${characterValues}\n\n${characterAnimal}`;
  }
}

module.exports = CharacterController;
