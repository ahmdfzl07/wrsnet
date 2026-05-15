const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('WaSession', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    session_id: { type: DataTypes.STRING(50), unique: true, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    phone_number: { type: DataTypes.STRING(20), allowNull: true },
    status: {
      type: DataTypes.ENUM('disconnected', 'connecting', 'connected', 'banned'),
      defaultValue: 'disconnected'
    },
    qr_code: { type: DataTypes.TEXT, allowNull: true },
    last_seen: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    webhook_url: { type: DataTypes.STRING(255), allowNull: true },
    auto_reply_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    notes: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'wa_sessions',
    timestamps: true,
    indexes: [{ fields: ['session_id'] }, { fields: ['status'] }]
  });
};
