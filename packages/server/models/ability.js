const mongoose = require('mongoose');
const Random = require('random-js')();
const humanInterval = require('human-interval');
const { getTimeLeft, humanizeTime } = require('utils');
const { translate } = require('i18n/translate');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const AbilitySchema = new Schema(
  {
    name: { type: String, required: true, index: true },
    title: { type: Schema.Types.Mixed, required: true },
    description: { type: Schema.Types.Mixed, required: true },
    effects: { type: Array, default: [] },
    offers: { type: Array, default: [] }
  },
  {
    minimize: false
  }
);

AbilitySchema.statics.getRandom = async function (characterAbilities) {
  const abilities = await this.find({ _id: { $nin: characterAbilities } });
  return Random.pick(abilities);
};

AbilitySchema.methods.renderDetails = function (tx, params) {
  const { title, description, offers } = this;
  const { lang, labelTimeLeft, labelActive } = tx;
  const { showNumber, abilityJob } = params;

  const number = showNumber ? ` (${showNumber})` : '';

  if (abilityJob) {
    const timeLeft = getTimeLeft(abilityJob.attrs.nextRunAt, {
      units: ['h', 'm'],
      language: lang,
      round: true
    });

    const header = `${title[lang]}${number} — ${labelActive}`;
    const details = `<b>${labelTimeLeft} ⏳ ${timeLeft}</b>`;

    return {
      message: `<b>${header}</b>\n\n${description[lang]}\n\n${details}`,
      buttons: []
    };
  }

  const header = `${title[tx.lang]}${number}`;

  return offers.reduce(
    ({ message, buttons }, offer) => {
      const { duration, priceCredits } = offer;
      const durationMs = humanInterval(duration);
      const durationText = humanizeTime(durationMs, {
        units: ['h'],
        language: lang,
        round: true
      });

      const creditsText = translate(lang, 'smartCredits', {
        smart_count: priceCredits
      });

      return {
        message: `${message}\n🔸 <b>${durationText}</b> — ${creditsText}`,
        buttons: [...buttons, { offer, durationText, creditsText }]
      };
    },
    {
      message: `<b>${header}</b>\n\n${description[tx.lang]}\n`,
      buttons: []
    }
  );
};

module.exports = mongoose.model('Ability', AbilitySchema);
