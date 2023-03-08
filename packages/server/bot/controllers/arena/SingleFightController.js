const GamesManager = require('bot/managers/GamesManager');
const FightController = require('./FightController');

class SingleFightController extends FightController {
  search() {
    GamesManager.playerSearchSingleGame(this);
  }

  onGameCreated(game) {
    this.gameId = game.gameId;

    const pendingMenu = {
      message: this.t('fightSearchMessage'),
      resizeKeyboard: true,
      layout: 1,
      [this.t('labelCancel')]: () => {
        GamesManager.playerCancelGame(this.gameId);
        this.onGameRefused();
      },
      anyMatch: () => {
        this.scope.runMenu(pendingMenu);
      }
    };

    this.scope.runMenu(pendingMenu);
  }

  onGameReady(game) {
    this.gameId = game.gameId;
    this.opponentId = game.players[this.playerId].opponentId;

    const opponent = game.players[this.opponentId];
    const opponentTag = this.menu.getTag(opponent);

    const gameReadyMessage = this.t('fightReadyMessage', { opponentTag });
    const gameReadyMenu = {
      message: gameReadyMessage,
      resizeKeyboard: true,
      layout: [3, 3],
      [this.t('labelSurrender')]: () => this.menu.sendMenu(this.menu.getSurrenderMenu(gameReadyMenu))
    };

    this.scope.runMenu(gameReadyMenu);
  }

  onGameStarted(game) {
    this.startTurn(game, null, this.scope.files.fightSingle);
  }

  onGameTurnResults(game) {
    const resultsMessage = this.getTurnResultsMessage(game);
    this.startTurn(game, resultsMessage);
  }

  onGameFinished(game) {
    const turnMessage = !game.canceled ? `${this.getTurnResultsMessage(game)}\n\n` : '';
    const finalMessage = this.getFinalMessage(game);
    const finalImage = this.getFinishImage();
    const menuMessage = turnMessage + finalMessage;

    this.sendBackMenu(menuMessage, finalImage);
  }

  startTurn(game, resultsMessage, menuImage) {
    const player = game.players[this.playerId];
    const opponent = game.players[this.opponentId];

    const turnMessage =
      resultsMessage ||
      this.t('fightStartedMessage', {
        playerTag: this.menu.getTag(player),
        opponentTag: this.menu.getTag(opponent)
      });

    return this.menu.startTurn({
      turnMessage,
      player,
      opponent,
      menuImage
    });
  }

  getFinalMessage(game) {
    let finalMessage = game.draw
      ? `<b>${this.t('fightFinishedDrawMessage')}</b>\n`
      : `<b>${this.t('fightFinishedMessage')}</b>\n`;

    Object.keys(game.players).forEach(playerId => {
      const player = game.players[playerId];
      const playerTag = this.menu.getTag(player);
      const playerRewards = this.getRewardsMessage(player);

      const { labelWon, labelLost, labelSurrendered } = this.tx;
      const { winner, loser } = player.rewards;

      if (game.draw) {
        finalMessage += `\n${playerTag}\n${playerRewards}\n`;
      }

      if (winner) {
        finalMessage += `\n${playerTag} 🏆 ${labelWon}.\n${playerRewards}\n`;
      }

      if (loser) {
        finalMessage += `\n${playerTag} ${
          player.canceled ? `🏳 ${labelSurrendered}` : `🤕 ${labelLost}`
        }.\n${playerRewards}\n`;
      }
    });

    return finalMessage;
  }
}

module.exports = SingleFightController;
