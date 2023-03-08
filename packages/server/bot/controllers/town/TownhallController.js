const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const ClanModel = require('models/clan');
const ClanMemberModel = require('models/clan_member');
const CharacterModel = require('models/character');
const { CLAN_REGISTRATION_COST } = require('data/settings');
const { emojiRegex } = require('data/regex');
const { isValidClanName } = require('bot/helpers/clan');

class TownhallController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onTownhall: 'sendTownhallMenu'
    };
  }

  sendTownhallMenu($, customMessage) {
    const userId = $.message.from.id;

    CharacterModel.findOne({ userId }).then(character => {
      const tx = character.getPhrases();
      const townhallMenuMessage = character.t('townhallMenuMessage', {
        cost: CLAN_REGISTRATION_COST
      });

      const townhallMenu = {
        layout: 1,
        resizeKeyboard: true,
        message: customMessage || townhallMenuMessage,
        options: {
          parse_mode: 'html',
          disable_web_page_preview: true
        },
        [tx.labelJoinClan]: $ => {
          ClanMemberModel.findOne({ character: character.id }).then(member => {
            if (member) {
              $.runMenu({
                ...townhallMenu,
                message: tx.clanMemberAlready
              });
            } else {
              this.sendJoinClanMenu($, character);
            }
          });
        },
        [tx.labelRegisterClan]: $ => {
          if (character.inventory.gold >= CLAN_REGISTRATION_COST) {
            ClanMemberModel.findOne({ character: character.id }).then(
              member => {
                if (member) {
                  $.runMenu({
                    ...townhallMenu,
                    message: tx.clanMemberAlready
                  });
                } else {
                  const confirmMessage = character.t(
                    'clanCreateConfirmMessage',
                    {
                      cost: CLAN_REGISTRATION_COST,
                      gold: character.inventory.gold
                    }
                  );
                  MenuHelper.sendConfirmMenu(
                    $,
                    tx,
                    confirmMessage,
                    $ => this.sendCreateClanMenu($, character),
                    $ => $.runMenu(townhallMenu)
                  );
                }
              }
            );
          } else {
            this.sendTownhallMenu($, tx.clanCreateNotEnoughGold);
          }
        },
        [tx.labelBack]: $ => {
          MenuHelper.sendTownMenu($, tx, {
            message: tx.townMenuBackMessage
          });
        },
        anyMatch: $ => {
          $.runMenu(townhallMenu);
        }
      };

      $.runMenu(townhallMenu);
    });
  }

  sendJoinClanMenu($, character, customMessage) {
    const tx = character.getPhrases();
    const joinClanMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: customMessage || tx.joinClanMenuMessage,
      options: {
        parse_mode: 'html'
      },
      [tx.labelClanList]: $ => {
        this.sendClanList($, character);
      },
      [tx.labelClanFind]: $ => {
        $.runForm(
          {
            name: {
              q: tx.clanSearchFormQuestion,
              error: tx.clanSearchFormError,
              keyboard: [tx.labelCancel],
              validator: (message, callback) => {
                if (message.text && message.text === tx.labelCancel) {
                  this.sendTownhallMenu($);
                  return;
                }
                if (message.text && /^[a-zA-Zа-яА-Я0-9]+$/.test(message.text)) {
                  callback(true, message.text);
                  return;
                }
                callback(false);
              }
            }
          },
          formData => {
            this.sendClanList($, character, {
              name: formData.name
            });
          }
        );
      },
      [tx.labelBack]: $ => {
        this.sendTownhallMenu($);
      },
      anyMatch: $ => {
        $.runMenu(joinClanMenu);
      }
    };

    $.runMenu(joinClanMenu);
  }

  sendClanList($, character, findParams = {}) {
    const tx = character.getPhrases();

    const findQuery = { ...findParams, banned: false, pending: false };
    const sortQuery = { level: -1, rating: -1 };

    ClanModel.find(findQuery)
      .sort(sortQuery)
      .limit(50)
      .populate({
        path: 'chief members',
        populate: {
          path: 'character'
        }
      })
      .exec((err, clans) => {
        const filteredClans = clans.filter(
          clan => clan.members.length < clan.membersMax
        );

        if (filteredClans && filteredClans.length > 0) {
          const clanListMenuItems = filteredClans.map(clan => ({
            message: clan.renderDetails(tx),
            menu: [
              {
                text: tx.labelClanMemberApply,
                callback: query => {
                  const clanTag = clan.renderTag();
                  const characterTag = character.renderTag();
                  const confirmMessage = character.t('clanApplyQuestion', {
                    clanTag
                  });
                  const successMessage = character.t('clanApplySuccess', {
                    clanTag
                  });

                  query.confirm({
                    message: confirmMessage,
                    acceptDelete: true,
                    accept: () => {
                      ClanMemberModel.create(
                        {
                          clan: clan.id,
                          character: character.id,
                          pending: true
                        },
                        err => {
                          if (!err) {
                            this.sendTownhallMenu($, successMessage);
                            clan.notifyCouncil([
                              {
                                key: 'clanMemberApply',
                                params: {
                                  characterTag
                                }
                              }
                            ]);
                          }
                        }
                      );
                    }
                  });
                }
              }
            ]
          }));

          $.runPaginatedMenu({
            layout: [1, 2],
            infinite: true,
            items: clanListMenuItems
          });
        } else {
          $.sendMessage(tx.townhallNoClansMessage);
        }
      });
  }

  sendCreateClanMenu($, character) {
    const tx = character.getPhrases();
    const clanForm = {
      name: {
        q: tx.clanCreateFormName,
        error: tx.clanCreateFormError,
        keyboard: [tx.labelCancel],
        validator: ({ text }, callback) => {
          if (text && text === tx.labelCancel) {
            return this.sendJoinClanMenu($, character);
          }
          if (isValidClanName(text)) {
            return callback(true, text);
          }
          return callback(false);
        }
      },
      icon: {
        q: tx.clanCreateFormIcon,
        error: tx.clanCreateFormError,
        keyboard: [tx.labelCancel],
        validator: (message, callback) => {
          if (message.text && message.text === tx.labelCancel) {
            return this.sendJoinClanMenu($, character);
          }

          if (
            emojiRegex.exec(message.text) &&
            message.text &&
            message.text.length <= 4
          ) {
            return callback(true, message.text);
          }
          return callback(false);
        }
      }
    };

    const createClan = clanData => {
      const clan = new ClanModel({
        chief: character.id,
        name: clanData.name,
        icon: clanData.icon,
        tendency: clanData.tendency,
        members: [],
        council: []
      });

      const member = new ClanMemberModel({
        clan: clan.id,
        character: character.id,
        pending: false
      });

      clan.council.push(member.id);
      clan.save(err => {
        if (!err) {
          member.save();

          character.clan = clan.id;
          character.tendency = clan.tendency;
          character.inventory.gold -= CLAN_REGISTRATION_COST;
          character.save(err => {
            if (!err) {
              MenuHelper.sendTownMenu($, tx, {
                message: tx.clanCreateSuccess
              });
            }
          });
        }
      });
    };

    $.runForm(clanForm, formData => {
      const tendencyMenu = {
        layout: [2, 1],
        resizeKeyboard: true,
        message: tx.clanCreateFormTendency,
        options: {
          parse_mode: 'html',
          disable_web_page_preview: true
        },
        [tx.labelTendencyLight]: $ => {
          formData.tendency = 0;
          createClan(formData);
        },
        [tx.labelTendencyDark]: $ => {
          formData.tendency = 1;
          createClan(formData);
        },
        [tx.labelCancel]: $ => {
          this.sendJoinClanMenu($, character);
        },
        anyMatch: $ => {
          $.runMenu(tendencyMenu);
        }
      };
      $.runMenu(tendencyMenu);
    });
  }
}

module.exports = TownhallController;
