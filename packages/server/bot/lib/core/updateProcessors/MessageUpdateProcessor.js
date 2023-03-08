const BaseUpdateProcessor = require('./BaseUpdateProcessor');
const Scope = require('../mvc/Scope');

const CLEAR_CALLBACK_QUERIES_TS = 900000; // 15 minutes
const CLEAR_CALLBACK_QUERIES_INTERVAL = 60000; // 1 minute

class MessageUpdateProcessor extends BaseUpdateProcessor {
  /**
   *
   * @param {BaseTelegramDataSource} dataSource
   */
  constructor(dataSource) {
    super(dataSource);

    this._waitingRequests = {};
    this._waitingCallbackQueries = {};

    this.initCallbackQueriesCleaner();
  }

  initCallbackQueriesCleaner() {
    setInterval(
      () => this.clearWaitingCallbackQueries(),
      CLEAR_CALLBACK_QUERIES_INTERVAL
    );
  }

  clearWaitingCallbackQueries() {
    const ts = Date.now();

    for (const cid in this._waitingCallbackQueries) {
      if (this._waitingCallbackQueries[cid]) {
        const isOutdated =
          ts - this._waitingCallbackQueries[cid].ts > CLEAR_CALLBACK_QUERIES_TS;

        if (isOutdated) {
          delete this._waitingCallbackQueries[cid];
        }
      }
    }
  }

  /**
   *
   * @param {Update} update
   * @param {Object} [params]
   */
  process(update, params = {}) {
    if (
      update.editedMessage ||
      (update.message && !update.message.successfulPayment)
    ) {
      let message = update.message || update.editedMessage;

      let scope = new Scope(
        update,
        params,
        this._dataSource.api,
        this._dataSource.scopeExtensions,
        this._dataSource.files,
        this._waitingRequests,
        this._waitingCallbackQueries,
        this._dataSource.logger,
        this._dataSource.sessionStorage
        // chatId => this._waitForUpdate(chatId),
        // data => this._waitForCallback(data)
      );

      scope.emulateUpdate = params => {
        return this.process(update, params);
      };

      scope.emulateCommand = (commandText, params) => {
        update.messageText = commandText;

        return this.process(update, params);
      };

      const chatId = message.chat.id;

      if (this._waitingRequests[chatId] && !scope.isBotCommand(message)) {
        const callback = this._waitingRequests[chatId];
        callback(scope);

        if (typeof this._waitingRequests[chatId] === 'function') {
          delete this._waitingRequests[chatId];
        }

        scope = null;

        return;
      }

      const updateController = this._dataSource.router.controllersForScope(
        scope
      );
      const updateAllowed = this._dataSource.router._middlewareController.isUpdateAllowed(
        scope
      );

      if (updateController && updateAllowed) {
        try {
          updateController.controller.api = this._dataSource.api;
          updateController.controller.localization = this._dataSource.localization;

          updateController.controller
            .before(scope)
            .then(_scope =>
              updateController.controller[updateController.handler](_scope)
            );
        } catch (e) {
          this._dataSource.logger.error({
            error: e,
            'in controller': updateController,
            'for update': update
          });
        }

        if (!updateController) {
          this._dataSource.logger.warn({
            'Cant find controller for update': update
          });
        }
      }

      scope = null;

      return;
    }

    if (update.message && update.message.successfulPayment) {
      if (
        this._waitingCallbackQueries[
          update.message.successfulPayment.invoicePayload
        ] &&
        this._waitingCallbackQueries[
          update.message.successfulPayment.invoicePayload
        ].cb
      ) {
        this._waitingCallbackQueries[
          update.message.successfulPayment.invoicePayload
        ].cb(update.message.successfulPayment);

        return;
      }
    }

    if (update.callbackQuery) {
      if (
        this._waitingCallbackQueries[update.callbackQuery.data] &&
        this._waitingCallbackQueries[update.callbackQuery.data].cb
      ) {
        this._waitingCallbackQueries[update.callbackQuery.data].cb(
          update.callbackQuery
        );

        return;
      }

      if (this._dataSource.router.callbackQueryController) {
        if (!this._dataSource.router.callbackQueryController.api) {
          this._dataSource.router.callbackQueryController.api = this._dataSource.api;
        }

        try {
          this._dataSource.router.callbackQueryController.handle(
            update.callbackQuery
          );
        } catch (e) {
          this._dataSource.logger.error({
            error: e,
            'in controller': this._dataSource.router.callbackQueryController,
            'for update': update
          });
        }
      }

      return;
    }

    this._dataSource.logger.warn({ 'Update was not handled': update });
  }

  /**
   *
   * @param {Update} update
   */
  supports(update) {
    return !!(update.message || update.editedMessage || update.callbackQuery);
  }

  /**
   * @param {number} chatId
   * @private
   */
  // _waitForUpdate(chatId) {
  //     // this._dataSource.ipc.askForNextUpdate(chatId)
  // }

  /**
   * @param {string} data
   * @private
   */
  // _waitForCallback(data) {
  //     // this._dataSource.ipc.askForNextCallbackQuery(data)
  // }
}

module.exports = MessageUpdateProcessor;
