'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'stakeholder_projects',
      {
        cad_trust_stakeholder_project_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        cad_trust_stakeholder_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'stakeholder',
            key: 'cad_trust_stakeholder_id',
          },
        },
        cad_trust_project_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'project',
            key: 'cad_trust_project_id',
          },
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('stakeholder_projects');
  },
};
