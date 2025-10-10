const Sequelize = require('sequelize');

module.exports = {
  cad_trust_validation_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  validation_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  validation_type: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  validation_body: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  validation_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  validation_credit_period_start_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  validation_credit_period_end_date: {
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
  cad_trust_project_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
};
