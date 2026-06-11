const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {

    return sequelize.define(
        "Topup",
        {

            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },

            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },

            amount: {
                type: DataTypes.DECIMAL(18,2),
                allowNull: false
            },

            method: {
                type: DataTypes.STRING
            },

            note: {
                type: DataTypes.TEXT
            },

            proof: {
                type: DataTypes.STRING
            },

            status: {
                type: DataTypes.STRING,
                defaultValue: "pending"
            }

        },
        {
            tableName: "topups"
        }
    );

};