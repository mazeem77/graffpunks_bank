'use strict';

/**
 * This object represents a Telegram user or bot.
 */

class User {
  /**
   *
   * @param {number} id
   * @param {string} firstName
   * @param {string|null} [lastName]
   * @param {string|null} [username]
   * @param {string|null} [languageCode]
   */
  constructor(id, firstName, lastName, username, languageCode) {
    this._id = id;
    this._firstName = firstName;
    this._lastName = lastName;
    this._username = username;
    this._languageCode = languageCode;
  }

  /**
   * Unique identifier for this user or bot
   * @returns {number}
   */
  get id() {
    return this._id;
  }

  /**
   * User‘s or bot’s first name
   * @returns {string}
   */
  get firstName() {
    return this._firstName;
  }

  /**
   * User‘s or bot’s last name
   * @returns {string|null}
   */
  get lastName() {
    return this._lastName;
  }

  /**
   * User‘s or bot’s username
   * @returns {string|null}
   */
  get username() {
    return this._username;
  }

  /**
   * User‘s or bot’s language_code
   * @returns {string|null}
   */
  get languageCode() {
    return this._languageCode;
  }

  /**
   *
   * @param {Object} raw
   * @returns {User}
   */
  static deserialize(raw) {
    return new User(
      raw['id'],
      raw['first_name'],
      raw['last_name'] ? raw['last_name'] : null,
      raw['username'] ? raw['username'] : null,
      raw['language_code'] ? raw['language_code'] : null
    );
  }

  /**
   *
   * @returns {Object}
   */
  serialize() {
    return {
      id: this.id ? this.id : undefined,
      first_name: this.firstName ? this.firstName : undefined,
      last_name: this.lastName ? this.lastName : undefined,
      username: this.username ? this.username : undefined,
      language_code: this.languageCode ? this.languageCode : undefined
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

module.exports = User;
