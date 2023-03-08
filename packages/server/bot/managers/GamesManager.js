const redis = require('services/redis');
const sockets = require('services/sockets');
const Random = require('random-js')();
const GameSingle = require('bot/models/GameSingle');
const GameTeams = require('bot/models/GameTeams');
const GameRoyal = require('bot/models/GameRoyal');
const CharacterModel = require('models/character');
const { isEqual } = require('lodash');
const CharactersManager = require('./CharactersManager');

const loadCharacter = userId => CharacterModel.forFight({ userId });

const GAME_MATCHERS = {
  single: {
    levelGaps: {
      min: 0,
      max: 0
    }
  },
  teams: {
    levelGaps: {
      min: 1,
      max: 1
    }
  },
  royal: {
    levelGaps: {
      min: 2,
      max: 2
    }
  }
};

const GAME_MODELS = {
  single: GameSingle,
  teams: GameTeams,
  royal: GameRoyal
};

class GamesManager {
  constructor () {
    this.games = {};
    this.subscribers = {};
  }

  restore () {
    redis.get('GamesManagerData', (err, data) => {
      if (data) {
        const storedClients = JSON.parse(data);

        if (storedClients.length > 0) {
          CharacterModel.find({ userId: { $in: storedClients } }, { userId: 1, userLang: 1 }).exec(
            (err, characters) => {
              if (!err) {
                characters.forEach(character => {
                  character.notify('gameDisconnectMessage');
                });
              }
            }
          );

          redis.del('GamesManagerData');
        }
      }
    });
  }

  persist () {
    const storedClients = Object.keys(this.games).reduce(
      (clients, gameId) => [...clients, ...this.games[gameId].getClientIds()],
      []
    );

    try {
      const dataString = JSON.stringify(storedClients);
      redis.set('GamesManagerData', dataString, err => {
        if (!err) {
          console.info('GamesManager data saved!');
        }
      });
    } catch (err) {
      console.error(err);
    }
  }

  async syncClient (client) {
    const character = await loadCharacter(client.playerId);
    const characterData = character.toObject();
    return client.setCharacter(characterData);
  }

  getGamesLog () {
    return Object.keys(this.games).reduce((log, gameId) => {
      const game = this.games[gameId];
      const gameState = game.getState();
      return [...log, gameState];
    }, []);
  }

  getGameMatcher ({ mode }) {
    return GAME_MATCHERS[mode];
  }

  getGameModel ({ mode }) {
    return GAME_MODELS[mode];
  }

  isPlaying (playerId) {
    return CharactersManager.isPlaying(playerId);
  }

  isPendingGame (game) {
    return game && game.isPending;
  }

  isSameClan (game, { player }) {
    const opponent = game.players[game.p1];

    if (opponent.character.clan && player.clan) {
      return opponent.character.clan._id.equals(player.clan.id);
    }

    return false;
  }

  isSameLevel (game, { playerLevel }) {
    return isEqual(game.level, playerLevel);
  }

  isRangeLevel (game, client) {
    const { params, averageLevel } = game;
    const { playerLevel } = client;
    const { levelGaps } = this.getGameMatcher(params);

    return (
      isEqual(averageLevel, playerLevel) ||
      isEqual(averageLevel, playerLevel + levelGaps.max) ||
      isEqual(averageLevel, playerLevel - levelGaps.max)
    );
  }

  isSamePrevOpponent (game, { lastOpponentId }) {
    return isEqual(game.p1, lastOpponentId);
  }

  isSameFormat (game, client) {
    return isEqual(game.params, client.params);
  }

  isGameExists (client) {
    const { playerId } = client;
    const pendingGame = this.getPlayerGame(playerId);
    const playing = this.isPlaying(playerId);

    if (playing) {
      return client.onGameExists();
    }

    if (pendingGame) {
      pendingGame.playerRejoin(client);
    }

    return false;
  }

  isSubscribed (playerId) {
    return this.subscribers[playerId];
  }

  isPending (playerId) {
    return this.getPlayerGame(playerId);
  }

  getPlayerGame (playerId) {
    const gameId = Object.keys(this.games).find(gameId => this.games[gameId].hasPlayer(playerId));

    return this.games[gameId];
  }

  getPendingSingleGames (client) {
    const pendingGames = Object.keys(this.games).filter(gameId => {
      const game = this.games[gameId];

      if (client.isProximo()) {
        return this.isPendingGame(game) && this.isSameFormat(game, client) && !this.isSamePrevOpponent(game, client);
      }

      return (
        this.isPendingGame(game) &&
        this.isSameFormat(game, client) &&
        this.isSameLevel(game, client) &&
        !this.isSamePrevOpponent(game, client) &&
        !this.isSameClan(game, client)
      );
    });

    const randomGameId = Random.pick(pendingGames);
    return this.games[randomGameId];
  }

  getPendingGroupGame (client) {
    const gameId = Object.keys(this.games).find(gameId => {
      const game = this.games[gameId];

      return this.isPendingGame(game) && this.isSameFormat(game, client) && this.isRangeLevel(game, client);
    });

    return this.games[gameId];
  }

  playerSearchSingleGame (client) {
    if (this.isGameExists(client)) {
      return false;
    }

    const singleGame = this.getPendingSingleGames(client);

    return singleGame ? this.playerJoinSingleGame(client, singleGame) : this.playerCreateGame(client);
  }

  playerSearchGroupGame (client) {
    if (this.isGameExists(client)) {
      return false;
    }

    const groupGame = this.getPendingGroupGame(client);
    return groupGame ? client.onGamePending(groupGame.getState()) : client.onGameEmpty();
  }

  async playerCreateGame (client) {
    const { playerId, params } = client;

    // console.log('client.playerId Manager: ', client);

    await this.syncClient(client);

    const GameModel = this.getGameModel(params);
    const handlers = this.getHandlers();
    const game = new GameModel(client, handlers);

    this.playerUnsubscribe(playerId);
    this.registerGame(game);

    game.playerCreate(client);
    game.refresh();
  }

  async playerJoinSingleGame (client, game) {
    const { playerId } = client;

    await this.syncClient(client);

    this.playerUnsubscribe(playerId);
    game.playerJoin(client);
  }

  async playerJoinGroupGame (client) {
    const { gameId, playerId } = client;
    const game = this.games[gameId];

    if (game) {
      await this.syncClient(client);

      this.playerUnsubscribe(playerId);
      game.playerJoin(client);
    }
  }

  playerCancelGame (gameId) {
    if (this.games[gameId]) {
      this.games[gameId].playerCancel();
    }
  }

  playerLeaveGame (gameId, playerId, teamId = null) {
    if (this.games[gameId]) {
      this.games[gameId].playerLeave(playerId, teamId);
    }
  }

  playerSurrender (gameId, playerId) {
    if (this.games[gameId]) {
      this.games[gameId].playerSurrender(playerId);
    }
  }

  playerFinishTurn (gameId, playerResults) {
    if (this.games[gameId]) {
      this.games[gameId].playerFinishTurn(playerResults);
    }
  }

  playerTimeout (gameId, playerId) {
    if (this.games[gameId]) {
      this.games[gameId].playerTimeout(playerId);
    }
  }

  playerSubscribe (client) {
    this.subscribers[client.playerId] = {
      client
    };
  }

  playerSubscribeToGame (client, gameId) {
    this.subscribers[client.playerId] = {
      client,
      gameId
    };
  }

  playerUnsubscribe (playerId) {
    delete this.subscribers[playerId];
  }

  registerGame (game) {
    this.games[game.gameId] = game;
  }

  destroyGame (gameId) {
    if (this.games[gameId]) {
      this.notifyGameSubscribers(gameId, 'onGameRefused');
      delete this.games[gameId];
    }
  }

  onGameRefresh () {
    this.notifySubscribers();
    this.notifySockets();
  }

  notifyGameSubscribers (gameId, eventKey) {
    const gameSubscribers = this.getGameSubscribers(gameId);

    gameSubscribers.forEach(playerId => {
      const subscriber = this.subscribers[playerId];
      subscriber.client[eventKey]();
    });
  }

  notifySubscribers () {
    this.getSubscribersIds().forEach(playerId => {
      const subscriber = this.subscribers[playerId];
      const pendingGame = this.getPendingGroupGame(subscriber.client);

      if (pendingGame) {
        subscriber.client.onSubscriberUpdated(pendingGame);
      }
    });
  }

  notifySockets () {
    const gamesLog = this.getGamesLog();
    sockets.emitWebsiteUpdate('gamesUpdate', gamesLog);
  }

  getGameSubscribers (gameId) {
    return this.getSubscribersIds().filter(playerId => {
      const subscriber = this.subscribers[playerId];
      return subscriber.gameId && isEqual(subscriber.gameId, gameId);
    });
  }

  getSubscribersIds () {
    return Object.keys(this.subscribers);
  }

  getHandlers () {
    return {
      onDestroy: this.destroyGame.bind(this),
      onRefresh: this.onGameRefresh.bind(this)
    };
  }
}

module.exports = new GamesManager();
