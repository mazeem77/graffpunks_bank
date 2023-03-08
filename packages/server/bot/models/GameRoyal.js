const { sleep, isEven } = require('utils');
const Game = require('./Game.js');
const Player = require('./Player.js');
const GhostsManager = require('../managers/GhostsManager');
const { getRewards } = require('../helpers/rewards');

const GAME_PLAYERS_MAX = 12;
const GAME_START_INTERVAL = 30000;
const TURN_RESULTS_DELAY = 7500;
const TURN_AUTO_RESULTS_TIMEOUT = 7500;

class GameRoyal extends Game {
  constructor (...args) {
    super(...args);

    this.total.max = GAME_PLAYERS_MAX;
  }

  isTotalEqual () {
    return isEven(this.total.players);
  }

  playerCreate (client) {
    const player = new Player({
      userId: client.playerId,
      character: client.character
    });

    console.log('client.playerId Royal: ', client.playerId);
    this.players[player.userId] = player;
    this.total.levels += client.playerLevel;
    this.total.players += 1;

    this.gameStartInterval = setInterval(() => this.onStartIntervalUpdate(), GAME_START_INTERVAL);

    this.triggerEvent('onGameCreated', this.getState());
  }

  playerRejoin (client) {
    this.setClient(client);
    client.onGamePlayerJoin(this.getState());
  }

  playerJoin (client) {
    if (!this.isPending) {
      return client.onGameRejected();
    }

    client.onGamePlayerJoin(this.getState());

    const player = new Player({
      userId: client.playerId,
      character: client.character
    });

    this.setClient(client);

    this.players[player.userId] = player;

    this.total.levels += client.playerLevel;
    this.total.players += 1;

    if (this.total.players === GAME_PLAYERS_MAX) {
      return this.onGameStart();
    }

    this.triggerEvent('onGameStatusUpdated', this.getState());
    return this.refresh();
  }

  onStartIntervalUpdate () {
    this.timeToStart -= GAME_START_INTERVAL;
    this.ghostJoin();

    if (this.timeToStart <= 0 || this.total.players === GAME_PLAYERS_MAX) {
      return this.onGameStart();
    }

    this.triggerEvent('onGameStatusUpdated', this.getState());
    return this.refresh();
  }

  ghostJoin () {
    const ghostId = `ghost_${this.total.ghosts}`;
    const gameLevel = this.averageLevel;

    const ghost = GhostsManager.createGhostPlayer({
      userId: ghostId,
      level: gameLevel,
      params: this.params
    });

    this.players[ghost.userId] = ghost;
    this.total.levels += ghost.character.stats.level;
    this.total.players += 1;
    this.total.ghosts += 1;
  }

  playerCancel () {
    clearInterval(this.gameStartInterval);
    this.isFinished = true;
    this.isPending = false;

    this.destroy();
    this.refresh();
  }

  playerLeave (playerId) {
    const { character } = this.players[playerId];

    this.total.players -= 1;
    this.total.levels -= character.stats.level;
    this.removePlayer(playerId);

    this.triggerEvent('onGameStatusUpdated', this.getState());
    this.refresh();
  }

  playerFinishTurn (results) {
    this.players[results.playerId].setResults(results);

    if (results.opponentId) {
      this.players[results.playerId].setOpponent({
        opponentId: results.opponentId
      });
    }

    const isTurnFinished = this.isResultsReady();

    if (isTurnFinished) {
      if (!this.isTotalEqual()) {
        this.triggerEvent('onGameRefused');
        this.destroy();
      } else {
        this.calculateTurnResults();
      }
    }
  }

  onGameStart () {
    clearInterval(this.gameStartInterval);

    if (!this.hasRealPlayers()) {
      this.refresh();
      this.destroy();
    }

    if (!this.isTotalEqual()) {
      this.ghostJoin();
    }

    this.startGame();
  }

  startGame () {
    this.isPending = false;
    this.setOpponents();
    this.setPlaying(true);
    this.triggerEvent('onGameStarted', this.getState());
    this.refresh();
  }

  isEmptyOpponent (playerId) {
    return this.players[playerId].opponentId === null;
  }

  setOpponents () {
    const playerIds = this.getPlayerIds();
    const ignoreIds = [];

    playerIds.forEach(playerId => {
      if (this.isEmptyOpponent(playerId)) {
        const opponentIds = playerIds.filter(id => !ignoreIds.includes(id) && id !== playerId);

        const opponentId = this.getBestOpponent(opponentIds, playerId);

        this.players[playerId].setOpponent({
          opponentId: opponentId
        });

        this.players[opponentId].setOpponent({
          opponentId: playerId
        });

        ignoreIds.push(opponentId, playerId);
      }
    });
  }

  calculateTurnResults () {
    this.turnPlayers = this.getAliveIds();

    this.turnPlayers.forEach(playerId => {
      const p1 = this.players[playerId];
      const p2 = this.players[p1.opponentId];

      if (p1.ghost) {
        let ghostResults = null;
        let ghostChances = null;

        if (p2.defeated) {
          const nextOpponent = this.getNextOpponent(p1);

          if (nextOpponent) {
            p1.setOpponent({ opponentId: nextOpponent.playerId });

            ghostResults = this.getGhostResults(p1, nextOpponent);
            ghostChances = this.calculateChances(p1, nextOpponent);
          }
        } else {
          ghostResults = this.getGhostResults(p1, p2);
          ghostChances = this.calculateChances(p1, p2);
        }

        p1.setResults(ghostResults);
        p1.setChances({
          [p1.opponentId]: ghostChances
        });
      } else {
        p1.setChances({
          [p1.opponentId]: this.calculateChances(p1, p2)
        });
      }
    });

    this.turnPlayers.forEach(playerId => {
      const p1 = this.players[playerId];
      const p2 = this.players[p1.opponentId];

      const resultsFinal = this.calculateFinalResults(p1, p2);

      p1.setResults(resultsFinal);
    });

    sleep(TURN_RESULTS_DELAY).then(() => {
      if (this.isResultsReady()) {
        this.turnFinished();
      } else {
        this.triggerEvent('onGameTurnRepeat', this.getState());
      }
    });
  }

  isGameFinished () {
    const alivePlayers = this.getAliveIds();
    const isFinished = alivePlayers.length <= 1;

    if (isFinished) {
      this.isDraw = alivePlayers.length === 0;
    }

    return isFinished;
  }

  turnFinished () {
    this.isFinished = this.isGameFinished();

    if (this.isFinished) {
      this.getPlayerIds().forEach(playerId => {
        const p1 = this.players[playerId];

        const rewards = getRewards({
          type: 'royal',
          player: p1,
          draw: this.isDraw,
          loser: !this.isDraw && p1.defeated,
          winner: !this.isDraw && !p1.defeated,
          total: this.total
        });

        p1.setRewards(rewards);
      });

      this.onGameFinish();
    } else {
      this.triggerEvent('onGameTurnResults', this.getState());
      this.refresh();

      this.incrementTurn();
      this.clearTurnResults();

      if (!this.hasActivePlayers()) {
        sleep(TURN_AUTO_RESULTS_TIMEOUT).then(() => {
          this.calculateTurnResults();
        });
      }
    }
  }
}

module.exports = GameRoyal;
