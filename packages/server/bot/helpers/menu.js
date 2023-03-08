const FeatureModel = require('models/feature');
const { ARENA_PROXIMO } = require('data/features');

const sendMainMenu = ($, tx, options) => {
  const mainMenu = {
    layout: 2,
    message: options.message,
    resizeKeyboard: true,

    [tx.labelBank]: $ => {
      $.emulateUpdate();
    },
    [tx.labelHelp]: $ => {
      $.emulateUpdate();
    },
    [tx.labelSettings]: $ => {
      $.emulateUpdate();
    },
    [tx.labelGK]: $ => {
      $.emulateUpdate();
    }
  };

  $.runMenu(mainMenu, options.imageId);
};

const sendHeroMenu = ($, tx, options) => {
  const heroMenu = {
    layout: 2,
    message: options.message,
    resizeKeyboard: true,
    [tx.labelStats]: $ => {
      $.emulateUpdate();
    },
    [tx.labelSkills]: $ => {
      $.emulateUpdate();
    },
    [tx.labelProfile]: $ => {
      $.emulateUpdate();
    },
    [tx.labelInventory]: $ => {
      $.emulateUpdate();
    },
    [tx.labelMastery]: $ => {
      $.emulateUpdate();
    },
    [tx.labelAnimal]: $ => {
      $.emulateUpdate();
    },
    [tx.labelHeroAvatar]: $ => {
      $.emulateUpdate();
    },
    [tx.labelAbilities]: $ => {
      $.emulateUpdate();
    },
    [tx.labelBack]: $ => {
      sendMainMenu($, tx, {
        message: tx.mainMenuShortMessage
      });
    }
  };

  $.runMenu(heroMenu);
};

const sendTownMenu = ($, tx, options) => {
  const townMenu = {
    layout: 3,
    message: options.message,
    resizeKeyboard: true,
    [tx.labelShop]: $ => {
      $.emulateUpdate();
    },
    [tx.labelLottery]: $ => {
      $.emulateUpdate();
    },
    [tx.labelAcademy]: $ => {
      $.emulateUpdate();
    },
    [tx.labelTownhall]: $ => {
      $.emulateUpdate();
    },
    [tx.labelTemple]: $ => {
      $.emulateUpdate();
    },
    [tx.labelTavern]: $ => {
      $.emulateUpdate();
    },
    [tx.labelAnimalsShop]: $ => {
      $.emulateUpdate();
    },
    [tx.labelBank]: $ => {
      $.emulateUpdate();
    },
    [tx.labelMenu]: $ => {
      sendMainMenu($, tx, {
        message: tx.mainMenuShortMessage
      });
    }
  };

  $.runMenu(townMenu, options.imageId);
};

const sendConfirmMenu = ($, tx, message, onAccept, onDecline) => {
  const confirmMenu = {
    message,
    layout: 2,
    resizeKeyboard: true,
    [tx.labelYes]: $ => onAccept($),
    [tx.labelNo]: $ => onDecline($)
  };

  $.runMenu(confirmMenu);
};

const sendArenaMenu = async ($, tx, params = {}) => {
  const feature = await FeatureModel.findOne({
    name: ARENA_PROXIMO.name
  }).exec();

  const isProximoActive = feature && feature.active;
  const menuMessage = isProximoActive ? tx.arenaMenuDefaultMessage : tx.arenaMenuConstructionMessage;

  const arenaMenu = {
    layout: 1,
    resizeKeyboard: true,
    message: params.message || menuMessage,
    [tx.labelArenaMaximus]: $ => {
      $.emulateUpdate();
    },
    [tx.labelArenaProximo]: $ => {
      $.emulateUpdate({ feature });
    },
    [tx.labelBack]: $ => {
      sendMainMenu($, tx, {
        message: tx.arenaMenuMessageBack
      });
    }
  };

  $.runMenu(arenaMenu);
};

module.exports = {
  sendMainMenu,
  sendHeroMenu,
  sendTownMenu,
  sendConfirmMenu,
  sendArenaMenu
};
