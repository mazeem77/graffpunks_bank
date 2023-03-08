const moment = require('moment');
const agenda = require('services/agenda');
const Telegram = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const ClanModel = require('models/clan');
const SeasonModel = require('models/season');
const LeagueModel = require('models/league');
const CharacterModel = require('models/character');
const CharactersManager = require('bot/managers/CharactersManager');

const { chunk } = require('lodash');
const { translate } = require('i18n/translate');
const { renderCharacterTag } = require('bot/helpers/character');
const {
  getRatingStatusIcon,
  calculateGlobalRating
} = require('bot/helpers/rating');

class RatingController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onRating: 'onRating'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId });
  }

  async onRating($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();

    this.sendRatingMenu($, tx);
  }

  sendRatingMenu($, tx, customMessage) {
    const ratingMenu = {
      layout: [2, 2, 1],
      resizeKeyboard: true,
      message: customMessage || tx.ratingMenuMessage,
      [tx.labelMaximusLeague]: $ => this.sendMaximusMenu($, tx),
      [tx.labelProximoLeague]: $ => this.sendProximoMenu($, tx),
      [tx.labelSeasonHistory]: $ => this.sendSeasonHistory($, tx),
      [tx.labelRatingGlobal]: $ => this.sendGlobalRating($, tx),
      [tx.labelBack]: $ => {
        MenuHelper.sendMainMenu($, tx, {
          message: tx.mainMenuShortMessage
        });
      },
      anyMatch: $ => $.runMenu(ratingMenu)
    };

    $.runMenu(ratingMenu);
  }

  async sendProximoMenu($, tx, customMessage) {
    const league = await LeagueModel.findOne({ name: 'proximo' }).exec();
    const jobs = await agenda.jobs({ name: 'reset_proximo_season' });
    const seasonJob = jobs && jobs[0];

    if (league && league.active && seasonJob) {
      const {
        bank: { gold }
      } = league;
      const season = seasonJob.attrs;
      const timeLeft = moment()
        .locale(tx.lang)
        .to(Date.parse(season.nextRunAt));
      const seasonDetails = translate(tx.lang, 'proximoLeagueMessage', {
        timeLeft,
        gold
      });

      const leagueMenu = {
        layout: 1,
        resizeKeyboard: true,
        message: customMessage || seasonDetails,
        [tx.labelRatingHeroes]: $ => this.sendProximoRating($, tx),
        [tx.labelBack]: $ => this.sendRatingMenu($, tx),
        anyMatch: $ => $.runMenu(leagueMenu)
      };

      return $.runMenu(leagueMenu);
    }

    return this.sendRatingMenu($, tx, tx['noActiveLeague.proximo']);
  }

  async sendProximoRating($, tx) {
    const characters = await CharacterModel.find({
      deleted: false,
      'proximoStats.rating': { $gte: 0 }
    })
      .populate('clan')
      .sort({ 'proximoStats.rating': -1 })
      .limit(100)
      .lean()
      .exec();

    const listMessage = characters.reduce((message, character, index) => {
      const { proximoStats } = character;
      const characterTag = renderCharacterTag(character);
      const activityIcon = CharactersManager.getActivityIcon(character.userId);

      return `${message}${index + 1} – ${characterTag} (${
        proximoStats.rating
      }) ${activityIcon}\n`;
    }, `${tx.ratingTitle}\n\n`);

    return this.sendProximoMenu($, tx, listMessage);
  }

  async sendMaximusMenu($, tx, customMessage) {
    const jobs = await agenda.jobs({ name: 'reset_maximus_season' });
    const seasonJob = jobs && jobs[0];

    if (seasonJob) {
      const season = jobs[0].attrs;
      const seasonFinishLeft = moment()
        .locale(tx.lang)
        .to(Date.parse(season.nextRunAt));
      const seasonDetails = `<b>${tx.labelSeason}</b>\n\n<b>${
        tx.labelSeasonFinishDate
      }:</b> ${seasonFinishLeft}\n\n${tx.seasonDescription}`;

      const seasonMenu = {
        layout: [2, 1],
        resizeKeyboard: true,
        message: customMessage || seasonDetails,
        [tx.labelRatingHeroes]: $ => this.sendHeroesRating($, tx),
        [tx.labelRatingClans]: $ => this.sendClansRating($, tx),
        [tx.labelBack]: $ => this.sendRatingMenu($, tx),
        anyMatch: $ => $.runMenu(seasonMenu)
      };

      return $.runMenu(seasonMenu);
    }

    return this.sendRatingMenu($, tx, tx.noActiveSeason);
  }

  renderHeroesList(characters, params = {}) {
    const { gap = 0, pageMessage = '' } = params;
    return characters.reduce((list, character, index) => {
      const { rating, ratingStatus } = character.stats;
      const characterTag = renderCharacterTag(character);
      const ratingIcon = getRatingStatusIcon(ratingStatus);
      const activityIcon = CharactersManager.getActivityIcon(character.userId);
      const number = gap + index + 1;

      return `${list}${number} – ${characterTag} (${rating}) ${ratingIcon} ${activityIcon}\n`;
    }, pageMessage);
  }

  renderClansList(tx, clans) {
    return clans.reduce((list, clan, index) => {
      const { icon, name, level, rating, ratingStatus } = clan;
      const ratingIcon = getRatingStatusIcon(ratingStatus);
      return `${list}${index +
        1} – ${icon} ${name} (${rating}) 🎖${level} ${ratingIcon}\n`;
    }, `${tx.ratingTitle}\n\n`);
  }

  async sendHeroesRating($, tx) {
    const characters = await CharacterModel.find({})
      .populate('clan')
      .sort({ 'stats.rating': -1 })
      .limit(100)
      .lean()
      .exec();

    const perPage = 25;

    if (characters.length > perPage) {
      const pages = chunk(characters, perPage);
      const menuItems = pages.map((data, index) => ({
        id: index,
        message: this.renderHeroesList(data, {
          gap: perPage * index,
          pageMessage: `<b>${tx.labelPage} ${index + 1}/${pages.length}</b>\n\n`
        }),
        menu: []
      }));

      await this.sendMaximusMenu($, tx, tx.ratingTitle);
      return $.runPaginatedMenu({
        layout: [2, 2],
        items: menuItems
      });
    }

    const listMessage = this.renderHeroesList(characters);
    const menuMessage = `${tx.ratingTitle}\n\n${listMessage}`;

    return this.sendMaximusMenu($, tx, menuMessage);
  }

  async sendClansRating($, tx) {
    const clans = await ClanModel.find({
      rating: { $gt: 0 }
    })
      .sort({ rating: -1 })
      .limit(50)
      .lean()
      .exec();

    if (!clans.length) {
      return this.sendMaximusMenu($, tx, tx.ratingNoClans);
    }

    const message = this.renderClansList(tx, clans);
    return this.sendMaximusMenu($, tx, message);
  }

  async sendGlobalRating($, tx) {
    const characters = await CharacterModel.find(
      {
        deleted: false
      },
      {
        stats: 1,
        values: 1,
        clan: 1,
        username: 1,
        customName: 1
      }
    )
      .populate('clan')
      .sort({
        'stats.level': -1,
        'stats.wins': -1
      })
      .limit(100)
      .lean()
      .exec();

    const _characters = characters
      .reduce((calculated, character) => {
        return [
          ...calculated,
          Object.assign(character, {
            globalRate: calculateGlobalRating(character.stats)
          })
        ];
      }, [])
      .filter(c => c.globalRate > 0)
      .sort((c1, c2) => c2.globalRate - c1.globalRate);

    const listMessage = _characters.reduce((message, character, index) => {
      const { globalRate } = character;
      const characterTag = renderCharacterTag(character);
      const activityIcon = CharactersManager.getActivityIcon(character.userId);

      return `${message}${index +
        1} – ${characterTag} / (${globalRate}) ${activityIcon}\n`;
    }, `${tx.ratingGlobal}\n\n`);

    return this.sendRatingMenu($, tx, listMessage);
  }

  async sendSeasonHistory($, tx) {
    const seasons = await SeasonModel.find({})
      .populate('legends.clan')
      .populate({
        path: 'legends.character',
        populate: {
          path: 'clan'
        }
      })
      .lean()
      .exec();

    if (seasons && seasons.length > 0) {
      const listMessage = seasons.reduce((message, season) => {
        const {
          name,
          finish_at_date,
          legends: { clan, character }
        } = season;
        const seasonFinishDate = moment(Date.parse(finish_at_date))
          .locale(tx.lang)
          .format('dddd, DD MMMM');
        const clanTag = clan ? `${clan.icon} ${clan.name}` : '-';
        const characterTag = character ? renderCharacterTag(character) : '-';

        return `${message}<b>${name[tx.lang]}</b> (${seasonFinishDate})\n${
          tx.labelLegendHero
        }: ${characterTag}\n${tx.labelLegendClan}: ${clanTag}\n\n`;
      }, `${tx.seasonHistoryTitle}\n\n`);

      return this.sendRatingMenu($, tx, listMessage);
    }

    return this.sendRatingMenu($, tx, tx.noFinishedSeason);
  }
}

module.exports = RatingController;
