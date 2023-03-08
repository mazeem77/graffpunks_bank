const Random = require('random-js')();
const { sleep } = require('utils');
const Game = require('./Game.js');
const Team = require('./Team.js');
const Player = require('./Player.js');
const GhostsManager = require('../managers/GhostsManager');
const { getRewards } = require('../helpers/rewards');

const GAME_PLAYERS_MAX = 12;
const GAME_START_TIMEOUT = 60000;
const GAME_START_INTERVAL = 20000;
const TURN_RESULTS_DELAY = 7500;
const TURN_AUTO_RESULTS_TIMEOUT = 7500;

class GameTeams extends Game {
  constructor (...args) {
    super(...args);

    this.timeToStart = GAME_START_TIMEOUT;
    this.teams = {
      t1: new Team({
        id: 't1',
        icon: '🔴',
        opponentTeamId: 't2'
      }),
      t2: new Team({
        id: 't2',
        icon: '🔵',
        opponentTeamId: 't1'
      })
    };
  }

  isTeamsEqual () {
    return this.teams.t1.playersTotal === this.teams.t2.playersTotal;
  }

  playerCreate (client) {
    const player = new Player({
      userId: client.playerId,
      teamId: this.teams.t1.teamId,
      character: client.character
    });

    console.log('client.playerId Teams: ', client.playerId);

    this.players[player.userId] = player;
    this.teams.t1.addPlayer(this.players[player.userId]);

    this.total.levels += client.playerLevel;
    this.total.players += 1;

    this.gameStartInterval = setInterval(() => {
      this.timeToStart -= GAME_START_INTERVAL;
      this.ghostJoin();

      if (this.timeToStart <= 0 || this.total.players === GAME_PLAYERS_MAX) {
        this.onGameStart();
      } else {
        this.triggerEvent('onGameStatusUpdated', this.getState());
        this.refresh();
      }
    }, GAME_START_INTERVAL);

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
      teamId: client.teamId,
      character: client.character
    });

    this.setClient(client);

    this.players[player.userId] = player;
    this.teams[client.teamId].addPlayer(this.players[player.userId]);

    this.total.levels += client.playerLevel;
    this.total.players += 1;

    if (this.total.players === GAME_PLAYERS_MAX) {
      return this.onGameStart();
    }

    this.triggerEvent('onGameStatusUpdated', this.getState());
    return this.refresh();
  }

  ghostJoin () {
    const ghostId = `ghost_${this.total.ghosts}`;
    const teamId = this.teams.t1.playersTotal > this.teams.t2.playersTotal ? 't2' : 't1';

    const team = this.teams[teamId];
    const ghostLevel = this.teams[team.opponentTeamId].averageLevel;

    const ghost = GhostsManager.createGhostPlayer({
      userId: ghostId,
      teamId: teamId,
      level: ghostLevel,
      params: this.params
    });

    this.players[ghost.userId] = ghost;
    this.teams[teamId].addPlayer(this.players[ghost.userId]);
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

  playerLeave (playerId, teamId) {
    const { character } = this.players[playerId];

    this.total.players -= 1;
    this.total.levels -= character.stats.level;
    this.teams[teamId].removePlayer(playerId);
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
      if (!this.isTeamsEqual()) {
        this.triggerEvent('onGameRefused');
        this.destroy();
      } else {
        this.calculateTurnResults();
      }
    }
  }

  onGameStart () {
    clearInterval(this.gameStartInterval);

    if (this.hasRealPlayers()) {
      sleep(100).then(() => {
        if (!this.isTeamsEqual()) {
          this.equalizeTeams();
        } else {
          this.startGame();
        }
      });
    } else {
      this.refresh();
      this.destroy();
    }
  }

  startGame () {
    this.isPending = false;
    this.setOpponents();

    this.setPlaying(true);
    this.triggerEvent('onGameStarted', this.getState());
    this.refresh();
  }

  equalizeTeams () {
    const playersDiff = Math.abs(this.teams.t1.playersTotal - this.teams.t2.playersTotal);

    for (let i = 0; i < playersDiff; i++) {
      this.ghostJoin();
    }

    this.startGame();
  }

  setOpponents () {
    const { t1, t2 } = this.teams;
    const ignoreIds = [];

    t1.getPlayerIds().forEach(playerId => {
      const randomIds = t2.getPlayerIds().filter(id => !ignoreIds.includes(id));
      const randomId = Random.pick(randomIds);

      const p1 = this.players[playerId];
      const p2 = this.players[randomId];

      p1.setOpponent({
        opponentId: randomId,
        opponentTeamId: t2.teamId
      });

      p2.setOpponent({
        opponentId: playerId,
        opponentTeamId: t1.teamId
      });

      ignoreIds.push(randomId);
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
          const opponentTeam = this.teams[p2.teamId];
          const opponentIds = opponentTeam.getAliveIds();

          const currentOpponent = opponentIds.find(opponentId => {
            const opponent = opponentTeam.players[opponentId];
            return opponent.opponentId === p1.playerId;
          });

          const opponentId = currentOpponent || Random.pick(opponentIds);
          const opponentNew = opponentTeam.players[opponentId];

          if (opponentNew) {
            p1.setOpponent({ opponentId });

            ghostResults = this.getGhostResults(p1, opponentNew);
            ghostChances = this.calculateChances(p1, opponentNew);
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

  turnFinished () {
    this.isFinished = this.teams.t1.lost || this.teams.t2.lost;

    if (this.isFinished) {
      this.isDraw = this.teams.t1.lost && this.teams.t2.lost;

      this.getPlayerIds().forEach(playerId => {
        const p1 = this.players[playerId];
        const t1 = this.teams[p1.teamId];

        const rewards = getRewards({
          type: 'teams',
          player: p1,
          flawless: t1.flawless,
          draw: this.isDraw,
          loser: !this.isDraw && t1.lost,
          winner: !this.isDraw && !t1.lost
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

module.exports = GameTeams;
