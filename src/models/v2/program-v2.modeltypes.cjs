const Sequelize = require('sequelize');

module.exports = {
  cad_trust_program_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  program_name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  program_registry: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  program_registry_program_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  program_registry_activity_id: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  program_description: {
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
};
