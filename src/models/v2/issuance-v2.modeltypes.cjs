const Sequelize = require('sequelize');

module.exports = {
  cad_trust_issuance_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  issuance_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  issuance_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
  cad_trust_verification_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  cad_trust_methodology_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  cad_trust_location_id: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
};
