const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.VIRTUAL,
    get() {
      return `${this.cadTrustProjectId}-${this.cadTrustMethodologyId}`;
    },
  },
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
  },
  cadTrustMethodologyId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
  },
  projectMethodologyDate: {
    type: Sequelize.DATEONLY,
    allowNull: true,
  },
  projectMethodologyDescription: {
    type: Sequelize.TEXT,
    allowNull: true,
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
