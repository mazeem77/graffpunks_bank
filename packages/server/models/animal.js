const mongoose = require('mongoose');

const { Schema } = mongoose;

const AnimalSchema = new Schema(
  {
    title: { type: Schema.Types.Mixed, required: true },
    icon: { type: String, required: true },
    masteryRequired: { type: Number, required: true },
    priceGold: { type: Number, required: true },
    priceCredits: { type: Number, required: true },
    minDamage: { type: Number, required: true },
    maxDamage: { type: Number, required: true },
    maxHealth: { type: Number, required: true }
  },
  {
    minimize: false
  }
);

AnimalSchema.methods.renderDetails = function(tx, params = {}) {
  const {
    title,
    masteryRequired,
    minDamage,
    maxDamage,
    maxHealth,
    priceGold,
    priceCredits
  } = this;
  const { showNumber, showPrice } = params;

  const number = showNumber ? `<b>${showNumber}.</b> ` : '';
  const price = showPrice
    ? `💰 ${tx.labelPrice}: ${priceGold} / 💎 ${priceCredits}\n`
    : '';

  const header = `${number}<b>${title[tx.lang]}</b>`;
  const mastery = `${tx.labelMasteryAnimalsRequired}: ${masteryRequired}`;
  const damage = `${tx.labelAnimalDamage}: ${minDamage}-${maxDamage}`;
  const health = `${tx.labelAnimalHealth}: ${maxHealth}`;

  return `${header}\n\n${price}${damage}\n${health}\n${mastery}`;
};

mongoose.Promise = global.Promise;

module.exports = mongoose.model('Animal', AnimalSchema);
