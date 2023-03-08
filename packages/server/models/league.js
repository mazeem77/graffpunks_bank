const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const LeagueSchema = new Schema({
  name: { type: String, required: true, unique: true, index: true },
  active: { type: Boolean, default: false },
  bank: {
    gold: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
  },
  seasons: [{ type: Schema.Types.ObjectId, ref: 'Season' }]
}, {
  minimize: false
});

module.exports = mongoose.model('League', LeagueSchema);
