const mongoose = require('mongoose');

const { Schema } = mongoose;

const LOOT_TYPES = {
  gold: { icon: '💰' },
  credits: { icon: '💎' },
  item: {},
  potion: {}
};

const LootItemSchema = new Schema(
  {
    data: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
    active: { type: Boolean, default: true },
    type: { type: String, default: 'item' },
    quantity: { type: Number, default: 1 },
    dropChance: { type: Number, default: 1 },
    dropCount: { type: Number, default: 0 },
    rarity: { type: Number, default: 1 },
    title: { type: Schema.Types.Mixed },
    description: { type: Schema.Types.Mixed },
    name: { type: String, default: null },
    event: { type: String, default: null }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

LootItemSchema.virtual('isItem').get(function() {
  return this.type === 'item';
});

LootItemSchema.virtual('isPotion').get(function() {
  return this.type === 'potion';
});

LootItemSchema.virtual('isGold').get(function() {
  return this.type === 'gold';
});

LootItemSchema.virtual('isCredits').get(function() {
  return this.type === 'credits';
});

LootItemSchema.methods.getTypeData = function() {
  return LOOT_TYPES[this.type];
};

LootItemSchema.methods.renderTag = function(lang, params = {}) {
  const { isFormatted } = params;
  const { data, title, quantity } = this;

  const { icon } = data ? data.getTypeData() : this.getTypeData();
  const itemTitle = data ? data._title[lang] : title[lang];
  const itemQuantity = isFormatted ? `<b>(${quantity})</b>` : `(${quantity})`;

  return `${icon} ${itemTitle} ${itemQuantity}`;
};

mongoose.Promise = global.Promise;

module.exports = mongoose.model('LootItem', LootItemSchema);
