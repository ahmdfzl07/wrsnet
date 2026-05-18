module.exports = (sequelize, DataTypes) => {
  const LiveMessage = sequelize.define(
    "LiveMessage",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      room: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
      message: DataTypes.TEXT,
    },
    {
      tableName: "live_messages",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    },
  );

  return LiveMessage;
};
