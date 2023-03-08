import io from 'socket.io-client';
import { decompressFromBase64 } from 'lz-string';

export const decodePayload = payload => {
  return JSON.parse(decompressFromBase64(payload));
};

export const initSocket = () => {
  return io(`${process.env.REACT_APP_API_URL}/website`, {
    transports: ['websocket']
  });
};
