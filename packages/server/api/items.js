const ItemModel = require('../models/item');

async function findMany(req, res) {
  const { category, type, features, level } = req.query;
  const searchParams = {};

  if (category) searchParams.category = category;

  if (type === 'two-handed') {
    searchParams.twoHanded = true;
  }

  if (type === 'one-handed') {
    searchParams.twoHanded = false;
  }

  if (features === 'artefact') {
    searchParams.artefact = true;
  }

  if (features === 'from-set') {
    searchParams['superset.id'] = { $exists: true };
  }

  if (level) {
    searchParams.$or = [
      { requirements: { $elemMatch: { id: 'level', value: Number(level) } } },
      { level: Number(level) }
    ];
  }

  const items = await ItemModel.find(searchParams);

  res.send({
    data: items
  });
}

module.exports = {
  findMany
};
