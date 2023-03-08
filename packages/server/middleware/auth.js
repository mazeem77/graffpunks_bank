const router = require('express').Router();
const config = require('config');
const jwt = require('jsonwebtoken');
const { handleError } = require('utils/api');

router.use((req, res, next) => {
  const token =
    req.body.token || req.query.token || req.headers['x-access-token'];

  if (!token) {
    return handleError(res, 'No token provided');
  }

  return jwt.verify(token, config.API_TOKEN, (err, decoded) => {
    if (decoded) {
      req.decoded = decoded;
      return next();
    }

    return handleError(res, 'Failed to authenticate token');
  });
});

module.exports = router;
