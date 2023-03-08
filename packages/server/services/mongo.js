const config = require('../config');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const db = {};

db.connect = async () => {
  try {
    await mongoose.connect(config.MONGODB_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useCreateIndex: true,
      useFindAndModify: false
    });

    db.connection = mongoose.connection;

    console.info('[Mongo]: Connected');
  } catch (error) {
    console.error('[Mongo]: Connection error', error);
  }
};

module.exports = db;
