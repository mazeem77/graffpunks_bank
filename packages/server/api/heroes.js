const CharacterModel = require('models/character');

const HEROES_PER_PAGE = 100;

const SELECT_FIELDS = {
  inventory: 0,
  abilities: 0,
  masteryProgress: 0,
  availableSkills: 0
};

async function findOne(req, res) {
  const { userId } = req.params;

  const data = await CharacterModel.findOne({ userId }, SELECT_FIELDS)
    .populate('avatar')
    .populate({
      path: 'clan',
      select: 'name icon'
    })
    .populate({
      path: 'animal',
      populate: { path: 'data' }
    })
    .populate({
      path: 'items.weapon items.armor items.helmet items.gloves items.shield items.boots items.belt items.cloak items.amulet items.ring items.bag',
      populate: { path: 'data' }
    })
    .lean()
    .exec();

  return res.send({ data });
}

async function findMany(req, res) {
  const { sort = {}, page = 1 } = req.query;
  const populate = [{ path: 'clan', select: 'name icon' }, { path: 'avatar' }];

  const data = await CharacterModel.paginate(
    { deleted: false, 'stats.wins': { $gte: 0 } },
    {
      sort,
      populate,
      page,
      lean: true,
      select: SELECT_FIELDS,
      limit: HEROES_PER_PAGE
    }
  );

  return res.send({
    data
  });
}

module.exports = {
  findOne,
  findMany
};
