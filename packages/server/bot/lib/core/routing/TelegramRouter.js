'use strict';

const TelegramRoute = require('./TelegramRoute');
const AnyCommand = require('./commands/AnyCommand');

class TelegramRouter {
  constructor() {
    /**
     * @type {TelegramRoute[]}
     * @private
     */
    this._routes = [];

    /**
     * @type {TelegramBaseController}
     * @private
     */
    this._otherwiseController = null;

    this._callbackQueryController = null;
    this._inlineQueryController = null;
    this._preCheckoutQueryController = null;

    this._middlewareController = null;
  }

  /**
   * You can pass your command pattern or array of patterns
   * and some child of TelegramBaseController
   *
   * After that any update that satisfies your command
   * will be passed to your controller
   *
   * @param {BaseCommand|BaseCommand[]} commands
   * @param {TelegramBaseController} controller
   * @returns {TelegramRouter}
   */
  when(commands, controller) {
    this._routes.push(new TelegramRoute(commands, controller));

    return this;
  }

  /**
   * This child of TelegramBaseController will be called for all updates
   *
   * @param {TelegramBaseController} controller
   * @returns {TelegramRouter}
   */
  any(controller) {
    this._routes.push(new TelegramRoute(new AnyCommand(), controller));

    return this;
  }

  /**
   * This child of TelegramBaseController will be called
   * if there is no controller for that update (except controller passed to 'any' method)
   *
   * @param {TelegramBaseController} controller
   * @returns {TelegramRouter}
   */
  otherwise(controller) {
    this._otherwiseController = controller;

    return this;
  }

  middleware(controller) {
    this._middlewareController = controller;

    return this;
  }

  /**
   * This child of TelegramBaseCallbackQueryController will be called for all callback queries
   *
   * @param {TelegramBaseCallbackQueryController} controller
   */
  callbackQuery(controller) {
    this._callbackQueryController = controller;
    return this;
  }

  /**
   * This child of TelegramBaseInlineQueryController will be called for all inline queries
   *
   * @param {TelegramBaseInlineQueryController} controller
   * @returns {TelegramRouter}
   */
  inlineQuery(controller) {
    this._inlineQueryController = controller;
    return this;
  }

  /**
   * This child of TelegramBasePreCheckoutQueryController will be called for all pre checkout queries
   *
   * @param {TelegramBasePreCheckoutQueryController} controller
   */
  preCheckoutQuery(controller) {
    this._preCheckoutQueryController = controller;
    return this;
  }

  /**
   *
   * @returns {TelegramBaseCallbackQueryController|null}
   */
  get callbackQueryController() {
    return this._callbackQueryController;
  }

  /**
   *
   * @returns {TelegramBaseInlineQueryController|null}
   */
  get inlineQueryController() {
    return this._inlineQueryController;
  }

  /**
   *
   * @returns {TelegramBasePreCheckoutQueryController|null}
   */
  get preCheckoutQueryController() {
    return this._preCheckoutQueryController;
  }

  getRouteController(scope) {
    const route = this._routes.find(_route => _route.test(scope));

    if (route) {
      const command = route.test(scope);

      let controllerRoutes = route.controller.routes;
      let controllerHandler;

      if (controllerRoutes && controllerRoutes[command.handlerName]) {
        controllerHandler = controllerRoutes[command.handlerName];
      } else {
        controllerHandler = 'handle';
      }

      return {
        controller: route.controller,
        handler: controllerHandler
      };
    }
  }

  /**
   * @param {Scope} scope
   * @returns {Object} controller
   */
  controllersForScope(scope) {
    let controller = this.getRouteController(scope);

    if (!controller && this._otherwiseController !== null) {
      controller = {
        controller: this._otherwiseController,
        handler: 'handle'
      };
    }

    return controller;
  }
}

module.exports = TelegramRouter;
