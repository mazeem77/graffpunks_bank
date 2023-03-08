const GamesManager = require('bot/managers/GamesManager');
const CharactersManager = require('bot/managers/CharactersManager');

class MiddlewareController {
  isUpdateAllowed($) {
    const { userId } = $;

    return (
      !CharactersManager.isPlaying(userId) &&
      !GamesManager.isSubscribed(userId) &&
      !GamesManager.isPending(userId)
    );
  }
}

module.exports = MiddlewareController;
