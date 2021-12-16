const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  buyer: Sequelize.STRING,
  registry: Sequelize.STRING,
  blockIdentifier: Sequelize.STRING,
  identifier: Sequelize.STRING,
  unitType: Sequelize.STRING,
  unitCount: Sequelize.NUMBER,
  unitStatus: Sequelize.STRING,
  unitStatusDate: Sequelize.DATE,
  transactionType: Sequelize.STRING,
  unitIssuanceLocation: Sequelize.STRING,
  unitLink: Sequelize.STRING,
  correspondingAdjustment: Sequelize.STRING,
  unitTag: Sequelize.STRING,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
