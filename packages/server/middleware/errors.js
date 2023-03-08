const router = require('express').Router();

/**
 * Error handling
 */

router.use((err, req, res, next) => {
  if (
    err.message &&
    (~err.message.indexOf('not found') ||
      ~err.message.indexOf('Cast to ObjectId failed'))
  ) {
    return next();
  }

  console.error(err.stack);

  if (err.stack.includes('ValidationError')) {
    res.status(422).send({ error: err.stack });
    return;
  }

  return res.status(500).send({ error: err.stack });
});

router.use((req, res) => {
  res.status(404).send({
    url: req.originalUrl,
    error: 'Not found'
  });
});

module.exports = router;
