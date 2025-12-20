const Sequelize = require('sequelize');

module.exports = {
  cadTrustUnitLabelId: {
    type: Sequelize.STRING(36),
    primaryKey: true,
    allowNull: false,
    field: 'cad_trust_unit_label_id',
  },
  cadTrustLabelId: {
    type: Sequelize.UUID,
    allowNull: false,
    field: 'cad_trust_label_id',
  },
  cadTrustUnitId: {
    type: Sequelize.UUID,
    allowNull: false,
    field: 'cad_trust_unit_id',
  },
  labelUnitDate: {
    type: Sequelize.DATEONLY,
    allowNull: true,
    field: 'label_unit_date',
  },
  labelUnitDescription: {
    type: Sequelize.TEXT,
    allowNull: true,
    field: 'label_unit_description',
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
