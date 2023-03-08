const Polyglot = require('node-polyglot');

const { transformPhrase } = Polyglot;

const phrases = {
  common: {
    en: require('./phrases/common/en.json'),
    ru: require('./phrases/common/ru.json')
  },
  fight: {
    en: require('./phrases/fight/en.json'),
    ru: require('./phrases/fight/ru.json')
  }
};

const polyglot = new Polyglot({
  phrases: phrases
});

const translate = (locale, key, params, base = 'common') =>
  polyglot.t(`${base}.${locale}.${key}`, params);

/**
 * Get phrases by locale
 * @param {String} locale
 * @returns {Object} phrases
 */
const getPhrases = locale => phrases.common[locale];

const getFightPhrases = locale => phrases.fight[locale];

const getPhrasesData = () => phrases;

module.exports = {
  translate,
  transformPhrase,
  getPhrases,
  getPhrasesData,
  getFightPhrases
};
