import * as waxjs from '@waxio/waxjs/dist';

export const wax = new waxjs.WaxJS({
  rpcEndpoint: process.env.REACT_APP_TOKENS_NETWORK
});
