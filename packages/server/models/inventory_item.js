const mongoose = require('mongoose');
const { roundBy } = require('utils');

const { Schema } = mongoose;

const round = num => roundBy(num, 3);

const InventoryItemSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    data: { type: Schema.Types.ObjectId, ref: 'Item' },
    used: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    depreciation: { type: Number, default: 0, get: round, set: round },
    maxDepreciation: { type: Number }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

InventoryItemSchema.virtual('isGift').get(function() {
  return this.data && this.data.isGift;
});

InventoryItemSchema.virtual('isPotion').get(function() {
  return this.data && this.data.isPotion;
});

InventoryItemSchema.virtual('isBroken').get(function() {
  return this.depreciation >= this.maxDepreciation || this.used;
});

InventoryItemSchema.methods.isActive = function(items) {
  const { id, data } = this;
  return items[data.area] && items[data.area]._id.equals(id);
};

InventoryItemSchema.methods.getTitle = function(lang) {
  return this.data._title[lang];
};

InventoryItemSchema.methods.renderTag = function(lang) {
  return this.data.renderTag(lang);
};

InventoryItemSchema.methods.isSameItem = function(item) {
  return this.data._id.equals(item.data.id) && !this._id.equals(item.id);
};

InventoryItemSchema.methods.repair = async function() {
  this.depreciation = 0;
  this.maxDepreciation -= 1;
  this.used = this.maxDepreciation <= 1;

  await this.save();
};

mongoose.Promise = global.Promise;

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
