const Sequelize = require('sequelize');

module.exports = {
  cadTrustRatingId: {
    type: Sequelize.UUID,
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
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
};
