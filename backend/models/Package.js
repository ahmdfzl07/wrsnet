const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Package = sequelize.define('Package', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    speed_down: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Download speed in Mbps'
    },
    speed_up: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Upload speed in Mbps'
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM('home', 'business', 'enterprise', 'custom'),
      defaultValue: 'home',
      comment: 'Kategori paket untuk tampilan dan filter'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'packages',
    timestamps: true
  });

  return Package;
};
