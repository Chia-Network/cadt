const Sequelize = require('sequelize');

module.exports = {
  cad_trust_stakeholder_project_id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  cad_trust_stakeholder_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  cad_trust_project_id: {
    type: Sequelize.STRING,
    allowNull: false,
  },
};
