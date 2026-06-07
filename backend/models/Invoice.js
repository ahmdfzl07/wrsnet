const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    // TAMBAHKAN INI
    agen_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },

    invoice_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: false
    },

    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id'
      }
    },

    amount: {
      type: DataTypes.DECIMAL(12,2),
      allowNull:false
    },

    tax:{
      type:DataTypes.DECIMAL(12,2),
      defaultValue:0
    },

    total:{
      type:DataTypes.DECIMAL(12,2),
      allowNull:false
    },

    status:{
      type:DataTypes.ENUM(
        'unpaid',
        'paid',
        'overdue',
        'cancelled'
      ),
      defaultValue:'unpaid'
    },

    last_wa_reminder_at:{
      type:DataTypes.DATE,
      allowNull:true
    },

    due_date:{
      type:DataTypes.DATEONLY,
      allowNull:false
    },

    paid_date:{
      type:DataTypes.DATEONLY,
      allowNull:true
    },

    period_month:{
      type:DataTypes.INTEGER,
      allowNull:false
    },

    period_year:{
      type:DataTypes.INTEGER,
      allowNull:false
    },

    notes:{
      type:DataTypes.TEXT,
      allowNull:true
    },

    pdf_path:{
      type:DataTypes.STRING(255),
      allowNull:true
    }

  },{
    tableName:'invoices',
    timestamps:true
  });

  Invoice.associate=(models)=>{

      Invoice.belongsTo(models.Customer,{
          foreignKey:"customer_id",
          as:"customer"
      });

      // OPTIONAL
      Invoice.belongsTo(models.User,{
          foreignKey:"agen_id",
          as:"agen"
      });

  };

  return Invoice;
};