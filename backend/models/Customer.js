const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Customer = sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      customer_id: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      nik: {
        type: DataTypes.STRING(16),
        unique: true,
        allowNull: true,
      },
      province: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      province_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      kabupaten: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      kabupaten: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      kecamatan: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      kelurahan: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      portal_password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      portal_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      last_portal_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      package_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "packages", key: "id" },
      },
      addon_id: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },
      diskon: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      diskon_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "isolated", "suspended"),
        defaultValue: "active",
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      ont_sn: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ont_mac: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      installation_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      documents: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      static_ip: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      mikrotik_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      isolir_status: {
        type: DataTypes.ENUM("active", "isolated", "restoring"),
        defaultValue: "active",
      },
      isolir_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      pppoe_username: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      province: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      province_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      kabupaten: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      kabupaten: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      kecamatan: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      kecamatan: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      kelurahan: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      kelurahan: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      billing_date: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: { min: 1, max: 28 },
      },
      billing_date: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: { min: 1, max: 28 },
      },
      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: "customers",
      timestamps: true,
      indexes: [
        { fields: ["customer_id"] },
        { fields: ["status"] },
        { fields: ["name"] },
        { fields: ["phone"] },
      ],
    },
  );

  return Customer;
};
