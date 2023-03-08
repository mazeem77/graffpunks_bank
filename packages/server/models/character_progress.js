const mongoose = require('mongoose');

const { Schema } = mongoose;

const CharacterProgressSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    character: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    christmasGifts: [{ type: Schema.Types.ObjectId, ref: 'InventoryItem' }]
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

mongoose.Promise = global.Promise;

module.exports = mongoose.model('CharacterProgress', CharacterProgressSchema);
