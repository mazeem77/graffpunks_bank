const mongoose = require('mongoose');

const { Schema } = mongoose;

const MiningStatusSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  status1: { type: Boolean, required: true },
  status2: { type: Boolean, required: true },
  status3: { type: Boolean, required: true },
  status4: { type: Boolean, required: true },
  status5: { type: Boolean, required: true },
  status6: { type: Boolean, required: true }
});

mongoose.Promise = global.Promise;

module.exports = mongoose.model('MiningStatus', MiningStatusSchema);
