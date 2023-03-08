'use strict';

/**
 * This object represents Checkout Invoice.
 */

class Invoice {
  /**
   *
   * @param {string|null} title
   * @param {string|null} description
   * @param {string|null} startParameter
   * @param {string|null} currency
   * @param {number|null} totalAmount
   */
  constructor(title, description, startParameter, currency, totalAmount) {
    this._title = title;
    this._description = description;
    this._startParameter = startParameter;
    this._currency = currency;
    this._totalAmount = totalAmount;
  }

  /**
   * @returns {string|null}
   */
  get title() {
    return this._title;
  }

  /**
   * @returns {string|null}
   */
  get description() {
    return this._description;
  }

  /**
   * @returns {string|null}
   */
  get startParameter() {
    return this._startParameter;
  }

  /**
   * @returns {string|null}
   */
  get currency() {
    return this._currency;
  }

  /**
   * @returns {number|null}
   */
  get totalAmount() {
    return this._totalAmount;
  }

  /**
   *
   * @param {Object} raw
   * @returns {Invoice}
   */
  static deserialize(raw) {
    return new Invoice(
      raw['title'] ? raw['title'] : null,
      raw['phone_number'] ? raw['phone_number'] : null,
      raw['start_parameter'] ? raw['start_parameter'] : null,
      raw['currency'] ? raw['currency'] : null,
      raw['total_amount'] ? raw['total_amount'] : null
    );
  }

  /**
   *
   * @returns {Object}
   */
  serialize() {
    return {
      title: this.title ? this.title : undefined,
      description: this.description ? this.description : undefined,
      start_parameter: this.startParameter ? this.startParameter : undefined,
      currency: this.currency ? this.currency : undefined,
      total_amount: this.totalAmount ? this.totalAmount : undefined
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

module.exports = Invoice;
