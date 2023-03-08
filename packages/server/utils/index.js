const moment = require('moment');
const humanizeDuration = require('humanize-duration');

const humanize = humanizeDuration.humanizer({
  languages: {
    'short-en': {
      y: () => 'y',
      mo: () => 'mo',
      w: () => 'w',
      d: () => 'd',
      h: () => 'h',
      m: () => 'm',
      s: () => 'sec',
      ms: () => 'ms'
    },
    'short-ru': {
      y: () => 'г',
      mo: () => 'м',
      w: () => 'нед.',
      d: () => 'д',
      h: () => 'ч',
      m: () => 'мин',
      s: () => 'сек',
      ms: () => 'мс'
    }
  }
});

const humanizeTime = (time, params) => humanize(time, params);

const hasProp = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

const isInRange = (value, min, max) => value >= min && value <= max;

const round = num => Number(Math.round(num + 'e1') + 'e-1');

const getTimeSeconds = value => Number(value) / 1000;

const getTimeMinutes = value => Math.round(value / 1000 / 60);

const roundBy = (value, precision = 0) => {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
};

const getTimeLeft = (endDate, params) => {
  const timeDiff = moment().diff(endDate);
  return humanizeTime(timeDiff, params);
};

const getValueByPercentage = (value, percentage) => {
  return Math.round((value * percentage) / 100);
};

const getPercentageByValue = (maxValue, value, precision = 0) => {
  const percentage = (value * 100) / maxValue;
  return roundBy(percentage, precision);
};

const sleep = cb => new Promise(resolve => setTimeout(resolve, cb));

const to = promise => promise.then(data => [null, data]).catch(err => [err]);

const handleError = err => {
  if (err) {
    console.error(err);
  }
};

const saveAsync = async (docs, save) => {
  await Promise.all(
    docs.map(async (doc, index) => {
      await save(doc, index);
    })
  );
};

const isEven = n => n % 2 === 0;
const isOdd = n => Math.abs(n % 2) === 1;

const dot = str => (str.length > 0 ? `. ${str}` : str);

const sign = (value, bonus) =>
  value > 0 ? `+${value}${bonus ? ` (${bonus})` : ''}` : value;

module.exports = {
  dot,
  sign,
  to,
  sleep,
  round,
  roundBy,
  isOdd,
  isEven,
  isInRange,
  handleError,
  hasProp,
  humanizeTime,
  getTimeLeft,
  getTimeSeconds,
  getTimeMinutes,
  getValueByPercentage,
  getPercentageByValue,
  saveAsync
};
