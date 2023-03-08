const mongoose = require('mongoose');
const ClanMemberModel = require('models/clan_member');

const { Schema } = mongoose;
mongoose.Promise = global.Promise;

const ClanInvitationSchema = new Schema({
  userId: { type: String, required: true, index: true },
  clan: { type: Schema.Types.ObjectId, ref: 'Clan' },
  character: { type: Schema.Types.ObjectId, ref: 'Character' },
  rewardGold: { type: Number, default: 0 },
  rewardCredits: { type: Number, default: 0 }
});

function acceptInvitation(cb) {
  ClanMemberModel.create(
    {
      clan: this.clan.id,
      character: this.character,
      pending: false
    },
    err => {
      if (err) return cb(err);

      this.model('Character').updateOne(
        { _id: this.character },
        { clan: this.clan.id, tendency: this.clan.tendency },
        () => this.remove(cb)
      );
    }
  );
}

ClanInvitationSchema.methods.accept = function(member, cb) {
  if (member) {
    return member.remove(() => {
      acceptInvitation.call(this, cb);
    });
  }

  acceptInvitation.call(this, cb);
};

ClanInvitationSchema.pre('remove', function(next) {
  const clanId = this.clan && this.clan.id ? this.clan.id : this.clan;

  this.model('Clan').updateOne(
    { _id: clanId },
    { $pull: { invitations: { $in: [this.id] } } },
    () => next()
  );
});

module.exports = mongoose.model('ClanInvitation', ClanInvitationSchema);
