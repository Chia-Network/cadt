const Sequelize = require('sequelize');

module.exports = {
  cadTrustRatingId: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  ratingType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  ratingValue: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  ratingLink: {
    type: Sequelize.TEXT,
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
  cadTrustProjectId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
};
