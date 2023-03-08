const Telegram = require('bot/lib/core/Telegram');
const ClanModel = require('models/clan');
const ClanMemberModel = require('models/clan_member');
const CharacterModel = require('models/character');
const ChroniclesManager = require('bot/managers/ChroniclesManager');
const { CLAN_MEMBER_PAYOUT_GOLD_MIN } = require('data/settings');

class ClanMembersController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onClanMembers: 'onClanMembers'
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

  loadMembers(clanId) {
    const findQuery = { pending: false, clan: clanId };

    return ClanMemberModel.find(findQuery).populate({ path: 'character clan' });
  }

  async onClanMembers($) {
    const { userId } = $;
    const clearMenu = () => $.emulateCommand('/clan');

    const character = await this.loadCharacter(userId);
    const membersMenu = await this.renderMembersMenu(character, clearMenu);

    return $.runInlineMenu(membersMenu);
  }

  async renderMembersMenu(character, clearMenu) {
    const clanId = character.clan.id;
    const tx = character.getPhrases();
    const isChief = character.isClanChief();

    const members = await this.loadMembers(clanId);

    let membersMenuItems = [];

    const filterMenu = (query, member) => {
      membersMenuItems = membersMenuItems.filter(
        _member => !member._id.equals(_member.id)
      );

      if (membersMenuItems.length > 0) {
        query.update({
          layout: 1,
          message: tx.clanMembersManageTitle,
          menu: membersMenuItems
        });
      } else {
        query.delete();
      }
    };

    const renderMemberMenu = (member, number) => {
      const isMemberInCouncil = character.clan.isCouncilMember(member.id);
      const isMemberChief = character.clan.isChiefMember(member.character.id);

      const memberTag = member.renderTag({ hideInfo: true });
      const memberDetails = member.renderStats(tx);

      const memberMenu = {
        layout: 1,
        message: `<b>${number}.</b> ${memberDetails}`,
        menu: []
      };

      memberMenu.menu.push({
        text: tx.labelClanMemberPayout,
        callback: async query => {
          const clan = await ClanModel.findById(clanId, 'inventory').exec();
          const clanGold = clan.inventory.gold;
          const payoutValues = [5, 25, 50, 100, 200, 300, 400, 500, 750, 1000];

          character.clan.inventory.gold = clanGold;

          const payoutInfo =
            clanGold < CLAN_MEMBER_PAYOUT_GOLD_MIN
              ? character.t('payoutMinInfo', {
                  minPayout: CLAN_MEMBER_PAYOUT_GOLD_MIN
                })
              : '';

          const payoutMessage = character.t('payoutMenuMessage', {
            memberTag,
            clanGold,
            payoutInfo
          });

          const payoutOptions = payoutValues
            .filter(value => value <= clanGold)
            .map(value => ({
              text: `💰 ${value}`,
              callback: query => {
                query.confirm({
                  message: character.t('clanMemberPayoutQuestion', {
                    value,
                    memberTag
                  }),
                  accept: async () => {
                    const isEnoughGold = await clan.isEnoughGold(value);

                    if (isEnoughGold) {
                      clan.inventory.gold -= value;
                      member.character.inventory.gold += value;

                      await clan.save();
                      await member.character.save();

                      const counselorTag = character.renderTag();

                      member.character.notify('clanMemberPayoutReport', {
                        value
                      });

                      character.clan.notifyCouncil([
                        {
                          key: 'clanMemberPayoutCouncil',
                          params: {
                            value,
                            memberTag,
                            counselorTag
                          }
                        }
                      ]);

                      const successMessage = character.t(
                        'clanMemberPayoutSuccess',
                        {
                          value,
                          memberTag
                        }
                      );

                      return query.update(
                        renderMemberMenu(member, number),
                        successMessage
                      );
                    }

                    return query.prevMenu(tx.clanMemberPayoutNoGold);
                  }
                });
              }
            }));

          const payoutMenu = {
            layout: 2,
            method: 'sendMessage',
            message: payoutMessage,
            menu: [
              ...payoutOptions,
              {
                text: tx.labelBack,
                callback: query =>
                  query.update(renderMemberMenu(member, number))
              }
            ]
          };

          query.update(payoutMenu);
        }
      });

      if (!isMemberChief) {
        memberMenu.menu.push({
          text: tx.labelClanMemberRemove,
          callback: query => {
            query.confirm({
              message: character.t('clanMemberRemoveQuestion', {
                name: memberTag
              }),
              accept: async _query => {
                await member.remove();

                member.character.notify('clanMemberRemove');
                _query.answer(
                  character.t('clanMemberRemoveSuccess', {
                    name: memberTag
                  })
                );

                ChroniclesManager.clanMemberLeft(
                  character.clan,
                  member.character
                );

                filterMenu(query, member);
              }
            });
          }
        });
      }

      if (isChief && !isMemberChief) {
        memberMenu.menu.push({
          text: tx.labelClanMemberTransfer,
          callback: query => {
            const confirmMessage = character.t('clanMemberTransferQuestion', {
              name: memberTag
            });
            const successMessage = character.t('clanMemberTransferSuccess', {
              name: memberTag
            });

            query.confirm({
              message: confirmMessage,
              acceptAnswer: successMessage,
              acceptDelete: true,
              accept: () => {
                character.clan.chief = member.character.id;
                character.clan.save(err => {
                  if (!err) {
                    member.character.notify('clanMemberTransfer');
                    clearMenu();
                  }
                });
              }
            });
          }
        });
      }

      if (!isMemberChief && isMemberInCouncil) {
        memberMenu.menu.push({
          text: tx.labelClanMemberCouncilRemove,
          callback: query => {
            const confirmMessage = character.t('clanCouncilRemoveQuestion', {
              name: memberTag
            });

            query.confirm({
              message: confirmMessage,
              acceptAnswer: tx.clanCouncilSuccess,
              accept: () => {
                character.clan.council.pull(member.id);
                character.clan.save(err => {
                  if (!err) {
                    member.character.notify('clanMemberRemoveCouncil');
                    query.update(renderMemberMenu(member, number));
                  }
                });
              }
            });
          }
        });
      }

      if (!isMemberChief && !isMemberInCouncil) {
        memberMenu.menu.push({
          text: tx.labelClanMemberCouncilAdd,
          callback: query => {
            const confirmMessage = character.t('clanCouncilAddQuestion', {
              name: memberTag
            });

            query.confirm({
              message: confirmMessage,
              acceptAnswer: tx.clanCouncilSuccess,
              accept: () => {
                character.clan.council.push(member.id);
                character.clan.save(err => {
                  if (!err) {
                    member.character.notify('clanMemberAddCouncil');
                    query.update(renderMemberMenu(member, number));
                  }
                });
              }
            });
          }
        });
      }

      memberMenu.menu.push({
        text: tx.labelBack,
        callback: async query => {
          const indexMenu = await this.renderMembersMenu(character, clearMenu);
          query.update(indexMenu);
        }
      });

      return memberMenu;
    };

    membersMenuItems = members.map((member, index) => {
      const memberNumber = index + 1;
      const memberTag = member.renderTag({ hideInfo: true });
      const memberRole = member.getRoleData();
      const memberIcon = memberRole ? memberRole.icon : '';

      return {
        id: member.id,
        text: `[${memberNumber}] ${memberTag} ${memberIcon}`,
        callback: query => {
          const memberMenu = renderMemberMenu(member, memberNumber);
          query.update(memberMenu);
        }
      };
    });

    return {
      layout: 1,
      limit: 10,
      message: tx.clanMembersManageTitle,
      menu: membersMenuItems
    };
  }
}

module.exports = ClanMembersController;
