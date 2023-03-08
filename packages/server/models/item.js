const mongoose = require('mongoose');

const { Schema } = mongoose;
const { getItemTypeData, getRarityLabel } = require('bot/helpers/items');

mongoose.Promise = global.Promise;

const ItemSchema = new Schema(
  {
    _title: { type: Schema.Types.Mixed, required: true },
    _description: { type: Schema.Types.Mixed, required: false },
    name: { type: String, required: false },
    price: { type: Number, required: true },
    weight: { type: Number, required: true },
    type: { type: String, required: true },
    potionType: { type: String, default: '' },
    area: { type: String, required: false },
    category: { type: String, required: true },
    level: { type: Number, required: true },
    minDurability: { type: Number, default: 0 },
    maxDurability: { type: Number, required: true },
    twoHanded: { type: Boolean, default: false },
    display: { type: Boolean, default: true },
    onlyPlayers: { type: Boolean, default: false },
    onlyCredits: { type: Boolean, default: false },
    artefact: { type: Boolean, default: false },
    priceCredits: { type: Number, default: 1 },
    rarity: { type: Number, default: 1 },
    giftSize: { type: String, enum: ['sm', 'md', 'lg'] },
    giftEvent: { type: String, default: null },
    features: [],
    requirements: [],
    effects: [],
    superset: {
      id: { type: String },
      quantity: { type: Number },
      effects: []
    }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

ItemSchema.virtual('isGift').get(function () {
  return this.type === 'gift';
});

ItemSchema.virtual('isPotion').get(function () {
  return this.type === 'potion';
});

ItemSchema.virtual('isAbilityPotion').get(function () {
  return this.potionType === 'ability';
});

ItemSchema.virtual('isProximoWeapon').get(function () {
  const proximoWeapon = this.features && this.features.find(feature => feature.id === 'proximoWeapon');
  return !!proximoWeapon;
});

ItemSchema.virtual('isMiningEquipment').get(function () {
  const forMining = this.effects && this.effects.find(effect => effect.id === 'mining');
  return this.type === 'equipment' && forMining;
});

ItemSchema.virtual('isEquipment').get(function () {
  return this.type === 'equipment';
});

ItemSchema.virtual('isFromSuperset').get(function () {
  return (this.superset && this.superset.id) || false;
});

ItemSchema.virtual('levelRequired').get(function () {
  const levelRequirement = this.requirements.find(param => param.id === 'level');
  return levelRequirement ? levelRequirement.value : null;
});

ItemSchema.virtual('priceCreditsCalculated').get(function () {
  const priceCredits = Math.round(this.price / 25);
  return priceCredits >= 1 ? priceCredits : 1;
});

ItemSchema.methods.renderTag = function (lang) {
  const { icon } = getItemTypeData(this.type);
  return `${icon} ${this._title[lang]}`;
};

ItemSchema.methods.getTypeData = function () {
  return getItemTypeData(this.type);
};

ItemSchema.methods.getRarityLabel = function (tx) {
  return getRarityLabel(this.rarity, tx);
};

module.exports = mongoose.model('Item', ItemSchema);
