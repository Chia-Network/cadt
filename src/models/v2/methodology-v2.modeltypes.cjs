const Sequelize = require('sequelize');

module.exports = {
  cad_trust_methodology_id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  methodology_code: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  methodology_name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  methodology_version: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  methodology_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  methodology_link: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  methodology_type: {
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
};
