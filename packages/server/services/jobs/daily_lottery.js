const Random = require('random-js')();
const { round } = require('utils/index');
const LotteryTourModel = require('models/lottery_tour');
const { LOTTERY_COMMISSION_BASE } = require('data/settings');

const dailyLotteryJob = async (job, done) => {
  const lotteryTour = await LotteryTourModel.findOne({ active: true }).populate(
    {
      path:
        'rates.rate_xs.players rates.rate_sm.players rates.rate_md.players rates.rate_lg.players',
      populate: {
        path: 'clan'
      }
    }
  );

  if (lotteryTour) {
    const tourRates = lotteryTour.rates.toObject();

    Object.keys(tourRates).forEach(rateName => {
      const { bank, players } = lotteryTour.rates[rateName];

      if (players && players.length > 0) {
        const winner = Random.pick(players);

        const winnerTag = winner.renderTag();
        const goldReward = round(bank - (bank * LOTTERY_COMMISSION_BASE) / 100);

        players.forEach(character => {
          const isWinner = character.id === winner.id;

          if (isWinner) {
            character.inventory.gold += goldReward;
            character.save((err, saved) => {
              if (err) console.error(err);
              if (saved) {
                character.notify('dailyLotteryWinner', { goldReward });
              }
            });
          } else {
            character.notify('dailyLotteryFinish', { winnerTag, goldReward });
          }
        });

        lotteryTour.rates[rateName].bank = 0;
        lotteryTour.rates[rateName].players = [];
      }
    });

    await lotteryTour.save();
  }

  done();
};

module.exports = dailyLotteryJob;
