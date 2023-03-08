const router = require('express').Router();

const newsletter = require('../api/newsletter');
const assets = require('../api/assets');

router.post('/newsletter/send', newsletter.send);
router.post('/assets/mint', assets.mint);

module.exports = router;
