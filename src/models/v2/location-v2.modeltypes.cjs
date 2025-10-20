const Sequelize = require('sequelize');

module.exports = {
  cad_trust_location_id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  location_country: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  location_region: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  location_gis: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  location_map_type: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  location_map_file_link: {
    type: Sequelize.TEXT,
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
    type: Sequelize.STRING,
    allowNull: false,
  },
};
