const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  User,
  Role
} = require('../models');

exports.login = async (req, res) => {

  try {

    const {
      username,
      password
    } = req.body;

    if (!username || !password) {

      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi'
      });

    }

    const user = await User.findOne({
      where: {
        email: username,
        is_active: 1
      },
      include: [
        {
          model: Role,
          as: 'role'
        }
      ]
    });

    if (!user) {

      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan'
      });

    }

    if (!user.role || user.role.name !== 'agen') {

      return res.status(403).json({
        success: false,
        message: 'Akses hanya untuk agen'
      });

    }

    const validPassword =
      await bcrypt.compare(password, user.password);

    if (!validPassword) {

      return res.status(401).json({
        success: false,
        message: 'Password salah'
      });

    }

    const token = jwt.sign(
      {
        id: user.id,
        role: 'agen'
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    res.cookie(
      'agen_token',
      token,
      {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      }
    );

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name
      }
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }

};