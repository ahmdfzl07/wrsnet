const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const CustomerRegistration = sequelize.define(
    "CustomerRegistration",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      customer_id: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
      },

      nik: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          isNumeric: true,
          len: {
            args: [16, 16],
            msg: "NIK harus tepat 16 digit",
          },
        },
      },
      name: { type: DataTypes.STRING(150), allowNull: false },
      address: { type: DataTypes.TEXT },

      province: DataTypes.STRING(100),
      province_id: DataTypes.STRING(20),
      kabupaten: DataTypes.STRING(100),
      kecamatan: DataTypes.STRING(100),
      kelurahan: DataTypes.STRING(100),

      rt: DataTypes.STRING(10),
      rw: DataTypes.STRING(10),

      phone: { type: DataTypes.STRING(20), allowNull: false },
      email: DataTypes.STRING(150),

      package_id: DataTypes.INTEGER,
      addon_id: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },

      latitude: DataTypes.DECIMAL(10, 8),
      longitude: DataTypes.DECIMAL(11, 8),

      ont_sn: DataTypes.STRING(50),
      ont_mac: DataTypes.STRING(20),

      installation_date: DataTypes.DATEONLY,
      notes: DataTypes.TEXT,

      pppoe_username: DataTypes.STRING(100),
      static_ip: DataTypes.STRING(20),

      mikrotik_id: DataTypes.INTEGER,

      due_date: DataTypes.DATEONLY,
      coordinates: DataTypes.STRING(100),
      referral: DataTypes.STRING(100),

      documents: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
    },
    {
      tableName: "customer_registration",
      timestamps: true,
    },
  );

  return CustomerRegistration;
};
