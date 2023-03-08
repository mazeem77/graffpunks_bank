require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('config');

const ssl = require('./middleware/ssl');
const cors = require('./middleware/cors');
const auth = require('./middleware/auth');
const errors = require('./middleware/errors');
const publicRoutes = require('./routes/public');
const secureRoutes = require('./routes/secure');

const bot = require('./bot');
const db = require('./services/mongo');
const redis = require('./services/redis');
const agenda = require('./services/agenda');
const { initSockets } = require('./services/sockets');
const { subscribeToAssetsBurns } = require('./services/tokens');

const GamesManager = require('./bot/managers/GamesManager');
const GhostsManager = require('./bot/managers/GhostsManager');
const AssetsManager = require('./bot/managers/AssetsManager');
const CharactersManager = require('./bot/managers/CharactersManager');
const RegenerationManager = require('./bot/managers/RegenerationManager');
const SettingsManager = require('./bot/managers/SettingsManager');

const startServer = async () => {
  await db.connect();
  await redis.connect();

  await SettingsManager.initialize();
  await AssetsManager.initialize();
  await GhostsManager.initialize();
  await GamesManager.restore();
  await CharactersManager.restore();
  await RegenerationManager.restore();
  await RegenerationManager.restart(db.connection);

  const app = express();
  const server = new http.Server(app);
  const socketServer = initSockets(server);

  app.use(ssl);
  app.use(cors);

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use('/api/secure', [auth, secureRoutes, errors]);
  app.use('/api', [publicRoutes, errors]);

  app.post('/webhook/*', (req, res) => bot.updatesFetcher.handleRequest(req, res));

  app.use(express.static(path.join(__dirname, '../webapp/build')));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/build', 'index.html'));
  });

  const apiServer = app.listen(config.PORT, () => {
    console.info('[Server]: Server running at %s', config.PORT);
  });

  socketServer.listen(apiServer);

  const unsubscribe = await subscribeToAssetsBurns();

  const graceful = () => {
    GamesManager.persist();
    CharactersManager.persist();
    RegenerationManager.persist();

    agenda.stop();

    unsubscribe();

    server.close(() => {
      process.exit(0);
    });
  };

  process.on('exit', graceful);
  process.on('SIGINT', graceful);
  process.on('SIGTERM', graceful);
};

process.on('uncaughtException', err => {
  console.error(`Uncaught Exception Reason`);
  console.error(err);
});

process.on('unhandledRejection', err => {
  console.error(`Promise Rejection Reason`);
  console.error(err);
});

startServer()
  .then(() => {
    console.info('[Server]: Running');
  })
  .catch(err => {
    console.error('[Server]: Error: %s', err);
  });
