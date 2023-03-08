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


module.exports = agenda;
