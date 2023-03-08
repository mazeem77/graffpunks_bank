const CharacterModel = require('../../models/character');
const { sleep } = require('../../utils/index');

const resetDailyQuestsJob = (job, done) => {
  CharacterModel.find(
    {
      deleted: false,
      dailyQuest: null,
      dailyQuestApplied: true
    },
    {
      userId: 1,
      userLang: 1,
      playing: 1
    }
  ).exec((err, characters) => {
    if (err) console.error(err);
    if (characters) {
      const _ids = characters.reduce(
        (ids, character) => [...ids, character.userId],
        []
      );

      CharacterModel.updateMany(
        { userId: { $in: _ids } },
        { dailyQuestApplied: false },
        (err, result) => {
          if (err) console.error(err);
          if (result && result.ok) {
            characters.forEach((character, index) => {
              if (!character.playing) {
                sleep(index * 1000).then(() => {
                  character.notify('dailyQuestAvailable');
                });
              }
            });
          }
        }
      );
    }
  });

  done();
};

module.exports = resetDailyQuestsJob;
