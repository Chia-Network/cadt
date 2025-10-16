const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT5AuthorizedEntitiesId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  aefT5AuthorizedEntitiesId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT5AuthorizedEntitiesIncorporationCountry: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
};
