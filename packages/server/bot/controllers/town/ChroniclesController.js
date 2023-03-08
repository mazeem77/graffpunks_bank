const moment = require('moment');
const Telegram = require('bot/lib/core/Telegram');
const ChroniclesManager = require('bot/managers/ChroniclesManager');
const CharacterModel = require('models/character');

class ChroniclesController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onChronicles: 'onChronicles'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  loadChronicles(params) {
    return ChroniclesManager.load(params);
  }

  getGroups(data) {
    return data.reduce((groups, item) => {
      const { date, ...data } = item;
      return groups[date]
        ? { ...groups, [date]: [...groups[date], data] }
        : { ...groups, [date]: [data] };
    }, {});
  }

  getChroniclesMenu(character, chronicles) {
    const {
      docs,
      pagination: { page, pages }
    } = chronicles;
    const tx = character.getPhrases();
    const groups = this.getGroups(docs);

    const menuMessage = Object.keys(groups).reduce((message, date) => {
      const groupItems = groups[date];
      const groupList = this.renderList(character, tx, groupItems);
      const groupDate = moment(Date.parse(date))
        .locale(tx.lang)
        .format('LL');
      const groupTitle = `<b>📅 ${groupDate}</b>`;

      return `${message}\n\n${groupTitle}\n${groupList}`;
    }, `<b>${tx.labelPage} (${page})</b>`);

    const loadPage = async (query, page) => {
      const chronicles = await this.loadChronicles({ page });
      const chroniclesMenu = this.getChroniclesMenu(character, chronicles);
      query.update(chroniclesMenu);
    };

    const menu = {
      layout: 2,
      method: 'sendMessage',
      message: menuMessage,
      menu: []
    };

    if (page > 1) {
      menu.menu.push({
        text: '⬅️',
        callback: query => loadPage(query, page - 1)
      });
    }

    if (page < pages) {
      menu.menu.push({
        text: '➡️',
        callback: query => loadPage(query, page + 1)
      });
    }

    return menu;
  }

  renderList(character, tx, items) {
    const itemsMessage = items.map(({ type, data }) => {
      const text = character.t(`chronicle.${type}`, data);
      return `▫️ ${text}`;
    });

    return itemsMessage.join('\n');
  }

  async onChronicles($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const chronicles = await this.loadChronicles();
    const chroniclesMenu = this.getChroniclesMenu(character, chronicles);

    $.runInlineMenu(chroniclesMenu);
  }
}

module.exports = ChroniclesController;
