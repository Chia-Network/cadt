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
    allowNull: true,
  },
  methodology_type: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  methodology_version: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  methodology_scope: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  methodology_comment: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  org_uid: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};

