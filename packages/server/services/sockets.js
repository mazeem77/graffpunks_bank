const { Server } = require('socket.io');
const { compressToBase64 } = require('lz-string');

let webSockets;

const encode = payload => {
  return compressToBase64(JSON.stringify(payload));
};

const initSockets = server => {
  const io = new Server(server, {
    pingInterval: 15000,
    pingTimeout: 30000
  });

  webSockets = io.of('/website');

  webSockets.on('connection', socket => {
    console.info('[WebSocket]: Connected!', socket.id);

    socket.on('disconnect', () => {
      socket.disconnect();
      console.info('[WebSocket]: Disconnected!', socket.id);
    });
  });

  return io;
};

const emitWebsiteUpdate = (name, data) => {
  webSockets.emit(name, encode(data));
};

module.exports = {
  initSockets,
  emitWebsiteUpdate
};
