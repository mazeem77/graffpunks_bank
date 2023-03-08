const mongoose = require('mongoose');
const FEATURES = require('data/features');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const FeatureSchema = new Schema({
  name: { type: String, required: true, index: true },
  active: { type: Boolean, default: false },
  enoughGold: { type: Boolean, default: false },
  enoughUnits: { type: Boolean, default: false },
  bonusGold: { type: Number, default: 0 },
  bonusUnits: { type: Number, default: 0 },
  investments: [{ type: Schema.Types.ObjectId, ref: 'FeatureInvestment' }]
});

FeatureSchema.methods.getProgress = function() {
  return this.investments.reduce(
    (total, investment) => {
      total.gold += investment.gold;
      total.units += investment.units;
      return total;
    },
    {
      gold: this.bonusGold || 0,
      units: this.bonusUnits || 0
    }
  );
};

FeatureSchema.virtual('dataKey').get(function() {
  return Object.keys(FEATURES).find(id => FEATURES[id].name === this.name);
});

module.exports = mongoose.model('Feature', FeatureSchema);
