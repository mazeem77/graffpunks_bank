const CharacterModel = require('../../models/character');

const cancelAbilityJob = async (job, done) => {
  const { userId, abilityId } = job.attrs.data;

  const character = await CharacterModel.findOne({ userId })
    .populate('abilities')
    .exec();

  const ability = character.getActiveAbility(abilityId);
  const abilityName = ability.title[character.userLang];

  character.abilities.pull(abilityId);

  try {
    await job.remove();
    await character.save();

    character.notify('abilityCanceled', { abilityName });

    done();
  } catch (err) {
    console.error(err);
  }
};

module.exports = cancelAbilityJob;
