const Telegram = require('bot/lib/core/Telegram');
const CharacterModel = require('models/character');
const ClanInvestmentModel = require('models/clan_investment');

class ClanInvitesController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onClanCastle: 'onClanCastle'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'clan',
      populate: {
        path:
          'buildings.castle.investments buildings.houses.investments buildings.treasury.investments buildings.armory.investments buildings.trainings.investments buildings.altar.investments buildings.couriers.investments buildings.scouts.investments',
        populate: {
          path: 'character'
        }
      }
    });
  }

  async onClanCastle($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);

    this.sendCastleMenu($, character);
  }

  sendCastleMenu($, character) {
    const castleMenu = this.renderCastleMenu(character);
    $.runInlineMenu(castleMenu);
  }

  renderCastleMenu(character) {
    const tx = character.getPhrases();
    const {
      tendency,
      buildings,
      modificators: {
        clanMinDamage,
        clanMaxDamage,
        clanDefense,
        clanChanceDodge,
        clanChanceCritical,
        clanVampirism,
        clanBlessing,
        membersBonus,
        invitationsBonus
      }
    } = character.clan;

    const buildingsData = buildings.toJSON();
    const buildingsMenu = Object.keys(buildingsData).reduce(
      (menu, name) => {
        const {
          level,
          levelMax,
          gold,
          title,
          description,
          upgradeCost,
          isUpgradeAvailable
        } = character.clan.getBuildingData(tx, name);

        const buildingCost = isUpgradeAvailable
          ? `💰(${gold}/${upgradeCost})`
          : '⛔️';
        const buildingTitle = `<b>${title} 🎖(${level}/${levelMax}) ${buildingCost}</b>`;

        let details = description;

        if (level > 0) {
          if (name === 'houses') {
            details = `+ ${membersBonus} ${tx.labelMembers}`;
          }

          if (name === 'armory') {
            details = `+ ${clanDefense} ${
              tx.labelDefense
            }, + ${clanMinDamage}-${clanMaxDamage} ${tx.labelDamage}`;
          }

          if (name === 'trainings') {
            details = `+ ${clanChanceDodge} ${
              tx.labelDodge
            }, + ${clanChanceCritical} ${tx.labelCritical}`;
          }

          if (name === 'altar') {
            details =
              tendency === 1
                ? `+ ${clanVampirism} ${tx.labelVampirism}`
                : `+ ${clanBlessing} ${tx.labelBlessing}`;
          }

          if (name === 'couriers') {
            details = `+ ${invitationsBonus} ${tx.labelInvitation}`;
          }

          if (name === 'scouts') {
            details = tx.labelScoutsAvailable;
          }

          if (name === 'castle') {
            details = character.t('labelCastleAvailable', { level });
          }
        }

        const buildingDetails = `${buildingTitle}\n<code>${details}</code>\n\n`;

        if (isUpgradeAvailable) {
          menu.buttons.push({
            text: title,
            callback: query => {
              const buildingMenu = this.renderBuildingMenu(character, name);
              query.update(buildingMenu);
            }
          });
        }

        menu.message += buildingDetails;

        return menu;
      },
      {
        message: `${tx.clanCastleMessage}\n\n`,
        buttons: []
      }
    );

    return {
      layout: 2,
      method: 'sendMessage',
      message: buildingsMenu.message,
      menu: buildingsMenu.buttons
    };
  }

  renderBuildingMenu(character, name) {
    const tx = character.getPhrases();
    const investors = character.clan.getBuildingInvestors(name);
    const building = character.clan.getBuildingData(tx, name);
    const { title, description, gold, upgradeCost, level, levelMax } = building;

    const investorsDetails = Object.keys(investors)
      .reduce((str, investor) => {
        const investedGold = investors[investor];
        return str + `${investor} - <b>💰${investedGold}</b>, `;
      }, '')
      .slice(0, -2);

    const buildingDetails = `<b>${title}</b>\n\n<code>${description}</code>\n\n<b>${
      tx.labelBuildingLevel
    }:</b> ${level} / ${levelMax}\n<b>${
      tx.labelBuildingInvested
    }:</b> ${gold} / ${upgradeCost}\n<b>${tx.labelBuildingInvestors}:</b> ${
      investorsDetails.length > 0 ? investorsDetails : '[-]'
    }`;

    const buildingMenu = {
      layout: 1,
      method: 'sendMessage',
      message: buildingDetails,
      menu: [
        {
          text: tx.labelInvestUpgrade,
          callback: query => {
            const investMenu = this.renderInvestMenu(
              character,
              building,
              buildingMenu
            );
            query.update(investMenu);
          }
        },
        {
          text: tx.labelBack,
          callback: query => {
            const castleMenu = this.renderCastleMenu(character);
            query.update(castleMenu);
          }
        }
      ]
    };

    return buildingMenu;
  }

  renderInvestMenu(character, building, prevMenu) {
    const tx = character.getPhrases();
    const { title, name, level, upgradeCost, gold } = building;

    const investMax = Math.round(upgradeCost - gold);
    const investValues = [100, 150, 250, 500, 750, 1000, 1500, 2000, 5000];

    if (!investValues.includes(investMax)) {
      investValues.push(investMax);
    }

    const renderOption = value => ({
      text: `💰 ${value}`,
      callback: query => {
        if (character.inventory.gold < value) {
          const answerMessage = character.t('investBuildingNoGold', {
            gold: character.inventory.gold
          });
          query.answer(answerMessage);
        } else {
          const confirmMessage = character.t('investBuildingQuestion', {
            value
          });
          query.confirm({
            message: confirmMessage,
            accept: () => {
              this.loadCharacter(character.userId).then(_character => {
                const _building = _character.clan.getBuildingData(tx, name);

                if (_building.level > level || _building.gold !== gold) {
                  const answerMessage = _character.t(
                    'investBuildingLevelChanged'
                  );
                  const castleMenu = this.renderCastleMenu(_character);

                  query.answer(answerMessage);
                  query.update(castleMenu);
                } else {
                  ClanInvestmentModel.create(
                    {
                      clan: _character.clan.id,
                      userId: _character.userId,
                      character: _character.id,
                      investedGold: value
                    },
                    (err, investment) => {
                      if (!err) {
                        _character.inventory.gold -= Number(
                          investment.investedGold
                        );
                        _character.clan.buildings[name].gold += Number(
                          investment.investedGold
                        );
                        _character.clan.buildings[name].investments.push(
                          investment.id
                        );

                        _character.clan.save(err => {
                          if (!err) {
                            _character.save(err => {
                              if (!err) {
                                _character.populate(
                                  {
                                    path: 'clan',
                                    populate: {
                                      path:
                                        'chief members council buildings.castle.investments buildings.houses.investments buildings.treasury.investments buildings.armory.investments buildings.trainings.investments buildings.altar.investments buildings.couriers.investments buildings.scouts.investments',
                                      populate: {
                                        path: 'character'
                                      }
                                    }
                                  },
                                  (err, populated) => {
                                    if (!err) {
                                      const answerMessage = populated.t(
                                        'investBuildingSuccess',
                                        { value }
                                      );
                                      const castleMenu = this.renderCastleMenu(
                                        populated
                                      );

                                      query.answer(answerMessage);
                                      query.update(castleMenu);

                                      try {
                                        if (
                                          !populated.isClanChief() &&
                                          !populated.isClanCouncil()
                                        ) {
                                          populated.clan.notifyCouncil([
                                            {
                                              key: 'investCouncilReport',
                                              params: {
                                                name: populated.renderTag(),
                                                gold: value,
                                                title: title
                                              }
                                            }
                                          ]);
                                        }
                                      } catch (e) {
                                        console.error(e);
                                      }
                                    }
                                  }
                                );
                              }
                            });
                          }
                        });
                      }
                    }
                  );
                }
              });
            }
          });
        }
      }
    });

    const investOptions = investValues
      .filter(value => value <= investMax)
      .map(renderOption);

    const backOption = {
      text: tx.labelBack,
      callback: query => {
        query.update(prevMenu);
      }
    };

    const investMessage = character.t('investBuildingMenuMessage', { title });
    return {
      layout: 2,
      method: 'sendMessage',
      message: investMessage,
      menu: [...investOptions, backOption]
    };
  }
}

module.exports = ClanInvitesController;
