const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'invoices', key: 'id' }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    payment_method: {
      type: DataTypes.ENUM('cash', 'transfer', 'dana', 'ovo', 'gopay', 'qris', 'ewallet', 'gateway', 'other'),
      defaultValue: 'cash'
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    recorded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    wa_sent_status: {
      type: DataTypes.ENUM('sent', 'failed', 'skipped'),
      allowNull: true,
      defaultValue: null
    },
    wa_sent_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'payments',
    timestamps: true,
    indexes: [
      { fields: ['invoice_id'] },
      { fields: ['payment_date'] }
    ]
  });

  return Payment;
};