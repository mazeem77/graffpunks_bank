const config = require('config');
const Agenda = require('agenda');

const handleBankTransaction = require('./jobs/handleBankTransaction');

const agenda = new Agenda({
  db: {
    address: config.MONGODB_URL,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  }
});

agenda.define('bank_transaction', handleBankTransaction);

agenda.on('ready', async () => {
  await agenda.start();
  await agenda.every('30 seconds', 'bank_transaction');
});

module.exports = agenda;
