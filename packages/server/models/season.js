const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const SeasonSchema = new Schema({
  name: {},
  number: { type: Number, required: true },
  active: { type: Boolean, default: true },
  finished: { type: Boolean, default: false },
  finish_at: { type: String, required: true },
  finish_at_date: { type: String, required: true },
  legends: {
    clan: { type: Schema.Types.ObjectId, ref: 'Clan' },
    character: { type: Schema.Types.ObjectId, ref: 'Character' }
  }
}, {
  minimize: false
});

module.exports = mongoose.model('Season', SeasonSchema);
