const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies?.agen_token;

    if (!token) {
      return res.redirect('/portal/login-agen');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user || !user.is_active) {
      return res.redirect('/portal/login-agen');
    }

    req.user = user;
    next();

  } catch (err) {
    console.log('AUTH ERROR:', err);
    return res.redirect('/portal/login-agen');
  }
};