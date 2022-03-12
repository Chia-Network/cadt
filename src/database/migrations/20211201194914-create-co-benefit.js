'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('coBenefits', {
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
      cobenefit: {
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
    await queryInterface.dropTable('coBenefits');
  },
};
