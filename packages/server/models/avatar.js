const mongoose = require('mongoose');

const { Schema } = mongoose;

const AvatarSchema = new Schema(
  {
    caption: { type: Schema.Types.Mixed, required: true },
    level: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    gender: { type: String, default: 'any' },
    fileNumber: { type: Number, required: true },
    files: {
      light: { type: String, required: true },
      dark: { type: String, required: true }
    },
    price: {
      gold: { type: Number, default: 0 },
      credits: { type: Number, default: 0 }
    }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

mongoose.Promise = global.Promise;

module.exports = mongoose.model('Avatar', AvatarSchema);
