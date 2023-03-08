const mongoose = require('mongoose');
const ANIMAL_LEVELS = require('data/animal_levels');

const { Schema } = mongoose;
const { sendReportByUserId } = require('bot/helpers/reports');
const { ANIMAL_MAX_LEVEL } = require('data/settings');

mongoose.Promise = global.Promise;

const CharacterAnimalSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: Schema.Types.Mixed, required: true },
    data: { type: Schema.Types.ObjectId, ref: 'Animal', required: true },
    name: { type: String, required: true },
    level: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
    dead: { type: Boolean, default: false },
    experience: { type: Number, default: 0 },
    experienceMax: { type: Number, default: ANIMAL_LEVELS[1].expGoal },
    availableTrainings: { type: Number, default: ANIMAL_LEVELS[1].trainings },
    icon: { type: String, required: true },
    minDamage: { type: Number, required: true },
    maxDamage: { type: Number, required: true },
    health: { type: Number, required: true },
    maxHealth: { type: Number, required: true }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

CharacterAnimalSchema.path('availableTrainings').validate(value => {
  return value >= 0;
});

CharacterAnimalSchema.virtual('isMaxLevel').get(function() {
  return this.level >= ANIMAL_MAX_LEVEL;
});

CharacterAnimalSchema.methods.renderTag = function() {
  const { name, icon, level, health, maxHealth } = this;

  const hearthBroken = '💔';
  const hearthDefault = '❤';
  const hearthIcon = health < maxHealth / 2 ? hearthBroken : hearthDefault;

  return `${icon} ${name}🎖${level} ${hearthIcon}(${health}/${maxHealth})`;
};

CharacterAnimalSchema.pre('save', function(next) {
  if (this.experience >= this.experienceMax) {
    const level = this.level + 1;
    const levelData = ANIMAL_LEVELS[level];

    this.level = level;
    this.availableTrainings += levelData.trainings;
    this.experienceMax = levelData.expGoal;

    sendReportByUserId(this.userId, 'animalNewLevel');
    return next();
  }

  next();
});

CharacterAnimalSchema.pre('remove', function(next) {
  this.model('Character').updateOne(
    { userId: this.userId },
    { animal: null },
    () => next()
  );
});

module.exports = mongoose.model('CharacterAnimal', CharacterAnimalSchema);
