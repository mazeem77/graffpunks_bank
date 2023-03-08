'use strict';

const User = require('./User');
const OrderInfo = require('./OrderInfo');

/**
 * This object represents an incoming callback query from a callback button in an inline keyboard. If the button that originated the query was attached to a message sent by the bot, the field message will be present. If the button was attached to a message sent via the bot (in inline mode), the field inline_message_id will be present. Exactly one of the fields data or game_short_name will be present.
 */

class PreCheckoutQuery {
  /**
   *
   * @param {string} id
   * @param {User} from
   * @param {string} currency
   * @param {number} total_amount
   * @param {string} invoicePayload
   * @param {string} shippingOptionId
   * @param {OrderInfo} orderInfo
   */
  constructor(
    id,
    from,
    currency,
    total_amount,
    invoicePayload,
    shippingOptionId,
    orderInfo
  ) {
    this._id = id;
    this._from = from;
    this._currency = currency;
    this._totalAmount = total_amount;
    this._invoicePayload = invoicePayload;
    this._shippingOptionId = shippingOptionId;
    this._orderInfo = orderInfo;
  }

  /**
   * Unique identifier for this query
   * @returns {string}
   */
  get id() {
    return this._id;
  }

  /**
   * Sender
   * @returns {User}
   */
  get from() {
    return this._from;
  }

  /**
   * Three-letter ISO 4217 currency code
   * @returns {string}
   */
  get currency() {
    return this._currency;
  }

  /**
   * @returns {string}
   * Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies)
   */
  get totalAmount() {
    return this._totalAmount;
  }

  /**
   * @returns {string}
   * Bot specified invoice payload
   */
  get invoicePayload() {
    return this._invoicePayload;
  }

  /**
   * @returns {string|null}
   * Identifier of the shipping option chosen by the user
   */
  get shippingOptionId() {
    return this._shippingOptionId;
  }

  /**
   * @returns {OrderInfo|null}
   * Order info provided by the user
   */
  get orderInfo() {
    return this._orderInfo;
  }

  /**
   *
   * @param {Object} raw
   * @returns {PreCheckoutQuery}
   */
  static deserialize(raw) {
    return new PreCheckoutQuery(
      raw['id'],
      raw['from'] ? User.deserialize(raw['from']) : null,
      raw['currency'] ? raw['currency'] : null,
      raw['total_amount'] ? raw['total_amount'] : null,
      raw['invoice_payload'] ? raw['invoice_payload'] : null,
      raw['shipping_option_id'] ? raw['shipping_option_id'] : null,
      raw['order_info'] ? OrderInfo.deserialize(raw['order_info']) : null
    );
  }

  /**
   *
   * @returns {Object}
   */
  serialize() {
    return {
      id: this.id ? this.id : undefined,
      from: this.from ? this.from.serialize() : undefined,
      currency: this.currency ? this.currency : undefined,
      total_amount: this.totalAmount ? this.totalAmount : undefined,
      invoice_payload: this.invoicePayload ? this.invoicePayload : undefined,
      shipping_option_id: this.shippingOptionId
        ? this.shippingOptionId
        : undefined,
      order_info: this.orderInfo ? this.orderInfo : undefined
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

module.exports = PreCheckoutQuery;
