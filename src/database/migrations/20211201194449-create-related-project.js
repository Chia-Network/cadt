'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'relatedProjects',
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
        // The orgUid is the singeltonId of the
        // organizations tables on the datalayer
        orgUid: {
          type: Sequelize.STRING,
          required: true,
        },
        relatedProjectId: {
          type: Sequelize.STRING,
        },
        relationshipType: Sequelize.STRING,
        registry: Sequelize.STRING,
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
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('relatedProjects');
  },
};
