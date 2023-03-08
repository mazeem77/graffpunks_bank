const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const AssetBurnSchema = new Schema(
  {
    wallet: { type: String, required: true },
    assetId: { type: String, required: true },
    templateId: { type: String, required: true },
    collectionName: { type: String, required: true },
    rewarded: { type: Boolean, default: false }
  },
  {
    minimize: false,
    timestamps: true
  }
);

module.exports = mongoose.model('AssetBurn', AssetBurnSchema);
