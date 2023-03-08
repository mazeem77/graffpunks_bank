const CharacterModel = require('models/character');
const { TelegramBaseController } = require('bot/lib/core/Telegram');
const { HERO_TENDENCY_CHANGE_COST, CLAN_TENDENCY_CHANGE_COST } = require('data/settings');

class TempleController extends TelegramBaseController {
  get routes() {
    return {
      onTemple: 'sendTempleMenu'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'clan',
      populate: {
        path: 'chief'
      }
    });
  }

  async getTempleMenu(userId) {
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const { clan, inventory, isDark } = character;
    const isClanChief = character.isClanChief();

    const heroTendencyName = isDark ? tx.labelTendencyLight : tx.labelTendencyDark;
    const heroTendencyValue = isDark ? tx.labelBlessing : tx.labelVampirism;
    const heroTendencyMessage = character.t('templeHeroTendencyMessage', {
      cost: HERO_TENDENCY_CHANGE_COST,
      name: heroTendencyName,
      value: heroTendencyValue
    });

    const updateMenu = async (query, message, params) => {
      const menu = await this.getTempleMenu(userId);

      query.answer(message);
      query.updatePaginated({ ...menu, ...params });
    };

    const templeMenuItems = [
      {
        message: heroTendencyMessage,
        menu: [
          {
            text: tx.templeTendencyChange,
            callback: async query => {
              const pageParams = { page: 0 };
              const [isEnoughGold, gold] = await character.isEnough('inventory.gold', HERO_TENDENCY_CHANGE_COST);

              if (!isEnoughGold) {
                const message = character.t('messageNoGold', { gold });
                await updateMenu(query, message, pageParams);
                return;
              }

              if (clan) {
                await updateMenu(query, tx.templeTendencyHasClan, pageParams);
                return;
              }

              const messageParams = {
                name: heroTendencyName,
                cost: HERO_TENDENCY_CHANGE_COST
              };
              const confirmMessage = character.t('tendencyHeroChangeQuestion', messageParams);
              const successMessage = character.t('tendencyHeroChangeSuccess', messageParams);

              query.confirm({
                message: confirmMessage,
                accept: async _query => {
                  character.tendency = isDark ? 0 : 1;
                  character.inventory.gold -= HERO_TENDENCY_CHANGE_COST;

                  await character.save();
                  await updateMenu(_query, successMessage, pageParams);
                }
              });
            }
          }
        ]
      }
    ];

    if (isClanChief) {
      const clanTendencyName = clan.isDark ? tx.labelTendencyLight : tx.labelTendencyDark;
      const clanTendencyValue = clan.isDark ? tx.labelBlessing : tx.labelVampirism;
      const clanTendencyCost = Math.round(CLAN_TENDENCY_CHANGE_COST * clan.membersMax);
      const clanTendencyBuilding = tx[`building.title.altar.${clan.isDark ? '0' : '1'}`];
      const clanTendencyMessage = character.t('templeClanTendencyMessage', {
        cost: clanTendencyCost,
        name: clanTendencyName,
        value: clanTendencyValue,
        building: clanTendencyBuilding,
        membersMax: clan.membersMax
      });

      templeMenuItems.push({
        message: clanTendencyMessage,
        menu: [
          {
            text: tx.templeTendencyChange,
            callback: async query => {
              const pageParams = { page: 1 };

              if (!isClanChief) {
                await updateMenu(query, tx.templeTendencyNotChief, pageParams);
                return;
              }

              const isEnoughGold = await clan.isEnough('inventory.gold', clanTendencyCost);

              if (!isEnoughGold) {
                const message = character.t('messageClanNoGold', {
                  gold: clan.inventory.gold
                });
                await updateMenu(query, message, pageParams);
                return;
              }

              const messageParams = {
                name: clanTendencyName,
                cost: clanTendencyCost
              };
              const confirmMessage = character.t('tendencyClanChangeQuestion', messageParams);
              const successMessage = character.t('tendencyClanChangeSuccess', messageParams);

              query.confirm({
                message: confirmMessage,
                accept: async _query => {
                  await clan.changeTendency();
                  await updateMenu(_query, successMessage, pageParams);
                }
              });
            }
          }
        ]
      });
    }

    return {
      layout: [1, 2],
      infinite: true,
      items: templeMenuItems
    };
  }

  async sendTempleMenu($) {
    const { userId } = $;
    const templeMenu = await this.getTempleMenu(userId);

    await $.sendPhoto($.files.vampire, { caption: '' });
    await $.runPaginatedMenu(templeMenu);
  }
}

module.exports = TempleController;
