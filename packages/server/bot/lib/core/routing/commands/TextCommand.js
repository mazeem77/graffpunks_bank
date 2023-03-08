'use strict';

const BaseCommand = require('./BaseCommand');

class TextCommand extends BaseCommand {
  /**
   * @param {string} textPattern
   * @param {string} [handler]
   */
  constructor(textPattern, handler) {
    super();

    this._textPattern = textPattern;
    this._handler = handler;
  }

  /**
   * @returns {string}
   */
  get handlerName() {
    return this._handler;
  }

  /**
   * @param {Scope} scope
   * @returns {boolean}
   */
  test(scope) {
    return (
      scope.message.text && scope.message.text.indexOf(this._textPattern) > -1
    );
  }
}

module.exports = TextCommand;
