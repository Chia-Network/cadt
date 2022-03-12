'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('label_unit', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      orgUid: {
        type: Sequelize.STRING,
        required: true,
      },
      warehouseUnitId: {
        type: Sequelize.STRING,
        required: true,
      },
      labelId: {
        type: Sequelize.STRING,
        required: true,
      },
      timeStaged: {
        type: 'TIMESTAMP',
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('label_unit');
  },
};
