class InputMediaPhoto {
  /**
   *
   * @param {string} type
   * @param {string} media
   * @param {string|null} [caption]
   * @param {string|null} [parseMode]
   */
  constructor(type, media, caption, parseMode) {
    this._type = type;
    this._media = media;
    this._caption = caption;
    this._parseMode = parseMode;
  }

  /**
   * @returns {string}
   */
  get type() {
    return this._type;
  }

  /**
   * @returns {string}
   */
  get media() {
    return this._media;
  }

  /**
   * @returns {string|null}
   */
  get caption() {
    return this._caption;
  }

  /**
   * @returns {string|null}
   */
  get parseMode() {
    return this._parseMode;
  }

  /**
   *
   * @param {Object} raw
   * @returns {InputMediaPhoto}
   */
  static deserialize(raw) {
    return new InputMediaPhoto(
      raw['type'],
      raw['media'],
      raw['caption'] || null,
      raw['parse_mode'] || null
    );
  }

  /**
   *
   * @returns {Object}
   */
  serialize() {
    return {
      type: this.type,
      media: this.media,
      caption: this.caption || undefined,
      parse_mode: this.parseMode || undefined
    };
  }

  /**
   *
   * @returns {string}
   */
  toJSON() {
    return this.serialize();
  }
}

module.exports = InputMediaPhoto;
