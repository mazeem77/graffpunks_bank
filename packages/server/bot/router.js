const Telegram = require('bot/lib/core/Telegram');

const { TextCommand, TextArrayCommand, ParamsCommand } = Telegram;

const StartController = require('./controllers/StartController');
const TownhallController = require('./controllers/town/TownhallController');
const AcademyController = require('./controllers/town/AcademyController');
const TownController = require('./controllers/town/TownController');
const TempleController = require('./controllers/town/TempleController');
const ShopController = require('./controllers/town/ShopController');
const BankController = require('./controllers/town/BankController');
const LotteryController = require('./controllers/town/LotteryController');
const TavernController = require('./controllers/town/TavernController');
const ChroniclesController = require('./controllers/town/ChroniclesController');
const ChristmasGiftsController = require('./controllers/town/ChristmasGiftsController');

const ArenaController = require('./controllers/arena/ArenaController');
const ArenaMaximusController = require('./controllers/arena/ArenaMaximusController');
const ArenaProximoController = require('./controllers/arena/ArenaProximoController');

const CharacterController = require('./controllers/character/CharacterController');
const AnimalController = require('./controllers/character/AnimalController');
const SkillsController = require('./controllers/character/SkillsController');
const InventoryController = require('./controllers/character/InventoryController');

const ClanController = require('./controllers/clan/ClanController');
const ClanCastleController = require('./controllers/clan/ClanCastleController');
const ClanInvitesController = require('./controllers/clan/ClanInvitesController');
const ClanMembersController = require('./controllers/clan/ClanMembersController');

const RatingController = require('./controllers/RatingController');
const SettingsController = require('./controllers/SettingsController');
const CacheController = require('./controllers/CacheController');
const FacelessController = require('./controllers/FacelessController');
const AnimalShopController = require('./controllers/town/AnimalShopController');
const OtherwiseController = require('./controllers/OtherwiseController');
const MiddlewareController = require('./controllers/MiddlewareController');

const CallbackQueryController = require('./controllers/CallbackQueryController');

const routes = [
  {
    commands: ['⚔️ Арена', '⚔️ Arena', '/arena'],
    handler: 'onArena',
    controller: ArenaController
  },
  {
    commands: ['🏆 Арена Максимус', '🏆 Arena Maximus', '/maximus'],
    handler: 'onArenaMaximus',
    controller: ArenaMaximusController
  },
  {
    commands: ['🏵 Арена Проксимо', '🏵 Arena Proximo', '/proximo'],
    handler: 'onArenaProximo',
    controller: ArenaProximoController
  },
  {
    commands: ['🎄 Ёлка', '🎄 Christmas tree'],
    handler: 'onChristmasGifts',
    controller: ChristmasGiftsController
  },
  {
    commands: ['🏛 Академия', '🏛 Academy'],
    handler: 'onAcademy',
    controller: AcademyController
  },
  {
    commands: ['📚 Способности', '📚 Abilities'],
    handler: 'onAbilities',
    controller: AcademyController
  },
  {
    commands: ['💈 Услуги', '💈 Services'],
    handler: 'onServices',
    controller: AcademyController
  },
  {
    commands: ['🏫 Ратуша', '🏫 Townhall'],
    handler: 'onTownhall',
    controller: TownhallController
  },
  {
    commands: ['🏘 Город', '🏘 Town', '/town'],
    handler: 'onTown',
    controller: TownController
  },
  {
    commands: ['💒 Храм', '💒 Temple'],
    handler: 'onTemple',
    controller: TempleController
  },
  {
    commands: ['🎲 Лотерея', '🎲 Lottery'],
    handler: 'onLottery',
    controller: LotteryController
  },
  {
    commands: ['🏠 Торговец', '🏠 Shop', '/shop'],
    handler: 'onShop',
    controller: ShopController
  },
  {
    commands: ['🗡 Оружие', '🗡 Weapons'],
    handler: 'onWeapons',
    controller: ShopController
  },
  {
    commands: ['🛡 Броня', '🛡 Armors'],
    handler: 'onArmors',
    controller: ShopController
  },
  {
    commands: ['💍 Украшения', '💍 Jewelery'],
    handler: 'onJewelry',
    controller: ShopController
  },
  {
    commands: ['⚗ Зелья', '⚗ Potions'],
    handler: 'onPotions',
    controller: ShopController
  },
  {
    commands: ['🛍 Разное', '🛍 Other'],
    handler: 'onOther',
    controller: ShopController
  },
  {
    commands: ['🎁 Подарки', '🎁 Gifts'],
    handler: 'onGifts',
    controller: ShopController
  },
  {
    commands: ['💰 Продать вещи', '💰 Sell items'],
    handler: 'onSell',
    controller: ShopController
  },
  {
    commands: ['🔨 Починить вещи', '🔨 Repair items'],
    handler: 'onRepair',
    controller: ShopController
  },
  {
    commands: ['🎒 Инвентарь', '🎒 Inventory', '/inventory'],
    handler: 'onInventory',
    controller: InventoryController
  },
  {
    commands: ['/ammunition'],
    handler: 'onCategory',
    controller: InventoryController
  },
  {
    commands: ['/potions'],
    handler: 'onCategory',
    controller: InventoryController
  },
  {
    commands: ['/gifts'],
    handler: 'onCategory',
    controller: InventoryController
  },
  {
    commands: ['/pocket'],
    handler: 'onPocketUse',
    controller: InventoryController
  },
  {
    commands: ['🏰 Клан', '🏰 Clan', '/clan'],
    handler: 'onClan',
    controller: ClanController
  },
  {
    commands: ['/setchat', '/editchat', '/deletechat'],
    handler: 'onClanEdit',
    controller: ClanController
  },
  {
    commands: ['📬 Заявки', '📬 Applicants'],
    handler: 'onClanApplicants',
    controller: ClanController
  },
  {
    commands: ['👥 Состав', '👥 Members'],
    handler: 'onClanMembers',
    controller: ClanController
  },
  {
    commands: ['❌ Покинуть клан', '❌ Leave clan'],
    handler: 'onClanLeave',
    controller: ClanController
  },
  {
    commands: ['❌ Расформировать', '❌ Disband clan'],
    handler: 'onClanDelete',
    controller: ClanController
  },
  {
    commands: ['📩 Приглашения', '📩 Invitations'],
    handler: 'onClanInvites',
    controller: ClanInvitesController
  },
  {
    commands: ['🏰 Замок', '🏯 Замок', '🏰 Castle', '🏯 Castle'],
    handler: 'onClanCastle',
    controller: ClanCastleController
  },
  {
    commands: ['👑 Управление', '👑 Management'],
    handler: 'onClanMembers',
    controller: ClanMembersController
  },
  {
    commands: ['⭐ Навыки', '⭐ Skills', '/skills'],
    handler: 'onSkills',
    controller: SkillsController
  },
  {
    commands: ['🐺 Зверь', '🐺 Beast'],
    handler: 'onAnimal',
    controller: AnimalController
  },
  {
    commands: ['🎖 Герой', '🎖 Hero', '/hero'],
    handler: 'onHero',
    controller: CharacterController
  },
  {
    commands: ['🗡 Профиль', '🗡 Profile', '/profile'],
    handler: 'onProfile',
    controller: CharacterController
  },
  {
    commands: ['🏅 Статистика', '🏅 Statistics', '/stats'],
    handler: 'onStats',
    controller: CharacterController
  },
  {
    commands: ['👤 Аватар', '👤 Avatar', '/avatar'],
    handler: 'onAvatar',
    controller: CharacterController
  },
  {
    commands: ['🤺 Владение', '🤺 Mastery'],
    handler: 'onMastery',
    controller: CharacterController
  },
  {
    commands: ['🏆 Достижения', '🏆 Achievements'],
    handler: 'onAchievements',
    controller: CharacterController
  },
  {
    commands: ['🏆 Лиги', '🏆 Leagues', '/leagues'],
    handler: 'onRating',
    controller: RatingController
  },
  {
    commands: ['⚙️ Настройки', '⚙️ Settings', '/settings'],
    handler: 'onSettings',
    controller: SettingsController
  },
  {
    commands: ['💎 Банк', '💎 Bank'],
    handler: 'onBank',
    controller: BankController
  },
  {
    commands: ['🐺 Зверинец', '🐺 Menagerie'],
    handler: 'onAnimalShop',
    controller: AnimalShopController
  },
  {
    commands: ['🏚 Таверна', '🏚 Tavern'],
    handler: 'onTavern',
    controller: TavernController
  },
  {
    commands: ['📜 Летопись', '📜 Chronicles'],
    handler: 'onChronicles',
    controller: ChroniclesController
  },
  {
    commands: ['💰 Получить золото', '💰 Get gold', '/rewards'],
    handler: 'onRewards',
    controller: OtherwiseController
  },
  {
    commands: ['❓Помощь', '❓Help', '/help'],
    handler: 'onHelp',
    controller: OtherwiseController
  },
  {
    commands: ['⬅ Меню', '⬅ Menu'],
    handler: 'onMenu',
    controller: OtherwiseController
  },
  {
    commands: ['короли граффити', 'Graffiti Kings'],
    handler: 'onGK',
    controller: OtherwiseController
  },
  {
    commands: ['Очистить кэш', 'Clear Cache'],
    handler: 'onDelete',
    controller: CacheController
  },
  {
    commands: ['Сбросить Безликий', 'Reset Faceless'],
    handler: 'onFaceless',
    controller: FacelessController
  }
];

function initialize (bot) {
  bot.router.when(new TextCommand('/start', 'onStart'), new StartController());

  bot.router.when(new ParamsCommand('/skill id value', 'onSkillIncrease'), new SkillsController());

  routes.forEach(({ commands, handler, controller }) => {
    bot.router.when(new TextArrayCommand(commands, handler), new controller());
  });

  bot.router.otherwise(new OtherwiseController());
  bot.router.middleware(new MiddlewareController());

  bot.router.callbackQuery(new CallbackQueryController());
}

module.exports = {
  initialize
};
