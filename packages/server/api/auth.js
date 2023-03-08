const config = require('config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const AdminModel = require('models/admin');
const { handleError } = require('utils/api');

const createToken = data => jwt.sign(data, config.API_TOKEN, { expiresIn: 86400 });

async function register(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return handleError(res, 'Registration failed. No data provided.');
  }

  const cryptedPassword = bcrypt.hashSync(password, 8);
  const secret = speakeasy.generateSecret({ length: 5 });

  try {
    const admin = await AdminModel.create({
      username,
      secretKey: secret.base32,
      password: cryptedPassword
    });

    const token = createToken({ id: admin._id });

    return res.status(200).send({ success: true, token });
  } catch (err) {
    return handleError(res, 'Registration failed.');
  }
}

async function sign(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return handleError(res, 'Authorization failed. No data provided.');
  }

  const admin = await AdminModel.findOne({ username });

  if (!admin) {
    return handleError(res, 'Authorization failed.');
  }

  const isValidPassword = bcrypt.compareSync(password, admin.password);

  if (!isValidPassword) {
    return handleError(res, 'Authorization failed.');
  }

  const token = createToken({ id: admin._id });

  return res.status(200).send({ success: true, token });
}

module.exports = {
  register,
  sign
};
