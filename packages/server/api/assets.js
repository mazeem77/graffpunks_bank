const { mintAsset } = require('../services/tokens');

async function mint(req, res) {
  const { account, type = 'common', templateId } = req.body;

  await mintAsset({ account }, type, templateId);

  res.end('Done');
}

module.exports = {
  mint
};
