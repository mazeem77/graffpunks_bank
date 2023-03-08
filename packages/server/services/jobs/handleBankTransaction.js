const eos = require('../eos');
const CharacterModel = require('../../models/character');
const SettingsManager = require('../../bot/managers/SettingsManager');

async function handleBankTransaction(job, done) {
  try {
    const transaction = await eos.rpc.history_get_transaction(job.attrs.data.transactionId);
    const trace = transaction.traces.find(trace => trace.receiver === SettingsManager.TOKENS_WALLET_COMMON);
    const info = trace.act.data;
    const tokens = Number(info.quantity.split('.')[0]);

    const character = await CharacterModel.findOne({ 'waxWallet.account': info.from });
    await character.updateOne({ $inc: { 'inventory.tokens': tokens } });

    character.notify('buyTokensSuccess', { tokens: info.quantity });

    done();
  } catch (err) {
    job.schedule('in 30 seconds');
    job.save();
  }
}

module.exports = handleBankTransaction;
