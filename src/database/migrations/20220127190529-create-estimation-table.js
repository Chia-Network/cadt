'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estimations', {
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
      creditingPeriodStart: {
        type: Sequelize.DATE,
        required: true,
      },
      creditingPeriodEnd: {
        type: Sequelize.DATE,
        required: true,
      },
      unitCount: {
        type: Sequelize.INTEGER,
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
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estimations');
  },
};
