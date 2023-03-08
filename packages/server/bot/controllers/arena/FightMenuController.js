const GamesManager = require('bot/managers/GamesManager');
const { isEqual } = require('lodash');
const {
  renderCharacterTag,
  renderFacelessTag
} = require('bot/helpers/character');
const { translate, getFightPhrases } = require('i18n/translate');

class FightMenuController {
  constructor(scope, params, player) {
    this.gameId = null;
    this.scope = scope;
    this.params = params;
    this.player = player;

    this.turnState = {
      playerId: this.playerId,
      opponentId: null,
      attackAnimal: false,
      surrender: false,
      attack: null,
      defense: null
    };

    this.turnInterval = null;
    this.turnTimeLeft = 120000;
    this.turnTimeInterval = this.turnTimeLeft / 4;

    this.currentMenu = null;
    this.showFinishMenu = true;

    this.setAreas();
    this.setPlayerAreas();
  }

  get playerId() {
    return this.player.userId;
  }

  get playerLang() {
    return this.player.userLang;
  }

  get hasShield() {
    return this.player.items.shield;
  }

  get isSingle() {
    return this.params.mode === 'single';
  }

  get tx() {
    return getFightPhrases(this.playerLang);
  }

  t(key, params) {
    return translate(this.playerLang, key, params, 'fight');
  }

  getTag(player, params) {
    const { character, playerId } = player;

    if (character.effects.faceless) {
      return renderFacelessTag(character, {
        showHealth: isEqual(this.playerId, playerId)
      });
    }

    return renderCharacterTag(character, {
      showHealth: true,
      ...params
    });
  }

  setAreas() {
    const {
      attackLabelsHead,
      animalAttackLabelsHead,
      attackLabelsBody,
      animalAttackLabelsBody,
      attackLabelsStomach,
      animalAttackLabelsStomach,
      attackLabelsLegs,
      animalAttackLabelsLegs,
      attackLabelsAnimal,
      animalAttackLabelsAnimal
    } = this.tx;

    this.areas = {
      attack: [
        {
          value: 0,
          name: this.t('attackAreaHead'),
          labels: attackLabelsHead,
          animalLabels: animalAttackLabelsHead
        },
        {
          value: 1,
          name: this.t('attackAreaBody'),
          labels: attackLabelsBody,
          animalLabels: animalAttackLabelsBody
        },
        {
          value: 2,
          name: this.t('attackAreaStomach'),
          labels: attackLabelsStomach,
          animalLabels: animalAttackLabelsStomach
        },
        {
          value: 3,
          name: this.t('attackAreaLegs'),
          labels: attackLabelsLegs,
          animalLabels: animalAttackLabelsLegs
        },
        {
          value: 4,
          name: this.t('attackAreaAnimal'),
          labels: attackLabelsAnimal,
          animalLabels: animalAttackLabelsAnimal
        }
      ],
      defenseWithShield: [
        { value: [0, 1], name: this.t('defenseAreaHeadBody') },
        { value: [1, 2], name: this.t('defenseAreaBodyStomach') },
        { value: [2, 3], name: this.t('defenseAreaStomachLegs') },
        { value: [3, 0], name: this.t('defenseAreaLegsHead') }
      ],
      defenseDefault: [
        { value: [0], name: this.t('defenseAreaHead') },
        { value: [1], name: this.t('defenseAreaBody') },
        { value: [2], name: this.t('defenseAreaStomach') },
        { value: [3], name: this.t('defenseAreaLegs') }
      ]
    };
  }

  setPlayerAreas() {
    this.attackAreas = this.areas.attack;
    this.defenseAreas = this.hasShield
      ? this.areas.defenseWithShield
      : this.areas.defenseDefault;
  }

  setTurnState(state) {
    this.turnState = {
      ...this.turnState,
      ...state
    };
  }

  resetTurnState() {
    this.currentMenu = null;
    this.setTurnState({
      attackAnimal: false,
      attack: null,
      defense: null
    });
  }

  isBodyArea(area) {
    return area.value !== 4;
  }

  isAnimalArea(area) {
    return area.value === 4;
  }

  getTimeLeftMessage(time) {
    const timeSeconds = Math.round(time / 1000);
    const timeIcon = timeSeconds < 30 ? '⌛️' : '⏳';
    return this.t('timeLeftToTurnEnd', { timeIcon, timeSeconds });
  }

  async sendMenu(menu, menuImage) {
    this.currentMenu = menu;
    await this.scope.runMenu(menu, menuImage);
  }

  resetInterval() {
    clearInterval(this.turnInterval);
    this.turnTimeLeft = 120000;
  }

  playerSurrender() {
    this.resetInterval();

    if (this.isSingle) {
      return GamesManager.playerSurrender(this.gameId, this.playerId);
    }

    this.playerFinishTurn({ surrender: true });

    const fightResult = this.t('fightPlayerSurrender');
    const finishedMessage = this.t('fightPlayerFinished', { fightResult });
    const finishedMenu = this.getGroupFightFinishMenu(finishedMessage);

    return this.sendMenu(finishedMenu);
  }

  playerFinishTurn(state) {
    const turnState = { ...this.turnState, ...state };

    this.resetInterval();
    this.resetTurnState();

    GamesManager.playerFinishTurn(this.gameId, turnState);
  }

  startTurnTimer() {
    let timeLeft = this.turnTimeLeft;

    const handleTick = () => {
      timeLeft -= this.turnTimeInterval;

      if (timeLeft <= 0) {
        return this.playerSurrender();
      }

      const message = this.getTimeLeftMessage(timeLeft);
      return this.sendMenu({ ...this.currentMenu, message });
    };

    this.turnInterval = setInterval(handleTick, this.turnTimeInterval);
  }

  startTurn({
    turnMessage,
    player,
    opponent,
    opponents = null,
    menuImage = null
  }) {
    if (player.alive) {
      this.startTurnTimer();
    }

    if (player.defeated) {
      const fightResult = player.dead
        ? this.t('fightPlayerDead')
        : this.t('fightPlayerSurrender');
      const finishedMessage = this.t('fightPlayerFinished', { fightResult });
      const finishedMenuMessage = `${turnMessage}\n\n${finishedMessage}`;
      const finishedMenu = this.getGroupFightFinishMenu(finishedMenuMessage);

      return this.sendMenu(finishedMenu);
    }

    if (opponents && opponent.defeated) {
      const opponentsMenu = this.getOpponentsMenu(opponents);
      const menuMessage = `${turnMessage}\n\n${this.t('fightOpponentDead')}`;

      return this.sendMenu({ ...opponentsMenu, message: menuMessage });
    }

    const opponentTag = this.getTag(opponent);
    const targetMessage = this.t('fightTarget', { opponentTag });
    const attackMenu = this.getAttackMenu(opponent);
    const attackMenuMessage = this.isSingle
      ? `${turnMessage}\n\n${this.t('fightAttackMenuQuestion')}`
      : `${turnMessage}\n\n${targetMessage}`;

    return this.sendMenu(
      { ...attackMenu, message: attackMenuMessage },
      menuImage
    );
  }

  getAttackMenu(opponent) {
    const attackAreas = opponent.animalAlive
      ? this.attackAreas
      : this.attackAreas.filter(this.isBodyArea);

    const attackActions = attackAreas.reduce((areas, area) => {
      return {
        ...areas,
        [area.name]: () => {
          this.turnTimeLeft += 5000;

          this.setTurnState({
            attack: area.value,
            attackAnimal: this.isAnimalArea(area)
          });

          return this.sendMenu(this.getDefenseMenu());
        }
      };
    }, {});

    const attackMenu = {
      layout: [2, 2, 1, 1],
      resizeKeyboard: true,
      message: this.t('fightAttackMenuQuestion'),
      ...attackActions,
      [this.t('labelSurrender')]: () =>
        this.sendMenu(this.getSurrenderMenu(attackMenu))
    };

    return attackMenu;
  }

  getDefenseMenu() {
    const defenseActions = this.defenseAreas.reduce((areas, area) => {
      areas[area.name] = async () => {
        await this.sendMenu(this.getTurnFinishedMenu());
        this.playerFinishTurn({ defense: area.value });
      };
      return areas;
    }, {});

    const defenseMenu = {
      layout: [2, 2, 1, 1],
      message: this.t('fightDefenseMenuQuestion'),
      resizeKeyboard: true,
      ...defenseActions,
      [this.t('labelSurrender')]: () =>
        this.sendMenu(this.getSurrenderMenu(defenseMenu))
    };

    return defenseMenu;
  }

  getOpponentsMenu(opponents) {
    const opponentsMenuBack = {
      [this.t('labelBack')]: () =>
        this.sendMenu(this.getOpponentsMenu(opponents))
    };

    const opponentsActions = Object.keys(opponents).reduce(
      (buttons, playerId) => {
        const player = opponents[playerId];
        const samePlayer = player.playerId === this.playerId;

        if (player.alive && !samePlayer) {
          const playerTag = this.getTag(player);
          buttons[playerTag] = () => {
            this.turnTimeLeft += 5000;
            this.setTurnState({ opponentId: player.userId });
            const attackMenu = this.getAttackMenu(player);

            return this.sendMenu({
              ...attackMenu,
              ...opponentsMenuBack
            });
          };
        }
        return buttons;
      },
      {}
    );

    return {
      layout: 1,
      resizeKeyboard: true,
      message: this.t('fightOpponentDead'),
      ...opponentsActions
    };
  }

  getSurrenderMenu(backMenu) {
    return {
      layout: 2,
      resizeKeyboard: true,
      message: this.t('fightSurrenderQuestion'),
      [this.t('labelYes')]: () => {
        return this.playerSurrender();
      },
      [this.t('labelNo')]: () => {
        return this.sendMenu(backMenu);
      }
    };
  }

  getTurnFinishedMenu() {
    const finishedMenu = {
      layout: 1,
      message: this.t('fightTurnWaitingMessage'),
      resizeKeyboard: true,
      [this.t('labelSurrender')]: () =>
        this.sendMenu(this.getSurrenderMenu(finishedMenu))
    };

    return finishedMenu;
  }

  getGroupFightFinishMenu(customMessage) {
    const options = [
      {
        labelKey: 'labelFightDisable',
        messageKey: 'fightTurnMessagesDisabled',
        show: false
      },
      {
        labelKey: 'labelFightEnable',
        messageKey: 'fightTurnMessagesEnabled',
        show: true
      }
    ];

    const modesMenu = options.reduce((menu, { show, labelKey, messageKey }) => {
      const label = this.t(labelKey);
      return {
        ...menu,
        [label]: () => {
          const menuMessage = this.t(messageKey);
          const menu = this.getGroupFightFinishMenu(menuMessage);

          this.showFinishMenu = show;
          return this.sendMenu(menu);
        }
      };
    }, {});

    return {
      layout: 1,
      message: customMessage,
      resizeKeyboard: true,
      ...modesMenu
    };
  }
}

module.exports = FightMenuController;
