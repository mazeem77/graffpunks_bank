'use strict';

const BaseUpdateProcessor = require('./BaseUpdateProcessor');

class PreCheckoutQueryUpdateProcessor extends BaseUpdateProcessor {
  /**
   *
   * @param {BaseTelegramDataSource} dataSource
   */
  constructor(dataSource) {
    super(dataSource);
  }

  /**
   *
   * @param {Update} update
   */
  process(update) {
    if (update.preCheckoutQuery) {
      this._dataSource.api.answerPreCheckoutQuery(update.preCheckoutQuery.id, {
        ok: true
      });
    }
  }

  /**
   *
   * @param {Update} update
   * @returns {boolean}
   */
  supports(update) {
    return !!update.preCheckoutQuery;
  }
}

module.exports = PreCheckoutQueryUpdateProcessor;
