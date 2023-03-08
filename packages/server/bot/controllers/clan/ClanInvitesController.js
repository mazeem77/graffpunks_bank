const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const ClanInvitationModel = require('models/clan_invitation');
const CharacterModel = require('models/character');
const { isValidName } = require('bot/helpers/character');
const { omit, sampleSize } = require('lodash');

class ClanInvitesController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onClanInvites: 'onClanInvites'
    };
  }

  onClanInvites($) {
    const userId = $.message.from.id;

    CharacterModel.findOne({ userId })
      .populate({
        path: 'clan',
        populate: {
          path: 'chief members council invitations',
          populate: {
            path: 'character'
          }
        }
      })
      .exec((err, character) => {
        if (character && character.clan) {
          this.sendClanInvitesMenu($, character);
        }
      });
  }

  sendClanInvitesMenu($, character, customMessage) {
    const tx = character.getPhrases();
    const {
      inventory,
      invitations,
      invitationsCount,
      invitationsMax,
      members,
      membersMax,
      scoutsCount,
      scoutsCost
    } = character.clan;

    const membersCount = members.length;
    const menuMessage = character.t('clanInvitesMessage', {
      invitationsCount,
      invitationsMax
    });

    let clanInvitesMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: customMessage || menuMessage,
      [tx.labelClanInviteName]: $ => {
        const heroSearchForm = {
          name: {
            q: tx.heroSearchFormQuestion,
            error: tx.heroSearchFormError,
            keyboard: [tx.labelCancel],
            validator: ({ text }, callback) => {
              if (text && text === tx.labelCancel) {
                return this.sendClanInvitesMenu($, character);
              }

              if (isValidName(text)) {
                return callback(true, text);
              }

              return callback(false);
            }
          }
        };

        $.runForm(heroSearchForm, formData => {
          this.getInviteCandidates(invitations, {
            $or: [
              { customName: formData.name },
              { username: formData.name },
              { firstName: formData.name }
            ]
          })
            .then(candidates => {
              this.sendCandidatesMenu($, character, candidates);
            })
            .catch(() => {
              this.sendClanInvitesMenu($, character, tx.heroSearchFail);
            });
        });
      },
      [tx.labelClanInviteScout]: $ => {
        if (scoutsCount > 0) {
          MenuHelper.sendConfirmMenu(
            $,
            tx,
            tx.heroScoutConfirmQuestion,
            $ => {
              if (inventory.gold >= scoutsCost) {
                this.getInviteCandidates(invitations, {
                  'stats.rating': { $gt: 10 }
                })
                  .then(candidates => {
                    const candidatesSample = sampleSize(candidates, 10);
                    this.sendCandidatesMenu($, character, candidatesSample);
                  })
                  .catch(() => {
                    this.sendClanInvitesMenu($, character, tx.heroSearchFail);
                  });
              } else {
                this.sendClanInvitesMenu($, character, tx.clanNotEnoughGold);
              }
            },
            $ => {
              $.runMenu(clanInvitesMenu);
            }
          );
        } else {
          this.sendClanInvitesMenu($, character, tx.clanInvitesNoScouts);
        }
      },
      [tx.labelClanInviteList]: $ => {
        this.sendClanInvites($, character);
      },
      [tx.labelBack]: $ => {
        $.emulateCommand(tx.labelClan);
      },
      anyMatch: $ => {
        $.runMenu(clanInvitesMenu);
      }
    };

    if (invitationsCount >= invitationsMax || membersCount >= membersMax) {
      clanInvitesMenu = omit(clanInvitesMenu, [
        tx.labelClanInviteName,
        tx.labelClanInviteScout
      ]);

      if (invitationsCount >= invitationsMax) {
        clanInvitesMenu.message += `\n\n${tx.clanInviteInvitationsLimit}`;
      }

      if (membersCount >= membersMax) {
        clanInvitesMenu.message += `\n\n${tx.clanInviteMembersLimit}`;
      }
    }

    return new Promise(resolve => {
      $.runMenu(clanInvitesMenu).then(resolve);
    });
  }

  getInviteCandidates(invitations, searchQuery) {
    const filterCharacterIds = invitations.reduce((ids, invitation) => {
      return [...ids, invitation.userId];
    }, []);

    const searchFinalQuery = Object.assign(searchQuery, {
      clan: null,
      userId: { $nin: filterCharacterIds }
    });

    return new Promise((resolve, reject) => {
      CharacterModel.find(searchFinalQuery)
        .sort({ 'stats.rating': -1 })
        .limit(50)
        .exec((err, candidates) => {
          if (candidates && candidates.length > 0) {
            resolve(candidates);
          } else {
            reject();
          }
        });
    });
  }

  sendCandidatesMenu($, character, candidates) {
    const tx = character.getPhrases();
    const { id, invitationCost, inventory } = character.clan;
    const clanTag = character.clan.renderTag();
    const menuMessages = [];

    this.sendClanInvitesMenu($, character, tx.heroSearchSuccess).then(() => {
      candidates.forEach(candidate => {
        const candidateDetails = candidate.renderStats();
        const candidateTag = candidate.renderTag({ hideInfo: true });

        const candidateMenu = {
          layout: 2,
          method: 'sendMessage',
          message: candidateDetails,
          menu: [
            {
              text: `${tx.labelSendInvite}`,
              callback: query => {
                const confirmMessage = character.t(
                  'heroCourierConfirmQuestion',
                  { candidateTag, invitationCost }
                );
                const successMessage = character.t(
                  'heroCourierConfirmSuccess',
                  { candidateTag, invitationCost }
                );

                if (inventory.gold < invitationCost) {
                  query.answer(tx.clanNotEnoughGold);
                  return;
                }

                query.confirm({
                  message: confirmMessage,
                  acceptAnswer: successMessage,
                  accept: query => {
                    ClanInvitationModel.create(
                      {
                        clan: id,
                        character: candidate.id,
                        userId: candidate.userId
                      },
                      (err, invitation) => {
                        if (invitation) {
                          character.clan.invitations.push(invitation.id);
                          character.clan.inventory.gold -= invitationCost;
                          character.clan.save((err, clan) => {
                            candidate.notify('clanHeroInviteSent', {
                              name: clanTag
                            });

                            if (clan.invitationsCount >= clan.invitationsMax) {
                              $.deleteMessages(menuMessages);
                              this.sendClanInvitesMenu($, character);
                            } else {
                              query.delete();
                            }
                          });
                        }
                      }
                    );
                  }
                });
              }
            }
          ]
        };

        $.runInlineMenu(candidateMenu).then(message => {
          menuMessages.push(message);
        });
      });
    });
  }

  sendClanInvites($, character) {
    const tx = character.getPhrases();

    ClanInvitationModel.find({ clan: character.clan.id })
      .populate('character')
      .exec((err, invitations) => {
        if (invitations && invitations.length > 0) {
          this.sendClanInvitesMenu(
            $,
            character,
            tx.clanInvitesListMessage
          ).then(() => {
            invitations.forEach(invitation => {
              const candidateDetails = invitation.character.renderStats(tx);

              $.runInlineMenu({
                layout: 2,
                method: 'sendMessage',
                message: candidateDetails,
                menu: [
                  {
                    text: `${tx.labelDeleteInvite}`,
                    callback: query => {
                      query.confirm({
                        message: tx.clanInviteDeleteQuestion,
                        acceptAnswer: tx.clanInviteDeleteSuccess,
                        acceptDelete: true,
                        accept: () => {
                          invitation.remove();
                        }
                      });
                    }
                  }
                ]
              });
            });
          });
        } else {
          this.sendClanInvitesMenu($, character, tx.clanInvitesListEmpty);
        }
      });
  }
}

module.exports = ClanInvitesController;
