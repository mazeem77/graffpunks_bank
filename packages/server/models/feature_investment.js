const mongoose = require('mongoose');
const { handleError } = require('utils');
const FEATURES = require('data/features');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const FeatureInvestmentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    feature: { type: Schema.Types.ObjectId, ref: 'Feature' },
    character: { type: Schema.Types.ObjectId, ref: 'Character' },
    gold: { type: Number, default: 0 },
    units: { type: Number, default: 0 },
    giftsTaken: { type: Number, default: 0 }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

FeatureInvestmentSchema.virtual('dataKey').get(function() {
  return Object.keys(FEATURES).find(id => FEATURES[id].name === this.name);
});

FeatureInvestmentSchema.virtual('gifts').get(function() {
  const featureData = FEATURES[this.dataKey];
  const giftsTotal = this.gold / featureData.giftGoalGold;

  return Math.floor(giftsTotal - this.giftsTaken);
});

FeatureInvestmentSchema.methods.giftsCount = async function() {
  const { gifts } = await this.model('FeatureInvestment')
    .findById(this.id, 'gold giftsTaken name')
    .exec();

  return gifts;
};

FeatureInvestmentSchema.pre('save', function(next) {
  if (this.isNew) {
    this.model('Feature').updateOne(
      { _id: this.feature },
      { $push: { investments: this.id } },
      handleError
    );
  }

  return next();
});

FeatureInvestmentSchema.post('save', async function(doc, next) {
  const feature = await this.model('Feature')
    .findById(this.feature)
    .populate({
      path: 'investments',
      populate: {
        path: 'character'
      }
    })
    .exec();

  const notifyInvestors = messageKey => {
    feature.investments.forEach(investment => {
      investment.character.notify(messageKey);
    });
  };

  const featureProgress = feature.getProgress();
  const featureData = FEATURES[feature.dataKey];

  const isGoldComplete = featureProgress.gold >= featureData.goldGoal;
  const isUnitsComplete = featureProgress.units >= featureData.unitsGoal;

  if (isGoldComplete && !feature.enoughGold) {
    await feature.updateOne({ enoughGold: true });
    notifyInvestors('proximoGoldComplete');
  }

  if (isUnitsComplete && !feature.enoughUnits) {
    await feature.updateOne({ enoughUnits: true });
    notifyInvestors('proximoMiningComplete');
  }

  if (isGoldComplete && isUnitsComplete) {
    await feature.updateOne({ active: true });
    notifyInvestors('proximoFeatureComplete');
  }

  return next();
});

module.exports = mongoose.model('FeatureInvestment', FeatureInvestmentSchema);
