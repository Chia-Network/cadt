const Sequelize = require('sequelize');

module.exports = {
  cad_trust_location_id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  location_name: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  location_country: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  location_region: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  location_coordinates: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  location_comment: {
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

