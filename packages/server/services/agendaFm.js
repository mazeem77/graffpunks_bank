const config = require('config');
const Agenda = require('agenda');
const CharactersManager = require('bot/managers/CharactersManager');

const finishMiningJob = require('./jobs/finish_mining');

const agendaFm = new Agenda({
  db: {
    address: config.MONGODB_URL,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  }
});

agendaFm.define('finish_mining', finishMiningJob);

agendaFm.on('ready', async () => {
  await agendaFm.start();

  const miningJobs = await agendaFm.jobs({ name: 'finish_mining' });

  miningJobs.forEach(job => {
    CharactersManager.setBusyJob(job.attrs.data.userId, {
      name: 'mining',
      data: job.attrs
    });
  });

  console.info('[Agenda]: Connected!');
  console.info('[Agenda]: %s mining jobs restarted!', miningJobs.length);
});

agendaFm.on('complete:finish_mining', job => {
  CharactersManager.clearBusyJob(job.attrs.data.userId);
  agendaFm.cancel({name: 'finish_mining', nextRunAt: null}, function(err, numRemoved) {
    console.log(numRemoved + ' removed after complete');
  });
});

agendaFm.on('success:finish_mining', job => {
  CharactersManager.clearBusyJob(job.attrs.data.userId);
  agendaFm.cancel({name: 'finish_mining', nextRunAt: null}, function(err, numRemoved) {
    console.log(numRemoved + ' removed after success');
  });
});

agendaFm.on('fail:finish_mining', function (err, job) {
  CharactersManager.clearBusyJob(job.attrs.data.userId);
  agendaFm.cancel({name: 'finish_mining', nextRunAt: null}, function(err, numRemoved) {
    console.log(numRemoved + ' removed  after fail');
  });
});

module.exports = agendaFm;
