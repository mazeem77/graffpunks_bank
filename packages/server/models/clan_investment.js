const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const ClanInvestmentSchema = new Schema({
  userId: { type: String, required: true, index: true },
  clan: { type: Schema.Types.ObjectId, ref: 'Clan' },
  character: { type: Schema.Types.ObjectId, ref: 'Character' },
  investedGold: { type: Number, default: 0 },
  investedCredits: { type: Number, default: 0 }
});

module.exports = mongoose.model('ClanInvestment', ClanInvestmentSchema);
