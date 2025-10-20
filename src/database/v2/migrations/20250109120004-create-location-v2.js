'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'location',
      {
        cad_trust_location_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
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
    await queryInterface.dropTable('location');
  },
};
