const GamesManager = require('bot/managers/GamesManager');
const FightController = require('./FightController');

class TeamsFightController extends FightController {
  constructor(...args) {
    super(...args);

    this.isPending = false;
  }

  search() {
    GamesManager.playerSearchGroupGame(this);
  }

  onGameEmpty() {
    const emptyMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: this.t('teamFightEmptyMessage'),
      [this.t('labelFightCreate')]: () => {
        this.isPending = true;
        this.teamId = 't1';
        this.opponentTeamId = 't2';

        return GamesManager.playerCreateGame(this);
      },
      [this.t('labelBack')]: () => {
        this.sendBackMenu();
      },
      anyMatch: () => {
        this.scope.runMenu(emptyMenu);
      }
    };

    this.scope.runMenu(emptyMenu);
  }

  onGamePending(game) {
    this.gameId = game.gameId;

    const fightTeams = this.getTeamsMessage(game);
    const fightMessage = this.t('teamFightPendingMessage', { fightTeams });

    const pendingMenu = {
      layout: [2, 1],
      resizeKeyboard: true,
      message: this.t('teamFightSelectMessage'),
      [this.t('labelTeamsFightJoin', { icon: '🔴' })]: () => {
        this.teamId = 't1';
        this.opponentTeamId = 't2';
        return GamesManager.playerJoinGroupGame(this);
      },
      [this.t('labelTeamsFightJoin', { icon: '🔵' })]: () => {
        this.teamId = 't2';
        this.opponentTeamId = 't1';
        return GamesManager.playerJoinGroupGame(this);
      },
      [this.t('labelBack')]: () => {
        this.sendBackMenu();
      }
    };

    this.scope.sendMessage(fightMessage).then(message => {
      this.teamsMessage = message;
      this.scope.runMenu(pendingMenu);
    });
  }

  onGameCreated(game) {
    this.gameId = game.gameId;

    const fightTeams = this.getTeamsMessage(game);
    const fightMessage = this.t('teamFightPendingMessage', { fightTeams });

    const pendingMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: this.t('fightCreatedMessage'),
      [this.t('labelCancel')]: () => {
        GamesManager.playerCancelGame(this.gameId);
        this.onGameRefused();
      }
    };

    this.scope.sendMessage(fightMessage).then(message => {
      this.teamsMessage = message;
      this.scope.runMenu(pendingMenu);
    });
  }

  onGamePlayerJoin(game) {
    const teamsMessage = this.getTeamsMessage(game);
    const menuMessage = this.getFightRefuseMenu('fightJoinMessage');

    if (!this.gameId) {
      const { teamId } = game.players[this.playerId];
      this.gameId = game.gameId;
      this.teamId = teamId;
      this.opponentTeamId = game.teams[teamId].opponentTeamId;

      return this.scope.sendMessage(teamsMessage).then(message => {
        this.teamsMessage = message;
        this.scope.runMenu(menuMessage);
      });
    }

    return this.scope.editMessage(this.teamsMessage, teamsMessage).then(() => {
      this.scope.runMenu(menuMessage);
    });
  }

  onGameStatusUpdated(game) {
    const fightTeams = this.getTeamsMessage(game);
    const fightMessage = this.t('teamFightPendingMessage', { fightTeams });
    const timeLeftToStart = this.getTimeLeftToStart(game.timeToStart);
    const editedMessage = `${fightMessage}${timeLeftToStart}`;

    if (this.teamsMessage) {
      this.scope.editMessage(this.teamsMessage, editedMessage);
    }

    if (this.isPending && game.total.players > 1) {
      this.isPending = false;
      const pendingMenu = this.getFightRefuseMenu('fightRefuseMenuMessage');
      this.scope.runMenu(pendingMenu);
    }
  }

  onGameStarted(game) {
    this.startTurn(game, null, this.scope.files.fightGroup);
  }

  onGameTurnRepeat(game) {
    this.startTurn(game);
  }

  onGameTurnResults(game) {
    if (!this.menu.showFinishMenu) {
      return null;
    }

    const turnMessage = this.getTurnResultsMessage(game);
    return this.startTurn(game, turnMessage);
  }

  onGameFinished(game) {
    const turnMessage = this.getTurnResultsMessage(game);
    const teamsDetails = this.getTeamsMessage(game);
    const finalImage = this.getFinishImage();
    const finalMessage = game.draw
      ? `<b>${this.t('fightFinishedDrawMessage')}</b>`
      : `<b>${this.t('fightFinishedMessage')}</b>`;

    const menuMessage = `${turnMessage}\n\n${finalMessage}\n\n${teamsDetails}`;
    this.sendBackMenu(menuMessage, finalImage);
  }

  startTurn(game, resultsMessage, menuImage) {
    const player = game.players[this.playerId];
    const opponent = game.players[player.opponentId];
    const opponentTag = this.menu.getTag(opponent);

    const turnTeams = this.getTeamsMessage(game);
    const turnResults = resultsMessage || this.t('teamFightStartedMessage', { opponentTag });

    const turnMessage = `${turnResults}\n\n${turnTeams}`;
    const opponents = game.teams[this.opponentTeamId].players;

    return this.menu.startTurn({
      turnMessage,
      player,
      opponent,
      opponents,
      menuImage
    });
  }

  getTeamsMessage(game) {
    return Object.keys(game.teams).reduce((teamStr, teamId, teamIndex) => {
      const team = game.teams[teamId];
      const teamWon = game.finished && !game.draw && !team.lost;
      const teamLost = game.finished && !game.draw && team.lost;
      const teamHealth = team.getHealth();
      const teamPlayers = team.getPlayerIds().reduce((playersStr, playerId, index) => {
        const player = game.players[playerId];
        const playerTag = this.menu.getTag(player);
        const playerRewards = game.finished && player.rewards ? this.getRewardsMessage(player) : null;

        const rewardsMessage = playerRewards ? `\n${playerRewards}` : '';

        return `${playersStr}\n${index + 1}. ${playerTag} ${player.dead ? '💀' : ''} ${
          player.surrender ? '🏳' : ''
        }${rewardsMessage}`;
      }, '');

      return `${teamStr}${teamIndex === 1 ? '\n\n' : ''} <b>${team.icon} ${this.tx.labelTeam} ${teamIndex + 1} 💟 (${
        teamHealth.total
      }/${teamHealth.max})</b> ${teamWon ? `— 🏆 ${this.tx.labelTeamWon}` : ''}${
        teamLost ? `— 🤕 ${this.tx.labelTeamLost}` : ''
      } ${teamPlayers.length > 0 ? teamPlayers : '\n...'}`;
    }, '');
  }
}

module.exports = TeamsFightController;
