const Sequelize = require('sequelize');

module.exports = {
  cad_trust_stakeholder_project_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  cad_trust_stakeholder_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  cad_trust_project_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
};
