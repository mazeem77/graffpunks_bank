const mongoose = require('mongoose');
const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const ConfigSchema = new Schema({
  name: { type: String, required: true, index: true },
  values: { type: Schema.Types.Mixed, required: true }
});

module.exports = mongoose.model('Config', ConfigSchema);
