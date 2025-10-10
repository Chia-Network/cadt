const Sequelize = require('sequelize');

module.exports = {
  cad_trust_unit_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  unit_serial_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  unit_start_block: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  unit_end_block: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  unit_count: {
    type: Sequelize.DECIMAL,
    allowNull: true,
  },
  unit_type: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unit_vintage_year: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  unit_status: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unit_status_reason: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  unit_status_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  unit_retirement_detail: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  unit_retirement_beneficiary: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unit_retirement_beneficiary_id: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unit_link: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  unit_metric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unit_current_owner: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  unit_itmos_reference_id: {
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
  cad_trust_issuance_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
};
