const BaseCommand = require('./BaseCommand');

class TextArrayCommand extends BaseCommand {
  /**
   * @param {string} textPatternArray
   * @param {string} [handler]
   */
  constructor(textPatternArray, handler) {
    super();
    this._textPatternArray = textPatternArray;
    this._handler = handler;
  }

  /**
   * @param {Scope} scope
   * @returns {boolean}
   */
  test(scope) {
    if (scope.message.text) {
      return this._textPatternArray.some(
        pattern => scope.message.text === pattern
      );
    }

    return false;
  }

  /**
   * @returns {string}
   */
  get handlerName() {
    return this._handler;
  }
}

module.exports = TextArrayCommand;
