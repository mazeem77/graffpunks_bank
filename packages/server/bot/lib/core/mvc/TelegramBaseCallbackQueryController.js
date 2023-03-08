/**
 * Base Callback Query Controller
 * you must extend TelegramBaseCallbackQueryController
 * to create callback query controller.
 */
class TelegramBaseCallbackQueryController {
  constructor() {
    this._api = null;
  }

  /**
   * This method of your controller will be called to handle callbackQuery.
   *
   * @param {CallbackQuery} query
   */
  handle(query) {
    throw 'Not implemented';
  }

  /**
   *
   * @param {TelegramApi} api
   */
  set api(api) {
    this._api = api;
  }

  get api() {
    return this._api;
  }
}

module.exports = TelegramBaseCallbackQueryController;
