const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const ChroniclesManager = require('bot/managers/ChroniclesManager');
const CharacterModel = require('models/character');
const ClanMemberModel = require('models/clan_member');
const ClanInvitationModel = require('models/clan_invitation');

class ClanController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onClan: 'onClan',
      onClanEdit: 'onClanEdit',
      onClanLeave: 'onClanLeave',
      onClanDelete: 'onClanDelete',
      onClanMembers: 'onClanMembers',
      onClanApplicants: 'onClanApplicants'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'clan',
      populate: {
        path: 'chief members council invitations',
        populate: {
          path: 'character'
        }
      }
    });
  }

  loadApplicants(clanId) {
    return ClanMemberModel.find({ pending: true, clan: clanId }).populate({
      path: 'character'
    });
  }

  async onClan($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);

    if (character && character.clan) {
      this.sendClanMenu($, character);
    } else {
      this.sendClanEmptyMenu($, character);
    }
  }

  async onClanDelete($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    MenuHelper.sendConfirmMenu(
      $,
      tx,
      tx.clanDisbandQuestion,
      async () => {
        await character.clan.remove();
        MenuHelper.sendMainMenu($, tx, {
          message: tx.clanDisbandSuccess
        });
      },
      () => {
        const clanMenu = this.renderClanMenu($, character);
        $.runMenu(clanMenu);
      }
    );
  }

  async onClanLeave($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    MenuHelper.sendConfirmMenu(
      $,
      tx,
      tx.clanLeaveQuestion,
      async $ => {
        const member = character.getClanMember();
        await member.remove();

        const leaveReport = {
          key: 'clanMemberLeft',
          params: {
            name: character.renderTag()
          }
        };

        character.clan.notifyCouncil([leaveReport]);

        ChroniclesManager.clanMemberLeft(character.clan, character);

        MenuHelper.sendMainMenu($, tx, {
          message: tx.clanLeaveSuccess
        });
      },
      $ => {
        const clanMenu = this.renderClanMenu($, character);
        $.runMenu(clanMenu);
      }
    );
  }

  async onClanEdit($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const isChief = character.isClanChief();

    if (isChief) {
      const messageText = $.message.text;

      if (messageText === '/setchat' || messageText === '/editchat') {
        const clanChatForm = {
          link: {
            q: tx.clanChatFormQuestion,
            error: tx.clanChatFormError,
            keyboard: [tx.labelCancel],
            validator: (message, callback) => {
              if (message.text && message.text === tx.labelCancel) {
                this.sendClanMenu($, character);
                return;
              }
              callback(true, message.text);
            }
          }
        };

        $.runForm(clanChatForm, formData => {
          character.clan.links.chat = formData.link;
          character.clan.save(() => {
            this.sendClanMenu($, character);
          });
        });

        return;
      }

      if (messageText === '/deletechat') {
        character.clan.links.chat = null;
        character.clan.save(() => {
          this.sendClanMenu($, character);
        });
      }
    } else {
      $.sendMessage(tx.clanEditFail);
    }
  }

  async onClanApplicants($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const applicants = await this.loadApplicants(character.clan.id);

    const tx = character.getPhrases();

    if (applicants && applicants.length > 0) {
      return $.runPaginatedMenu({
        layout: 2,
        infinite: true,
        items: this.renderApplicantsMenuItems(character, applicants)
      });
    }

    return this.sendClanMenu($, character, tx.clanNoApplicants);
  }

  async onClanMembers($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    const activeMembers = character.clan.getActiveMembers();
    const sortedMembers = activeMembers.sort(
      (m1, m2) => m2.character.stats.rating - m1.character.stats.rating
    );
    const membersList = sortedMembers.reduce((list, member, index) => {
      const { rating } = member.character.stats;
      const memberTag = member.renderTag({ hideInfo: true });
      return list + `<b>${index + 1}</b> – ${memberTag} <b>(${rating})</b>\n`;
    }, `${tx.clanMembersRatingTitle}\n\n`);

    $.sendMessage(membersList);
  }

  sendClanEmptyMenu($, character, customMessage) {
    const tx = character.getPhrases();

    ClanMemberModel.findOne({ character: character.id })
      .populate('clan')
      .exec((err, member) => {
        const isPendingMember = member && member.pending;
        const menuMessage = isPendingMember
          ? `<b>${tx.labelClan}</b>\n\n<b>${member.clan.icon} ${
              member.clan.name
            }</b> — ${tx.clanMemberPending}`
          : `<b>${tx.labelClan}</b>\n\n${tx.clanMemberEmpty}`;

        const clanEmptyMenu = {
          layout: 1,
          resizeKeyboard: true,
          message: customMessage || menuMessage,
          [tx.labelClanMyInvites]: $ => {
            ClanInvitationModel.find({ character: character.id })
              .populate({
                path: 'clan',
                populate: {
                  path: 'chief',
                  populate: {
                    path: 'character'
                  }
                }
              })
              .exec((err, invitations) => {
                if (invitations && invitations.length > 0) {
                  const menuMessages = [];

                  $.runMenu({
                    ...clanEmptyMenu,
                    ...cancelMenu,
                    message: tx.clanMyInvitesListMessage
                  });

                  invitations.forEach(invitation => {
                    const clanTag = invitation.clan.renderTag();
                    const clanDetails = invitation.clan.renderDetails(tx);
                    const characterTag = character.renderTag({
                      hideInfo: true
                    });

                    const invitationMenu = {
                      layout: 2,
                      method: 'sendMessage',
                      message: clanDetails,
                      menu: [
                        {
                          text: tx.labelAcceptMyInvite,
                          callback: query => {
                            const confirmMessage = character.t(
                              'clanMyInviteAcceptQuestion',
                              { name: clanTag }
                            );

                            query.confirm({
                              message: confirmMessage,
                              acceptAnswer: tx.clanMyInviteAccepted,
                              accept: () => {
                                $.deleteMessages(menuMessages);
                                invitation.accept(member, err => {
                                  if (!err) {
                                    invitation.clan.notifyCouncil([
                                      {
                                        key: 'clanHeroInviteAccepted',
                                        params: {
                                          name: characterTag
                                        }
                                      }
                                    ]);

                                    ChroniclesManager.clanMemberJoined(
                                      invitation.clan,
                                      character
                                    );
                                  }

                                  return this.onClan($);
                                });
                              }
                            });
                          }
                        },
                        {
                          text: tx.labelDeleteMyInvite,
                          callback: query => {
                            query.confirm({
                              message: tx.clanMyInviteDeclineQuestion,
                              acceptDelete: true,
                              acceptAnswer: tx.clanMyInviteDeclined,
                              accept: () => {
                                invitation.remove(err => {
                                  if (!err) {
                                    invitation.clan.notifyCouncil([
                                      {
                                        key: 'clanHeroInviteDeclined',
                                        params: {
                                          name: character.renderTag({
                                            hideInfo: true
                                          })
                                        }
                                      }
                                    ]);
                                  }
                                });
                              }
                            });
                          }
                        }
                      ]
                    };

                    $.runInlineMenu(invitationMenu).then(message => {
                      menuMessages.push(message);
                    });
                  });
                } else {
                  $.runMenu(
                    Object.assign(clanEmptyMenu, cancelMenu, {
                      message: tx.clanMyInvitesEmptyMessage
                    })
                  );
                }
              });
          }
        };

        const cancelMenu = {
          [tx.labelBack]: $ => {
            MenuHelper.sendMainMenu($, tx, {
              message: tx.mainMenuShortMessage
            });
          }
        };

        const recallOption = {
          [tx.labelClanMemberRecall]: $ => {
            member.remove((err, removed) => {
              if (removed) {
                MenuHelper.sendMainMenu($, tx, {
                  message: tx.clanRecallSuccess
                });
              }
            });
          }
        };

        if (isPendingMember) {
          $.runMenu({
            ...clanEmptyMenu,
            ...recallOption,
            ...cancelMenu
          });
        } else {
          $.runMenu({
            ...clanEmptyMenu,
            ...cancelMenu
          });
        }
      });
  }

  sendClanMenu($, character, customMessage) {
    const tx = character.getPhrases();

    const clanMenu = this.renderClanMenu($, character, customMessage);

    if (clanMenu) {
      return $.runMenu(clanMenu);
    }

    return MenuHelper.sendMainMenu($, tx, {
      message: tx.otherwiseMessage
    });
  }

  renderClanMenu($, character, customMessage) {
    const tx = character.getPhrases();
    const {
      chief,
      icon,
      castleIcon,
      name,
      links,
      rating,
      membersMax,
      inventory,
      buildings,
      level,
      experience,
      experienceMax
    } = character.clan;

    const isChief = character.isClanChief();
    const isCouncil = character.isClanCouncil();

    const clanChatEmpty = isChief ? tx.clanChatSet : '[-]';
    const clanChatExists = isChief
      ? `${links.chat}\n\n${tx.clanChatEdit}`
      : links.chat;
    const clanChatInfo = links && links.chat ? clanChatExists : clanChatEmpty;

    const chiefTag = chief && chief.renderTag();
    const councilTag = character.clan.renderCouncilTag();
    const tendencyTag = character.clan.renderTendencyTag(tx);
    const membersCount = character.clan.getMembersCount();

    let clanDetails = `${icon} ${name}🎖${level}\n\n<b>${
      tx.labelClanLevel
    }:</b> ${level}\n<b>${castleIcon} ${tx.labelClanCastleLevel}:</b> ${
      buildings.castle.level
    }\n<b>${tx.labelClanExperience}:</b> ${experience} / ${experienceMax}\n<b>${
      tx.labelClanRating
    }:</b> ${rating}\n<b>${tx.labelClanTendency}:</b> ${tendencyTag}\n<b>${
      tx.labelClanGold
    }:</b> ${inventory.gold}\n<b>${tx.labelClanMembers}:</b> ${
      membersCount.total
    } / ${membersMax}\n<b>${tx.labelClanChief}:</b> ${chiefTag}\n<b>${
      tx.labelClanCouncil
    }:</b> ${councilTag}\n<b>${tx.labelClanChat}:</b> ${clanChatInfo}`;

    if (membersCount.pending > 0) {
      clanDetails += `\n\n<b>${tx.labelClanNewApplicants}:</b> ${
        membersCount.pending
      }`;
    }

    const clanMenu = {
      layout: 2,
      resizeKeyboard: true,
      message: customMessage || clanDetails,
      [tx.labelClanMembersList]: $ => {
        $.emulateUpdate();
      },
      [`${castleIcon} ${tx.labelClanCastle}`]: $ => {
        $.emulateUpdate();
      }
    };

    const clanManageOptions = {
      [tx.labelClanApplicants]: $ => {
        $.emulateUpdate();
      },
      [tx.labelClanInvites]: $ => {
        $.emulateUpdate();
      },
      [tx.labelClanMembersManage]: $ => {
        $.emulateUpdate();
      }
    };

    const clanDisbandOption = {
      [tx.labelClanDisband]: $ => {
        $.emulateUpdate();
      }
    };

    const clanMemberOptions = {
      [tx.labelClanLeave]: $ => {
        $.emulateUpdate();
      }
    };

    const cancelMenu = {
      [tx.labelBack]: $ => {
        MenuHelper.sendMainMenu($, tx, {
          message: tx.heroMenuShortMessage
        });
      }
    };

    if (isChief) {
      return {
        ...clanMenu,
        ...clanManageOptions,
        ...clanDisbandOption,
        ...cancelMenu
      };
    }

    if (isCouncil) {
      return {
        ...clanMenu,
        ...clanManageOptions,
        ...clanMemberOptions,
        ...cancelMenu
      };
    }

    return {
      ...clanMenu,
      ...clanMemberOptions,
      ...cancelMenu
    };
  }

  renderApplicantsMenuItems(character, members) {
    const tx = character.getPhrases();

    let membersMenuItems = [];

    const filterMenu = (query, member) => {
      membersMenuItems = membersMenuItems.filter(
        item => !member._id.equals(item.id)
      );

      if (membersMenuItems.length > 0) {
        query.updatePaginated({
          layout: 2,
          items: membersMenuItems
        });
      } else {
        query.sendMessage(tx.clanNoApplicants);
        query.delete();
      }
    };

    membersMenuItems = members.map((member, index) => {
      const memberNumber = index + 1;
      const memberDetails = member.renderStats(tx);

      return {
        id: member.id,
        message: `<b>${memberNumber}.</b> ${memberDetails}`,
        menu: [
          {
            text: tx.labelClanMemberApprove,
            callback: query => {
              const characterTag = member.renderTag({ hideInfo: true });
              const confirmMessage = character.t(
                'clanApplicantApproveQuestion',
                { characterTag }
              );
              const successMessage = character.t(
                'clanApplicantApproveSuccess',
                { characterTag }
              );

              query.confirm({
                message: confirmMessage,
                acceptAnswer: successMessage,
                accept: () => {
                  member.character.clan = character.clan.id;
                  member.character.tendency = character.clan.tendency;
                  member.pending = false;
                  member.save(err => {
                    if (!err) {
                      filterMenu(query, member);

                      member.character.save(err => {
                        if (!err) {
                          const clanTag = character.clan.renderTag();
                          const clanChat =
                            character.clan.links && character.clan.links.chat;

                          if (clanChat) {
                            member.character.notify('clanMemberApproveChat', {
                              clanTag,
                              clanChat
                            });
                          } else {
                            member.character.notify('clanMemberApprove', {
                              clanTag
                            });
                          }

                          ChroniclesManager.clanMemberJoined(
                            character.clan,
                            member.character
                          );
                        }
                      });
                    }
                  });
                }
              });
            }
          },
          {
            text: tx.labelClanMemberDecline,
            callback: query => {
              const characterTag = member.renderTag({ hideInfo: true });
              const confirmMessage = character.t(
                'clanApplicantDeclineQuestion',
                { characterTag }
              );
              const successMessage = character.t(
                'clanApplicantDeclineSuccess',
                { characterTag }
              );

              query.confirm({
                message: confirmMessage,
                acceptAnswer: successMessage,
                accept: query => {
                  member.remove(err => {
                    if (!err) {
                      filterMenu(query, member);

                      const clanTag = character.clan.renderTag();
                      member.character.notify('clanMemberDecline', { clanTag });
                    }
                  });
                }
              });
            }
          }
        ]
      };
    });

    return membersMenuItems;
  }
}

module.exports = ClanController;
