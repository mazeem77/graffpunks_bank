const router = require('express').Router();

const auth = require('../api/auth');
const items = require('../api/items');
const heroes = require('../api/heroes');
const chronicles = require('../api/chronicles');
const localization = require('../api/localization');
const integrations = require('../api/integrations');

// router.post('/auth/register', auth.register);
router.post('/auth/sign', auth.sign);
router.get('/translations', localization.getTranslations);
router.get('/items', items.findMany);
router.get('/heroes/:userId', heroes.findOne);
router.get('/heroes', heroes.findMany);
router.get('/chronicles', chronicles.findMany);
router.post('/integrations/wax', integrations.getWax);
router.post('/integrations/connect-wax', integrations.connectWax);
router.post('/integrations/disconnect-wax', integrations.disconnectWax);
router.post('/integrations/wax-transaction', integrations.handleWaxTransaction);

module.exports = router;
