const mongoose = require('mongoose');

const { Schema } = mongoose;

const AdminSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  secretKey: { type: String, required: true }
});

mongoose.Promise = global.Promise;

module.exports = mongoose.model('Admin', AdminSchema);
