const Random = require('random-js')();
const { sleep } = require('utils');
const Game = require('./Game');
const Player = require('./Player');
const GhostsManager = require('../managers/GhostsManager');
const { getRewards } = require('../helpers/rewards');

const GAME_AUTOSTART_DELAY = 5000;

class GameSingle extends Game {
  constructor(...args) {
    super(...args);

    this.isGhost = false;
  }

  playerCreate(client) {
    const player = new Player({
      userId: client.playerId,
      character: client.character
    });
    console.log('client.playerId single: ', client.playerId);
    this.p1 = player.userId;
    this.players[this.p1] = player;

    this.level = client.playerLevel;

    this.ghostGameTimeout = setTimeout(() => {
      this.startGhostGame(client.character);
    }, Random.integer(5, 10) * 1000);

    this.setClient(client);
    this.triggerEvent('onGameCreated', this.getState());
  }

  playerJoin(client) {
    this.isPending = false;
    clearTimeout(this.ghostGameTimeout);

    const player = new Player({
      userId: client.playerId,
      character: client.character,
      opponentId: this.p1
    });

    this.p2 = player.userId;
    this.players[player.userId] = player;
    this.players[this.p1].opponentId = player.userId;

    this.setClient(client);
    this.triggerEvent('onGameReady', this.getState());

    sleep(GAME_AUTOSTART_DELAY).then(() => {
      this.playerConfirm(this.p1);
      this.playerConfirm(this.p2);
    });
  }

  startGhostGame(character) {
    this.isGhost = true;
    this.isPending = false;

    const ghost = GhostsManager.createGhostPlayer({
      level: this.level,
      params: this.params,
      opponentId: this.p1,
      opponent: character
    });

    this.p2 = ghost.userId;
    this.players[ghost.userId] = ghost;
    this.players[this.p1].opponentId = ghost.userId;

    this.generateGhostTurn();
    this.triggerEvent('onGameReady', this.getState());

    sleep(GAME_AUTOSTART_DELAY).then(() => {
      this.playerConfirm(this.p1);
    });
  }

  generateGhostTurn() {
    const player = this.players[this.p1];
    const ghost = this.players[this.p2];
    const ghostResults = this.getGhostResults(ghost, player);
    const ghostChances = this.calculateChances(ghost, player);

    ghost.setResults(ghostResults);
    ghost.setChances({
      [ghost.opponentId]: ghostChances
    });
  }

  calculateTurnResults() {
    Object.keys(this.players).forEach(playerId => {
      const p1 = this.players[playerId];
      const p2 = this.players[p1.opponentId];
      const resultsFinal = this.calculateFinalResults(p1, p2);

      p1.setResults(resultsFinal);
    });

    this.turnFinished();
  }

  turnFinished() {
    const h1 = this.players[this.p1].getHealth();
    const h2 = this.players[this.p2].getHealth();

    this.isFinished = h1 <= 0 || h2 <= 0;
    this.isDraw = h1 <= 0 && h2 <= 0;

    if (this.isFinished) {
      this.calculateRewards({ h1, h2 });
    } else {
      this.triggerEvent('onGameTurnResults', this.getState());
      this.refresh();

      this.incrementTurn();
      this.clearTurnResults();

      if (this.isGhost) {
        this.generateGhostTurn();
      }
    }
  }

  playerFinishTurn(results) {
    const p1 = this.players[results.playerId];
    const p2 = this.players[p1.opponentId];
    const chances = this.calculateChances(p1, p2);

    p1.setResults(results);
    p1.setChances({
      [p1.opponentId]: chances
    });

    if (p1.results && p2.results) {
      if (!this.isGhost) {
        this.calculateTurnResults();
      } else {
        const ghostTurnDelay = Random.integer(1, 4) * 1000;
        sleep(ghostTurnDelay).then(() => {
          this.calculateTurnResults();
        });
      }
    }
  }

  playerTimeout(playerId) {
    const p1 = this.players[this.p1];
    const p2 = this.players[this.p2];

    if (!p1.results && !p2.results) {
      return this.triggerEvent('onGameRefused');
    }

    if (!this.players[playerId].results) {
      return this.playerSurrender(playerId);
    }

    if (p1.results && p2.results) {
      return this.calculateTurnResults();
    }

    return null;
  }

  playerConfirm(playerId) {
    this.players[playerId].confirm();

    if (
      !this.isCanceled &&
      this.players[this.p1].confirmed &&
      this.players[this.p2].confirmed
    ) {
      this.isPending = false;

      this.setPlaying(true);
      this.triggerEvent('onGameStarted', this.getState());
      this.refresh();
    }
  }

  playerCancel() {
    clearTimeout(this.ghostGameTimeout);
    this.isFinished = true;
    this.isPending = false;

    this.destroy();
    this.refresh();
  }

  playerSurrender(playerId) {
    clearTimeout(this.ghostGameTimeout);

    this.isCanceled = true;
    this.isFinished = true;
    this.isPending = false;

    this.players[playerId].cancel();

    this.calculateRewards({
      w1: this.p2 === playerId,
      w2: this.p1 === playerId
    });
  }

  calculateRewards(params) {
    const { w1, w2, h1, h2 } = params;

    const p1 = {
      type: 'single',
      draw: this.isDraw,
      turnNumber: this.turnNumber,
      training: this.isTrainingFight(),
      player: this.players[this.p1],
      opponent: this.players[this.p2],
      loser: this.isCanceled ? w2 : !this.isDraw && h1 <= 0,
      winner: this.isCanceled ? w1 : !this.isDraw && h1 > 0
    };

    const p2 = {
      type: 'single',
      draw: this.isDraw,
      turnNumber: this.turnNumber,
      training: this.isTrainingFight(),
      player: this.players[this.p2],
      opponent: this.players[this.p1],
      loser: this.isCanceled ? w1 : !this.isDraw && h2 <= 0,
      winner: this.isCanceled ? w2 : !this.isDraw && h2 > 0
    };

    const r1 = getRewards(p1);
    const r2 = getRewards(p2);

    this.players[this.p1].setRewards(r1);
    this.players[this.p2].setRewards(r2);

    this.onGameFinish();
  }
}

module.exports = GameSingle;
