class Team {
  constructor(params) {
    this.teamId = params.id;
    this.opponentTeamId = params.opponentTeamId;
    this.icon = params.icon;

    this.players = {};
  }

  get lost() {
    return this.getPlayerIds().every(
      playerId => this.players[playerId].defeated
    );
  }

  get flawless() {
    return this.getPlayerIds().every(playerId => this.players[playerId].alive);
  }

  get playersTotal() {
    return this.getPlayerIds().length;
  }

  get levelsTotal() {
    return this.getPlayerIds().reduce((total, playerId) => {
      total += this.players[playerId].character.stats.level;
      return total;
    }, 0);
  }

  get averageLevel() {
    return Math.floor(this.levelsTotal / this.playersTotal);
  }

  addPlayer(player) {
    this.players[player.userId] = player;
  }

  removePlayer(playerId) {
    delete this.players[playerId];
  }

  getPlayerIds() {
    return Object.keys(this.players);
  }

  getAliveIds() {
    return this.getPlayerIds().filter(playerId => this.players[playerId].alive);
  }

  getHealth() {
    return this.getPlayerIds().reduce(
      (health, playerId) => {
        const player = this.players[playerId];
        const playerHealth = !player.surrender
          ? player.character.values.health
          : 0;

        return {
          total: health.total + playerHealth,
          max: health.max + player.character.values.maxHealth
        };
      },
      { total: 0, max: 0 }
    );
  }
}

module.exports = Team;
