const Sequelize = require('sequelize');

module.exports = {
  // ID is SHA256 so there are no file duplications
  SHA256: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true,
  },
  fileName: {
    type: Sequelize.STRING,
    unique: true,
  },
  data: Sequelize.STRING,
  orgUid: Sequelize.STRING,
};
