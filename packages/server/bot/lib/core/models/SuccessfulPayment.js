'use strict';

const OrderInfo = require('./OrderInfo');

/**
 * This object represents Checkout Successful Payment.
 */

class SuccessfulPayment {
  /**
   *
   * @param {string|null} currency
   * @param {number|null} totalAmount
   * @param {number|null} totalAmount
   * @param {string} invoicePayload
   * @param {string|null} shippingOptionId
   * @param {OrderInfo|null} orderInfo
   * @param {string} telegramPaymentChargeId
   * @param {string} providerPaymentChargeId
   */
  constructor(
    currency,
    totalAmount,
    invoicePayload,
    shippingOptionId,
    orderInfo,
    telegramPaymentChargeId,
    providerPaymentChargeId
  ) {
    this._currency = currency;
    this._totalAmount = totalAmount;
    this._invoicePayload = invoicePayload;
    this._shippingOptionId = shippingOptionId;
    this._orderInfo = orderInfo;
    this._telegramPaymentChargeId = telegramPaymentChargeId;
    this._providerPaymentChargeId = providerPaymentChargeId;
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
   * @returns {string}
   * Telegram payment identifier
   */
  get telegramPaymentChargeId() {
    return this._telegramPaymentChargeId;
  }

  /**
   * @returns {string}
   * Provider payment identifier
   */
  get providerPaymentChargeId() {
    return this._providerPaymentChargeId;
  }

  /**
   *
   * @param {Object} raw
   * @returns {SuccessfulPayment}
   */
  static deserialize(raw) {
    return new SuccessfulPayment(
      raw['currency'] ? raw['currency'] : null,
      raw['total_amount'] ? raw['total_amount'] : null,
      raw['invoice_payload'] ? raw['invoice_payload'] : null,
      raw['shipping_option_id'] ? raw['shipping_option_id'] : null,
      raw['order_info'] ? OrderInfo.deserialize(raw['order_info']) : null,
      raw['telegram_payment_charge_id']
        ? raw['telegram_payment_charge_id']
        : null,
      raw['provider_payment_charge_id']
        ? raw['provider_payment_charge_id']
        : null
    );
  }

  /**
   *
   * @returns {Object}
   */
  serialize() {
    return {
      currency: this.currency ? this.currency : undefined,
      total_amount: this.totalAmount ? this.totalAmount : undefined,
      invoice_payload: this.invoicePayload ? this.invoicePayload : undefined,
      shipping_option_id: this.shippingOptionId
        ? this.shippingOptionId
        : undefined,
      order_info: this.orderInfo ? this.orderInfo : undefined,
      telegram_payment_charge_id: this.telegramPaymentChargeId
        ? this.telegramPaymentChargeId
        : undefined,
      provider_payment_charge_id: this.providerPaymentChargeId
        ? this.providerPaymentChargeId
        : undefined
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

module.exports = SuccessfulPayment;
