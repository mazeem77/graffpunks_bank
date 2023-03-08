/**
 * Mongoose query population plugin
 */

const { hasProp } = require('utils');

async function paginate(query = {}, options = {}) {
  const BASE_LIMIT = 10;
  const { select, sort, populate } = options;

  const lean = options.lean || false;
  const limit = options.limit || BASE_LIMIT;

  let skip = 0;
  let offset = 0;
  let page = 1;

  if (hasProp(options, 'offset')) {
    offset = Number(options.offset);
    skip = offset;
  }

  if (hasProp(options, 'page')) {
    page = Number(options.page);
    skip = (page - 1) * limit;
  }

  const countQuery = this.countDocuments(query);
  const docsQuery = this.find(query).select(select).sort(sort).skip(skip).limit(limit).lean(lean);

  if (populate) {
    [].concat(populate).forEach(item => docsQuery.populate(item));
  }

  const docs = await docsQuery.exec();
  const count = await countQuery.exec();

  const pagination = {
    count,
    limit
  };

  if (offset) {
    pagination.offset = offset;
  }

  if (page) {
    pagination.page = page;
    pagination.pages = Math.ceil(count / limit) || 1;
  }

  return {
    docs,
    pagination
  };
}

/**
 * @param {Schema} schema
 */
module.exports = function (schema) {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
