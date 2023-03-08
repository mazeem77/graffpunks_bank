'use strict';

const BaseCommand = require('./BaseCommand');

class ParamsCommand extends BaseCommand {
  /**
   * @param {string} textPattern
   * @param {string} [handler]
   */
  constructor(textPattern, handler) {
    super();

    this._commandPattern = this.getCommand(textPattern);
    this._commandParamsPattern = this.parseParams(textPattern);
    this._handler = handler;
  }

  /**
   * @returns {string}
   */
  get handlerName() {
    return this._handler;
  }

  parseParams(text) {
    return text
      .replace(this._commandPattern, '')
      .trim()
      .split(' ');
  }

  getCommand(text) {
    return text.split(' ')[0];
  }

  getParams(messageText) {
    const messageParams = this.parseParams(messageText);

    return this._commandParamsPattern.reduce((params, param, index) => {
      params[param] = messageParams[index];
      return params;
    }, {});
  }

  /**
   * @param {Scope} scope
   * @returns {boolean}
   */
  test(scope) {
    if (scope.isBotCommand()) {
      const command = this.getCommand(scope.message.text);

      if (command.indexOf(this._commandPattern) > -1) {
        const params = this.getParams(scope.message.text);
        scope.setCommandParams(params);

        return true;
      }
    }

    return false;
  }
}

module.exports = ParamsCommand;
