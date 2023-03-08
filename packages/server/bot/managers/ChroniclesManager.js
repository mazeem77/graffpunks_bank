const moment = require('moment');
const sockets = require('services/sockets');
const ChronicleModel = require('models/chronicle');

const types = {
  characterNew: 'characterNew',
  characterNewLevel: 'characterNewLevel',
  clanNew: 'clanNew',
  clanNewLevel: 'clanNewLevel',
  clanMemberJoined: 'clanMemberJoined',
  clanMemberLeft: 'clanMemberLeft'
};

class ChroniclesManager {
  async create(params) {
    const newChronicle = new ChronicleModel({
      ...params,
      date: moment().format('YYYY-MM-DD')
    });

    const chronicle = await newChronicle.save();

    this.notifySockets(chronicle);
  }

  async load(params = {}) {
    const { page = 1 } = params;

    const limit = 50;
    const lean = true;
    const sort = { datetime: 'desc' };

    return ChronicleModel.paginate({}, { sort, page, lean, limit });
  }

  notifySockets(data) {
    sockets.emitWebsiteUpdate('chroniclesUpdate', data);
  }

  getCharacterData(character) {
    const characterTag = character.renderTag({ hideInfo: true });
    return { characterTag };
  }

  getClanData(clan) {
    const clanTag = clan.renderTag();
    return { clanTag };
  }

  characterNew(character) {
    return this.create({
      type: types.characterNew,
      data: this.getCharacterData(character)
    });
  }

  characterNewLevel(character) {
    return this.create({
      type: types.characterNewLevel,
      data: this.getCharacterData(character)
    });
  }

  clanNew(clan) {
    return this.create({
      type: types.clanNew,
      data: this.getClanData(clan)
    });
  }

  clanNewLevel(clan) {
    return this.create({
      type: types.clanNewLevel,
      data: this.getClanData(clan)
    });
  }

  clanMemberJoined(clan, character) {
    return this.create({
      type: types.clanMemberJoined,
      data: {
        ...this.getClanData(clan),
        ...this.getCharacterData(character)
      }
    });
  }

  clanMemberLeft(clan, character) {
    return this.create({
      type: types.clanMemberLeft,
      data: {
        ...this.getClanData(clan),
        ...this.getCharacterData(character)
      }
    });
  }
}

module.exports = new ChroniclesManager();
