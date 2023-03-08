const mongoose = require('mongoose');

const { Schema } = mongoose;
const { handleError } = require('utils');
const { sendReportByUserId } = require('bot/helpers/reports');

const CharacterDailyQuestSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    data: { type: Schema.Types.ObjectId, ref: 'DailyQuest', required: true },
    completed: { type: Boolean, default: false },
    progress: { type: Number, default: 0 }
  },
  {
    minimize: false
  }
);

CharacterDailyQuestSchema.methods.getProgressLabel = function (tx) {
  return this.completed ? tx.labelQuestCompleted : `${this.progress} / ${this.data.progressGoal}`;
};

CharacterDailyQuestSchema.virtual('isGoalWins').get(function () {
  return this.data.type === 'wins';
});

CharacterDailyQuestSchema.pre('save', function (next) {
  if (this.isNew) {
    this.model('Character').updateOne(
      { userId: this.userId },
      {
        dailyQuest: this._id,
        dailyQuestApplied: true
      },
      handleError
    );
  }

  if (this.progress >= this.data.progressGoal) {
    this.completed = true;
    sendReportByUserId(this.userId, 'dailyQuestCompleted');
    return next();
  }

  return next();
});

CharacterDailyQuestSchema.pre('remove', async function () {
  await this.model('Character').updateOne({ userId: this.userId }, { dailyQuest: null }, handleError);
});

mongoose.Promise = global.Promise;

module.exports = mongoose.model('CharacterDailyQuest', CharacterDailyQuestSchema);
