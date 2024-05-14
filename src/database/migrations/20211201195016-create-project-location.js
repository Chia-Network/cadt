'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface
      .showAllTables()
      .then((tables) => tables.includes('projectLocations'));

    if (!tableExists) {
      await queryInterface.createTable(
        'projectLocations',
        {
          id: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
            defaultValue: () => uuidv4(),
            primaryKey: true,
          },
          warehouseProjectId: {
            type: Sequelize.STRING,
            required: true,
          },
          orgUid: {
            type: Sequelize.STRING,
            required: true,
          },
          country: {
            type: Sequelize.STRING,
            required: true,
          },
          inCountryRegion: {
            type: Sequelize.STRING,
          },
          geographicIdentifier: {
            type: Sequelize.STRING,
            required: true,
          },
          timeStaged: {
            type: Sequelize.STRING,
          },
          createdAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          updatedAt: {
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
    }
  },

  down: async (queryInterface) => {
    const tableExists = await queryInterface
      .showAllTables()
      .then((tables) => tables.includes('projectLocations'));

    if (tableExists) {
      await queryInterface.dropTable('projectLocations');
    }
  },
};
