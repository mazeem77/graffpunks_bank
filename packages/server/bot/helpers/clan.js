const { clanNameRegex, emojiRegex } = require('data/regex');

function getClanDefaultModificators() {
  return {
    clanMinDamage: 0,
    clanMaxDamage: 0,
    clanDefense: 0,
    clanChanceDodge: 0,
    clanChanceCritical: 0,
    clanVampirism: 0,
    clanBlessing: 0
  };
}

function calculateClanModificators(clan) {
  const modificators = getClanDefaultModificators();

  if (clan && clan.buildings) {
    modificators.clanMinDamage = clan.buildings.armory.level * 1;
    modificators.clanMaxDamage = clan.buildings.armory.level * 1;
    modificators.clanDefense = clan.buildings.armory.level * 1;

    modificators.clanChanceDodge = clan.buildings.trainings.level * 1;
    modificators.clanChanceCritical = clan.buildings.trainings.level * 1;

    modificators.clanVampirism = clan.buildings.altar.level * 1;
    modificators.clanBlessing = clan.buildings.altar.level * 2;
  }

  return modificators;
}

function isValidClanName(name) {
  return name && clanNameRegex.test(name) && !emojiRegex.test(name);
}

module.exports = {
  getClanDefaultModificators,
  calculateClanModificators,
  isValidClanName
};
