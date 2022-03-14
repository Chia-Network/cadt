'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('projectRatings', {
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
      ratingType: {
        type: Sequelize.STRING,
        required: true,
      },
      ratingRangeHighest: {
        type: Sequelize.STRING,
        required: true,
      },
      ratingRangeLowest: {
        type: Sequelize.STRING,
        requred: true,
      },
      rating: {
        type: Sequelize.STRING,
        requred: true,
      },
      ratingLink: Sequelize.STRING,
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
  down: async (queryInterface) => {
    await queryInterface.dropTable('projectRatings');
  },
};
