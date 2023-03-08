'use strict';

/**
 * This object represents Checkout Query Order.
 */

class OrderInfo {
  /**
   *
   * @param {string|null} name
   * @param {string|null} phoneNumber
   * @param {string|null} email
   */
  constructor(name, phoneNumber, email) {
    this._name = name;
    this._phoneNumber = phoneNumber;
    this._email = email;
  }

  /**
   * @returns {string|null}
   */
  get name() {
    return this._name;
  }

  /**
   * @returns {string|null}
   */
  get phoneNumber() {
    return this._phoneNumber;
  }

  /**
   * @returns {string|null}
   */
  get email() {
    return this._email;
  }

  /**
   *
   * @param {Object} raw
   * @returns {OrderInfo}
   */
  static deserialize(raw) {
    return new OrderInfo(
      raw['name'] ? raw['name'] : null,
      raw['phone_number'] ? raw['phone_number'] : null,
      raw['email'] ? raw['email'] : null
    );
  }

  /**
   *
   * @returns {Object}
   */
  serialize() {
    return {
      name: this.name ? this.name : undefined,
      phone_number: this.phoneNumber ? this.phoneNumber : undefined,
      email: this.email ? this.email : undefined
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

module.exports = OrderInfo;
