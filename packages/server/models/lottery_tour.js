const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const LotteryTourSchema = new Schema(
  {
    active: { type: Boolean, default: true },
    rates: {
      rate_lg: {
        amount: { type: Number, default: 10 },
        bank: { type: Number, default: 0 },
        players: [{ type: Schema.Types.ObjectId, ref: 'Character' }]
      },
      rate_md: {
        amount: { type: Number, default: 5 },
        bank: { type: Number, default: 0 },
        players: [{ type: Schema.Types.ObjectId, ref: 'Character' }]
      },
      rate_sm: {
        amount: { type: Number, default: 3 },
        bank: { type: Number, default: 0 },
        players: [{ type: Schema.Types.ObjectId, ref: 'Character' }]
      },
      rate_xs: {
        amount: { type: Number, default: 1 },
        bank: { type: Number, default: 0 },
        players: [{ type: Schema.Types.ObjectId, ref: 'Character' }]
      }
    }
  },
  {
    minimize: false,
    timestamps: { createdAt: '_created', updatedAt: '_updated' },
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

LotteryTourSchema.methods.getAgendaJob = async function() {
  const agenda = require('services/agenda');
  const jobs = await agenda.jobs({ name: 'daily_lottery' });
  return jobs && jobs[0];
};

LotteryTourSchema.methods.isTourMember = function(characterId) {
  const tourRates = this.rates.toObject();
  const tourPlayers = Object.keys(tourRates).reduce(
    (players, rate) => [...players, ...tourRates[rate].players],
    []
  );

  return tourPlayers.some(id => id.equals(characterId));
};

module.exports = mongoose.model('LotteryTour', LotteryTourSchema);
