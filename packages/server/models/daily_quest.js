const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const DailyQuestSchema = new Schema({
  active: { type: Boolean, default: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  oneTime: { type: Boolean, default: false },
  title: { type: Schema.Types.Mixed, required: true },
  description: { type: Schema.Types.Mixed, required: true },
  goalText: { type: Schema.Types.Mixed, required: true },
  progressGoal: { type: Number, required: true },
  rewards: {
    gold: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }
  }
}, {
  minimize: false
});

module.exports = mongoose.model('DailyQuest', DailyQuestSchema);
