const fetch = require('node-fetch');
const WebSocket = require('ws');
const { TextDecoder, TextEncoder } = require('util');
const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { ExplorerApi } = require('atomicassets');
const { createDfuseClient } = require('@dfuse/client');

global.fetch = fetch;
global.WebSocket = WebSocket;

const privateKeys = [process.env.TOKENS_WALLET_KEY];
const signatureProvider = new JsSignatureProvider(privateKeys);
const rpc = new JsonRpc(process.env.TOKENS_WALLET_NETWORK, { fetch });
const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder()
});

const assets = new ExplorerApi('https://wax.api.atomicassets.io', 'atomicassets', { fetch });

const dfuse = createDfuseClient({
  apiKey: process.env.DFUSE_API_KEY,
  network: process.env.DFUSE_NETWORK
});

module.exports = {
  api,
  assets,
  rpc,
  dfuse
};
