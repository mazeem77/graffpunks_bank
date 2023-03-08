'use strict';

const BaseUpdateFetcher = require('./BaseUpdateFetcher');
const Update = require('../models/Update');

class WebhookUpdateHandler extends BaseUpdateFetcher {
  /**
   * @param {TelegramApi} api
   * @param {BaseLogger} logger
   * @param {string} url
   * @param {string} host
   * @param {number} port
   * @param {string} apiToken
   */
  constructor(api, logger, url, host, port, apiToken) {
    super(api, logger);

    this._url = url;
    this._host = host;
    this._port = port;
    this._apiToken = apiToken;
  }

  /**
   * @param {fetchUpdatesCallback} callback
   */
  fetch(callback) {
    this._callback = callback;
    this._getUpdates();
  }

  /**
   * @private
   */
  _getUpdates() {
    this._api
      .setWebhook({ url: this._url })
      .then(() => {
        this._logger.log({ WebhookUpdateHandler: `Started at ${this._port}` });
      })
      .catch(err => {
        this._logger.error({ webhook: err });
      });
  }

  /**
   * @param req
   * @param res
   */
  handleRequest(req, res) {
    const validateRegExp = new RegExp(this._apiToken);

    if (!validateRegExp.test(req.url)) {
      this._logger.error({ webhook: 'Not authorized request from Telegram' });
      res.status(401);
      res.end();
    } else {
      res.end('OK');

      const update = Update.deserialize(req.body);
      this._callback([update]);
    }
  }
}

module.exports = WebhookUpdateHandler;
