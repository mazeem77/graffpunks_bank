const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const LeagueSeasonSchema = new Schema({
  finished: { type: Boolean, default: false },
  winner: { type: Schema.Types.ObjectId, ref: 'Character' }
}, {
  minimize: false
});

module.exports = mongoose.model('LeagueSeason', LeagueSeasonSchema);
