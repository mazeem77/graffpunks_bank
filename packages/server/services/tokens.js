const Random = require('random-js')();
const eos = require('./eos');
const get = require('lodash/get');
const Settings = require('../bot/managers/SettingsManager');
const AssetBurnModel = require('../models/asset_burn');

const BURN_COLLECTION = 'midevilpunks';
const MINT_COLLECTION = 'midevilpunks';
const MINT_COLLECTION_SCHEMA = 'midevilpunks';

const OLD_GAME_PASS_TYPE_TEMPLATES = {
  single: 411568,
  teams: 413936,
  royal: 413934,
  proximoMining: 413937
};

const GAME_PASS_TYPE_TEMPLATES = {
  single: 462211,
  teams: 460304,
  royal: 460302,
  proximoMining: 462132
};

async function withdrawTokens(walletAccount, quantity) {
  try {
    await eos.api.transact(
      {
        actions: [
          {
            account: 'kingsofgraff',
            name: 'transfer',
            authorization: [
              {
                actor: Settings.TOKENS_WALLET_COMMON,
                permission: 'arenabotsend'
              }
            ],
            data: {
              from: Settings.TOKENS_WALLET_COMMON,
              to: walletAccount,
              quantity: `${quantity}.0000 ${Settings.TOKEN_NAME}`,
              memo: 'GRAFFpunks Arena withdrawn'
            }
          }
        ]
      },
      {
        blocksBehind: 3,
        expireSeconds: 1200,
        sign: true
      }
    );

    console.info(`[WITHDRAW]: ${quantity}.0000 ${Settings.TOKEN_NAME} to ${walletAccount}`);

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function getWalletByType(type) {
  if (type === 'rare') {
    return Settings.TOKENS_WALLET_RARE;
  }

  return Settings.TOKENS_WALLET_COMMON;
}

async function mintAsset(wallet, type = 'common', templateId) {
  try {
    const mintWallet = getWalletByType(type);
    const action = await eos.assets.action;
    const actions = await action.mintasset(
      [{ actor: mintWallet, permission: 'arenabotsend' }],
      mintWallet,
      MINT_COLLECTION,
      MINT_COLLECTION_SCHEMA,
      templateId,
      wallet.account,
      {},
      {},
      []
    );

    await eos.api.transact(
      {
        actions
      },
      {
        blocksBehind: 3,
        expireSeconds: 1200
      }
    );

    console.info(`[NFT]: Asset minted ID - ${templateId} and sent to ${wallet.account}`);

    return true;
  } catch (err) {
    console.error(`[NFT]: Mint error`, err);
    return false;
  }
}

async function mintRandomAsset(wallet, type = 'common', ids) {
  const templateIds = ids || Settings.MINT_TEMPLATE_IDS;
  const templateId = Random.pick(templateIds);

  return mintAsset(wallet, type, templateId);
}

async function sendRandomAssetFromPool(wallet, type = 'common') {
  if (!wallet) {
    return;
  }

  const poolWallet = getWalletByType(type);

  try {
    const assets = await eos.assets.getAssets({ owner: poolWallet });
    const randomAsset = Random.pick(assets);

    if (!randomAsset) {
      console.info(`[NFT]: No assets in the pool`);
      return;
    }

    await eos.api.transact(
      {
        actions: [
          {
            account: 'atomicassets',
            name: 'transfer',
            authorization: [
              {
                actor: poolWallet,
                permission: 'arenabotsend'
              }
            ],
            data: {
              from: poolWallet,
              to: wallet.account,
              asset_ids: [randomAsset.asset_id],
              memo: 'GRAFFpunks Arena NFT gift'
            }
          }
        ]
      },
      {
        blocksBehind: 3,
        expireSeconds: 1200
      }
    );

    console.info(`[NFT]: ${randomAsset.asset_id} is sent to ${wallet.account}`);

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function handleAssetBurn(message) {
  const CharacterModel = require('models/character');
  const collectionName = get(message, 'data.trace.act.data.collection_name');

  if (message.type !== 'action_trace' || collectionName !== BURN_COLLECTION) {
    return;
  }

  const { asset_owner, asset_id, collection_name, template_id } = message.data.trace.act.data;
  const character = await CharacterModel.findOne({ 'waxWallet.account': asset_owner });

  await AssetBurnModel.create({
    wallet: asset_owner,
    assetId: asset_id,
    templateId: template_id,
    collectionName: collection_name
  });

  character.notify('burnNew');

  console.log(
    `[BURN]: [owner: ${asset_owner}, asset: ${asset_id}, collection: ${collection_name}, template: ${template_id}]`
  );
}

async function subscribeToAssetsBurns() {
  const options = { accounts: 'atomicassets', action_names: 'logburnasset', receivers: 'pnkofgraf.gm' };
  const stream = await eos.dfuse.streamActionTraces(options, handleAssetBurn);

  return () => stream.close();
}

async function hasGamePassAsset(wallet, type) {
  const oldTemplateId = OLD_GAME_PASS_TYPE_TEMPLATES[type];
  const templateId = GAME_PASS_TYPE_TEMPLATES[type];

  try {
    const gamePassAssets = await eos.assets.getAssets({ owner: wallet, template_id: templateId });
    const oldGamePassAssets = await eos.assets.getAssets({ owner: wallet, template_id: oldTemplateId });
    return gamePassAssets.length > 0 || oldGamePassAssets.length > 0;
  } catch (err) {
    console.error(err);
    return false;
  }
}

module.exports = {
  withdrawTokens,
  sendRandomAssetFromPool,
  mintRandomAsset,
  subscribeToAssetsBurns,
  hasGamePassAsset,
  mintAsset
};
