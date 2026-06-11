const { User, AgentTransaction } = require('../models');
const { Op } = require('sequelize');

module.exports = {

  dashboard: async (req, res) => {
    try {

      const user = await User.findByPk(req.user.id);

      const todayIncome = await AgentTransaction.sum('amount', {
        where: {
          user_id: user.id,
          status: 'success'
        }
      });

      const totalTrx = await AgentTransaction.count({
        where: {
          user_id: user.id
        }
      });

      const recent = await AgentTransaction.findAll({
        where: {
          user_id: user.id
        },
        order: [['id', 'DESC']],
        limit: 10
      });

      res.render('portal/agen/dashboard-agen', {
        title: 'Dashboard Agen',
        appName: process.env.APP_NAME,
        active: 'agen-dashboard',
        user,
        todayIncome,
        totalTrx,
        recent
      });

    } catch (err) {
      console.log(err);
      res.status(500).send('Server Error');
    }
  },

  profile: async (req, res) => {
    try {
      const user = req.user;

      return res.json({
        success: true,
        data: user
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to load profile'
      });
    }
  }

};


