const mongoose = require('mongoose');
const paginate = require('./plugins/paginate');

const { Schema } = mongoose;

const ChronicleSchema = new Schema(
  {
    type: { type: String, required: true },
    date: { type: String, required: true },
    data: {}
  },
  {
    minimize: false,
    timestamps: { createdAt: 'datetime' },
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

mongoose.Promise = global.Promise;

ChronicleSchema.plugin(paginate);

module.exports = mongoose.model('Chronicle', ChronicleSchema);
