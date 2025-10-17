const Sequelize = require('sequelize');

module.exports = {
  cad_trust_verification_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  verification_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  verification_start_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  verification_end_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  verification_body: {
    type: Sequelize.STRING,
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
  cad_trust_project_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  cad_trust_validation_id: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
};
