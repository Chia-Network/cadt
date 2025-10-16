const Sequelize = require('sequelize');

module.exports = {
  cad_trust_verification_id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  verification_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  verification_body: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  verification_standard: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  verification_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  verification_valid_until: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  verification_verifier: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  verification_scope: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  verification_comment: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  cad_trust_project_id: {
    type: Sequelize.STRING,
    allowNull: false,
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

