const { getPhrasesData } = require('i18n/translate');

async function getTranslations(req, res) {
  const data = getPhrasesData();

  res.send({
    data
  });
}

module.exports = {
  getTranslations
};
