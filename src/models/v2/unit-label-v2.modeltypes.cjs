const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.VIRTUAL,
    get() {
      return `${this.cadTrustLabelId}-${this.cadTrustUnitId}`;
    },
  },
  cadTrustLabelId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
  },
  cadTrustUnitId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
  },
  labelUnitDate: {
    type: Sequelize.DATEONLY,
    allowNull: true,
  },
  labelUnitDescription: {
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
