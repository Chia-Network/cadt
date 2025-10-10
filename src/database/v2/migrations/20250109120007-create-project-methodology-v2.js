'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'project_methodology',
      {
        cad_trust_project_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'project',
            key: 'cad_trust_project_id',
          },
        },
        cad_trust_methodology_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'methodology',
            key: 'cad_trust_methodology_id',
          },
        },
        project_methodology_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        project_methodology_description: {
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
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );

    // Add composite primary key
    await queryInterface.addConstraint('project_methodology', {
      fields: ['cad_trust_project_id', 'cad_trust_methodology_id'],
      type: 'primary key',
      name: 'project_methodology_pk',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('project_methodology');
  },
};
