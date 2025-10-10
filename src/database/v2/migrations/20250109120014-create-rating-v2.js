'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'rating',
      {
        cad_trust_rating_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        rating_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        rating_value: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        rating_link: {
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
    await queryInterface.dropTable('rating');
  },
};
