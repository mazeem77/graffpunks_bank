const redis = require('services/redis');

class CharactersManager {
  constructor() {
    this.state = {};
  }

  restore() {
    return new Promise(resolve => {
      redis.get('CharactersManagerData', (err, dataString) => {
        if (dataString) {
          this.state = JSON.parse(dataString);

          Object.keys(this.state).forEach(userId => {
            this.setPlaying(userId, false);
          });

          console.info('[CharactersManager]: Data restored!');
        }

        resolve();
      });
    });
  }

  persist() {
    const dataString = JSON.stringify(this.state);

    redis.set('CharactersManagerData', dataString, err => {
      if (!err) {
        console.info('[CharactersManager]: Data saved!');
      }
    });
  }

  setState(userId, param, value) {
    if (this.state[userId]) {
      this.state[userId][param] = value;
    } else {
      this.state[userId] = {
        [param]: value
      };
    }
  }

  setBusyJob(userId, value) {
    this.setState(userId, 'busyJob', value);
  }

  getBusyJob(userId) {
    return this.state[userId] && this.state[userId].busyJob;
  }

  clearBusyJob(userId) {
    if (this.state[userId]) {
      delete this.state[userId].busyJob;
    }
  }

  setPlaying(userId, value) {
    this.setState(userId, 'playing', value);
  }

  isPlaying(userId) {
    return !!(this.state[userId] && this.state[userId].playing);
  }

  isWorking(userId) {
    return !!(this.state[userId] && this.state[userId].busyJob);
  }

  getActivityIcon(userId) {
    const isPlaying = this.isPlaying(userId);
    const isWorking = this.isWorking(userId);

    if (isPlaying) {
      return '⚔️';
    }

    if (isWorking) {
      return '⛏';
    }

    return '';
  }
}

module.exports = new CharactersManager();
