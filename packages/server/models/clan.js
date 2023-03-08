const mongoose = require('mongoose');
const CLAN_LEVELS = require('data/clan_levels');
const CLAN_BUILDINGS = require('data/clan_buildings');
const ChroniclesManager = require('bot/managers/ChroniclesManager');
const { handleError } = require('utils');
const {
  sendReport,
  sendReportByKeys,
  sendNewClanReport
} = require('bot/helpers/reports');
const {
  CLAN_INVITATION_COST,
  CLAN_SCOUTS_COST,
  CLAN_TENDENCY_CHANGE_COST
} = require('data/settings');
const { get } = require('lodash');

const { Schema } = mongoose;

const ClanSchema = new Schema(
  {
    chief: { type: Schema.Types.ObjectId, ref: 'Character' },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    experienceMax: { type: Number, default: CLAN_LEVELS[1].expGoal },
    inventory: {
      gold: { type: Number, default: CLAN_LEVELS[1].gold }
    },
    members: [{ type: Schema.Types.ObjectId, ref: 'ClanMember' }],
    council: [{ type: Schema.Types.ObjectId, ref: 'ClanMember' }],
    invitations: [{ type: Schema.Types.ObjectId, ref: 'ClanInvitation' }],
    name: { type: String, required: true },
    icon: { type: String, required: true },
    rating: { type: Number, default: 0 },
    ratingStatus: { type: String, default: null },
    tendency: { type: Number, default: 0 },
    banned: { type: Boolean, default: false },
    pending: { type: Boolean, default: false },
    links: {
      chat: { type: String, default: null }
    },
    modificators: {},
    buildings: {
      castle: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      },
      houses: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      },
      armory: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      },
      trainings: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      },
      altar: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      },
      couriers: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      },
      scouts: {
        level: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        investments: [{ type: Schema.Types.ObjectId, ref: 'ClanInvestment' }]
      }
    }
  },
  {
    minimize: false,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: {
      createdAt: '_created',
      updatedAt: '_updated'
    }
  }
);

function notify(path, keys, params) {
  this.populate(
    {
      path: path,
      populate: {
        path: 'character',
        select: 'userId userLang'
      }
    },
    (err, clan) => {
      clan[path].forEach(({ character }) => {
        sendReportByKeys(character, keys, params);
      });
    }
  );
}

ClanSchema.path('inventory.gold').validate(value => {
  return value >= 0;
});

ClanSchema.methods.isEnough = async function(path, goal) {
  const data = await this.model('Clan')
    .findById(this.id, path)
    .exec();
  const value = get(data, path);
  return value && value >= goal;
};

ClanSchema.methods.isEnoughGold = function(value) {
  return new Promise(resolve =>
    this.model('Clan').findById(this.id, 'inventory', (err, data) => {
      if (err) resolve(false);
      if (data) {
        resolve(data.inventory.gold >= value);
      }
    })
  );
};

ClanSchema.methods.changeTendency = async function() {
  const tendency = this.tendency ? 0 : 1;
  const cost = Math.round(CLAN_TENDENCY_CHANGE_COST * this.membersMax);

  this.tendency = tendency;
  this.inventory.gold -= cost;

  await this.model('Character').updateMany({ clan: this.id }, { tendency });
  await this.save();
};

ClanSchema.virtual('modificators.clanMinDamage').get(function() {
  return Math.round(this.buildings.armory.level * 1);
});

ClanSchema.virtual('modificators.clanMaxDamage').get(function() {
  return Math.round(this.buildings.armory.level * 1);
});

ClanSchema.virtual('modificators.clanDefense').get(function() {
  return Math.round(this.buildings.armory.level * 1);
});

ClanSchema.virtual('modificators.clanChanceDodge').get(function() {
  return Math.round(this.buildings.trainings.level * 1);
});

ClanSchema.virtual('modificators.clanChanceCritical').get(function() {
  return Math.round(this.buildings.trainings.level * 1);
});

ClanSchema.virtual('modificators.clanVampirism').get(function() {
  return Math.round(this.buildings.altar.level * 1);
});

ClanSchema.virtual('modificators.clanBlessing').get(function() {
  return Math.round(this.buildings.altar.level * 2);
});

ClanSchema.virtual('modificators.membersBonus').get(function() {
  return Math.round(this.buildings.houses.level * 5);
});

ClanSchema.virtual('modificators.invitationsBonus').get(function() {
  return Math.round(this.buildings.houses.level * 1);
});

ClanSchema.virtual('membersMax').get(function() {
  return Math.round(10 + this.buildings.houses.level * 10);
});

ClanSchema.virtual('invitationsMax').get(function() {
  return Math.round(1 + this.buildings.couriers.level * 1);
});

ClanSchema.virtual('invitationsCount').get(function() {
  return this.invitations && Array.isArray(this.invitations)
    ? this.invitations.length
    : 0;
});

ClanSchema.virtual('invitationCost').get(() => CLAN_INVITATION_COST);

ClanSchema.virtual('scoutsCost').get(() => CLAN_SCOUTS_COST);

ClanSchema.virtual('scoutsCount').get(function() {
  return Math.round(this.buildings.scouts.level * 1);
});

ClanSchema.virtual('castleIcon').get(function() {
  return this.tendency ? '🏯' : '🏰';
});

ClanSchema.virtual('castleLevel').get(function() {
  return this.buildings ? this.buildings.castle.level : 0;
});

ClanSchema.virtual('isLight').get(function() {
  return this.tendency === 0;
});

ClanSchema.virtual('isDark').get(function() {
  return this.tendency === 1;
});

ClanSchema.methods.getBuildingData = function(tx, name) {
  const { level, gold } = this.buildings[name];
  const { levelMax, goldMax } = CLAN_BUILDINGS[name];

  const isAltar = name === 'altar';
  const isCastle = name === 'castle';

  const isUpgradeAvailable = isCastle
    ? level < this.level && level < levelMax
    : level < this.buildings.castle.level && level < levelMax;

  const titleKey =
    isAltar || isCastle
      ? `building.title.${name}.${this.tendency}`
      : `building.title.${name}`;

  const descriptionKey =
    isAltar || isCastle
      ? `building.description.${name}.${this.tendency}`
      : `building.description.${name}`;

  const title = tx[titleKey];
  const description = tx[descriptionKey];

  const upgradeCost = goldMax[level];

  return {
    level,
    levelMax,
    name,
    gold,
    title,
    description,
    upgradeCost,
    isAltar,
    isCastle,
    isUpgradeAvailable
  };
};

ClanSchema.methods.getBuildingInvestors = function(name) {
  const building = this.buildings[name];

  return building.investments.reduce((investors, investment) => {
    if (!investment.character) {
      return investors;
    }

    const investorTag = investment.character.renderTag();

    if (investors[investorTag]) {
      investors[investorTag] += Number(investment.investedGold);
    } else {
      investors[investorTag] = Number(investment.investedGold);
    }

    return investors;
  }, {});
};

ClanSchema.methods.renderTag = function() {
  const { icon, name, level } = this;
  return `${icon} ${name}🎖${level}`;
};

ClanSchema.methods.renderDetails = function(tx) {
  const { chief, icon, name, level, rating, tendency, members } = this;
  const chiefTag = chief ? chief.renderTag() : '';

  return `<b>${tx.labelClan}:</b> ${icon} ${name}\n<b>${
    tx.labelClanLevel
  }:</b> 🎖${level}\n<b>${tx.labelClanChief}:</b> ${chiefTag}\n<b>${
    tx.labelClanTendency
  }:</b> ${!tendency ? tx.labelTendencyLight : tx.labelTendencyDark}\n<b>${
    tx.labelClanRating
  }:</b> ${rating}\n<b>${tx.labelClanMembers}:</b> ${members.length}`;
};

ClanSchema.methods.renderTendencyTag = function(tx) {
  return this.tendency ? tx.labelTendencyDark : tx.labelTendencyLight;
};

ClanSchema.methods.renderCouncilTag = function() {
  if (this.council) {
    return this.council
      .reduce((list, member) => `${list}, ${member.character.renderTag()}`, '')
      .substring(2);
  }
  return '-';
};

ClanSchema.methods.getMembersCount = function() {
  return this.members.reduce(
    (count, member) => {
      if (member.pending) {
        count.pending += 1;
      } else {
        count.active += 1;
      }

      return count;
    },
    {
      active: 0,
      pending: 0,
      total: this.members.length
    }
  );
};

ClanSchema.methods.isChiefMember = function(characterId) {
  return this.chief._id.equals(characterId);
};

ClanSchema.methods.isCouncilMember = function(id) {
  return this.council.find(member => member && member._id.equals(id));
};

ClanSchema.methods.getActiveMembers = function() {
  return this.members.filter(member => member && !member.pending);
};

ClanSchema.methods.getPendingMembers = function() {
  return this.members.filter(member => member && member.pending);
};

ClanSchema.methods.notifyChief = function(key, params) {
  sendReport(this.chief, key, params);
};

ClanSchema.methods.notifyCouncil = function(messages) {
  notify.call(this, 'council', messages);
};

ClanSchema.methods.notifyMembers = function(messages) {
  notify.call(this, 'members', messages);
};

ClanSchema.pre('remove', async function() {
  await this.model('ClanMember').deleteMany({ clan: this.id }, handleError);
  await this.model('ClanInvitation').deleteMany({ clan: this.id }, handleError);
  await this.model('ClanInvestment').deleteMany({ clan: this.id }, handleError);
  await this.model('Character').updateMany(
    { clan: this.id },
    { clan: null },
    handleError
  );
});

ClanSchema.post('updateOne', async function() {
  const clan = await this.findOne();

  if (clan && clan.experience >= clan.experienceMax) {
    const level = clan.level + 1;
    const { gold, expGoal } = CLAN_LEVELS[level];

    clan.level = level;
    clan.inventory.gold += gold;
    clan.experienceMax = expGoal;

    await clan.save();

    clan.notifyMembers([{ key: 'clanNewLevel', params: { gold } }]);
    ChroniclesManager.clanNewLevel(this);
  }
});

ClanSchema.pre('save', function(next) {
  if (this.isNew) {
    sendNewClanReport(this);
    ChroniclesManager.clanNew(this);
  }

  const buildings = this.buildings.toJSON();

  if (buildings) {
    Object.keys(buildings).forEach(name => {
      const buildingCost =
        CLAN_BUILDINGS[name].goldMax[this.buildings[name].level];

      if (this.buildings[name].gold >= buildingCost) {
        this.buildings[name].level += 1;
        this.buildings[name].gold = 0;

        this.notifyMembers([{ key: 'clanBuildingNewLevel' }]);
      }
    });
  }

  if (this.rating < 0) {
    this.rating = 0;
  }

  return next();
});

mongoose.Promise = global.Promise;

module.exports = mongoose.model('Clan', ClanSchema);
