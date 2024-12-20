const Sequelize = require('sequelize');
const { uuid: uuidv4 } = require('uuidv4');

module.exports = {
  id:  {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
  },
  walletAddress: {
    type: Sequelize.STRING,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
