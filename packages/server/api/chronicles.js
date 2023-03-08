const ChronicleModel = require('models/chronicle');

const DOCS_PER_PAGE = 100;

async function findMany(req, res) {
  const { page = 1 } = req.query;

  const lean = true;
  const limit = DOCS_PER_PAGE;
  const sort = { datetime: 'desc' };

  const data = await ChronicleModel.paginate({}, { sort, page, lean, limit });

  return res.send({
    data
  });
}

module.exports = {
  findMany
};
