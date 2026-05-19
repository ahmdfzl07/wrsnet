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
      name: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
      type: DataTypes.STRING,
      message: DataTypes.TEXT,
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
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
