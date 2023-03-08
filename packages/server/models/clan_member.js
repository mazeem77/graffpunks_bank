const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

const roles = {
  chief: { icon: '👑' },
  councelor: { icon: '🗣' }
};

const ClanMemberSchema = new Schema({
  clan: { type: Schema.Types.ObjectId, ref: 'Clan' },
  character: { type: Schema.Types.ObjectId, ref: 'Character' },
  pending: { type: Boolean, default: true }
});

ClanMemberSchema.methods.renderTag = function(params) {
  return this.character.renderTag(params);
};

ClanMemberSchema.methods.renderStats = function(tx) {
  return this.character.renderStats(tx);
};

ClanMemberSchema.methods.isChief = function() {
  return this.clan.chief.equals(this.character.id);
};

ClanMemberSchema.methods.isCouncil = function() {
  return this.clan.council.some(member => member.equals(this.id));
};

ClanMemberSchema.methods.getRoleData = function() {
  if (this.isChief()) {
    return roles.chief;
  }

  if (this.isCouncil()) {
    return roles.councelor;
  }

  return null;
};

ClanMemberSchema.pre('save', function(next) {
  if (this.isNew) {
    this.model('Clan').updateOne(
      { _id: this.clan },
      { $push: { members: this.id } },
      err => {
        if (err) console.error(err);
      }
    );
  }

  return next();
});

ClanMemberSchema.pre('remove', function(next) {
  this.model('Character').updateOne(
    { _id: this.character },
    { clan: null },
    err => {
      if (err) console.error(err);
    }
  );

  this.model('Clan').updateOne(
    { _id: this.clan },
    {
      $pull: {
        members: { $in: [this.id] },
        council: { $in: [this.id] }
      }
    },
    err => {
      if (err) console.error(err);
    }
  );

  return next();
});

module.exports = mongoose.model('ClanMember', ClanMemberSchema);
