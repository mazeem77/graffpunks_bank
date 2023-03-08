const GamesManager = require('bot/managers/GamesManager');
const FightController = require('./FightController');

class RoyalFightController extends FightController {
  constructor(...args) {
    super(...args);

    this.refuseMenuSent = false;
    this.refusePenalty = 25;
  }

  search() {
    GamesManager.playerSearchGroupGame(this);
  }

  async onGameEmpty() {
    const fightStatus = this.t('royalFightEmptyMessage');
    const fightMessage = this.t('royalFightInfoMessage', { fightStatus });
    const fightCreateMenu = this.getFightCreateMenu();

    const emptyMenu = {
      layout: [2, 2, 1],
      resizeKeyboard: true,
      message: fightMessage,
      ...fightCreateMenu,
      [this.t('labelBack')]: () => {
        this.sendBackMenu();
      }
    };

    this.emptyMessage = await this.scope.runMenu(emptyMenu);

    return GamesManager.playerSubscribe(this);
  }

  async onGamePending(game, messageKey = 'royalFightInfoMessage') {
    this.gameId = game.gameId;

    const { refusePenalty } = this;
    const fightStatus = this.getFightPendingMessage(game);
    const fightMessage = this.t(messageKey, { fightStatus });
    const fightJoinQuestion = this.t('fightJoinQuestion', { refusePenalty });

    const pendingMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: fightJoinQuestion,
      [this.t('labelFightJoin')]: () => {
        return GamesManager.playerJoinGroupGame(this);
      },
      [this.t('labelBack')]: () => {
        return this.sendBackMenu();
      }
    };

    if (this.emptyMessage) {
      this.scope.deleteMessage(this.emptyMessage);
      this.emptyMessage = null;
    }

    this.fightMessage = await this.scope.sendMessage(fightMessage);
    this.menuMessage = await this.scope.runMenu(pendingMenu);

    return GamesManager.playerSubscribeToGame(this, this.gameId);
  }

  async onGameCreated(game) {
    this.gameId = game.gameId;

    const fightMessage = this.getFightPendingMessage(game);
    const fightMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: this.t('fightCreatedMessage'),
      [this.t('labelCancel')]: () => {
        this.onGameRefused();
        GamesManager.playerCancelGame(this.gameId);
      }
    };

    this.fightMessage = await this.scope.sendMessage(fightMessage);
    this.menuMessage = await this.scope.runMenu(fightMenu);
  }

  async onGamePlayerJoin(game) {
    GamesManager.playerUnsubscribe(this.playerId);

    const fightMessage = this.getFightPendingMessage(game);
    const fightMenu = this.getFightRefuseMenu('fightJoinMessage');

    if (!this.gameId) {
      this.gameId = game.gameId;

      return this.scope.sendMessage(fightMessage).then(message => {
        this.fightMessage = message;
        this.scope.runMenu(fightMenu);
      });
    }

    this.refuseMenuSent = true;

    return this.scope.runMenu(fightMenu);
  }

  onSubscriberUpdated(game) {
    return this.fightMessage ? this.refreshFightMessage(game) : this.onGamePending(game, 'royalFightFoundMessage');
  }

  async onGameStatusUpdated(game) {
    await this.refreshFightMessage(game);

    if (this.menuMessage) {
      this.scope.deleteMessage(this.menuMessage);
      this.menuMessage = null;
    }

    if (!this.refuseMenuSent && game.total.players > 1) {
      const fightMenu = this.getFightRefuseMenu('fightRefuseMenuMessage');

      this.refuseMenuSent = true;
      this.scope.runMenu(fightMenu);
    }
  }

  async refreshFightMessage(game) {
    const fightMessage = this.getFightPendingMessage(game);

    this.fightMessage = await this.scope.editMessage(this.fightMessage, fightMessage);

    return this.fightMessage;
  }

  onGameStarted(game) {
    this.startTurn(game, null, this.scope.files.fightRoyal);
  }

  onGameTurnResults(game) {
    if (!this.menu.showFinishMenu) {
      return null;
    }

    const turnMessage = this.getTurnResultsMessage(game);
    return this.startTurn(game, turnMessage);
  }

  onGameTurnRepeat(game) {
    this.startTurn(game);
  }

  onGameFinished(game) {
    const turnMessage = this.getTurnResultsMessage(game);
    const fightPlayers = this.getFightPlayers(game);
    const finalImage = this.getFinishImage();
    const finalMessage = game.draw
      ? `<b>${this.t('fightFinishedDrawMessage')}</b>`
      : `<b>${this.t('fightFinishedMessage')}</b>`;

    const menuMessage = `${turnMessage}\n\n${finalMessage}\n\n${fightPlayers}`;
    this.sendBackMenu(menuMessage, finalImage);
  }

  startTurn(game, resultsMessage, menuImage) {
    const player = game.players[this.playerId];
    const opponent = game.players[player.opponentId];
    const opponentTag = this.menu.getTag(opponent);
    const turnPlayers = this.getFightPlayers(game);
    const turnResults = resultsMessage || this.t('royalFightStartedMessage', { opponentTag });

    const turnMessage = `${turnResults}\n\n${turnPlayers}`;
    const opponents = game.players;

    return this.menu.startTurn({
      turnMessage,
      player,
      opponent,
      opponents,
      menuImage
    });
  }

  getFightPendingMessage(game) {
    const { total, timeToStart } = game;

    const fightPlayers = this.getFightPlayers(game);
    const playersCount = total.players;
    const playersMax = total.max;
    const timeLeftToStart = this.getTimeLeftToStart(timeToStart);

    return this.t('royalFightPendingMessage', {
      fightPlayers,
      timeLeftToStart,
      playersCount,
      playersMax
    });
  }

  getFightPlayers(game) {
    return Object.keys(game.players)
      .map((playerId, index) => {
        const player = game.players[playerId];
        const { rewards, dead, surrender } = player;
        const hasRewards = game.finished && rewards;

        const iconDead = dead ? '💀' : '';
        const iconSurrender = surrender ? '🏳' : '';
        const iconWinner = rewards.winner ? '🏆' : '';
        const playerNumber = index + 1;
        const playerTag = this.menu.getTag(player);
        const playerRewards = hasRewards ? `\n${this.getRewardsMessage(player)}` : '';

        return this.t('fightPlayerDetails', {
          iconDead,
          iconSurrender,
          iconWinner,
          playerNumber,
          playerTag,
          playerRewards
        });
      })
      .join('\n');
  }
}

module.exports = RoyalFightController;
