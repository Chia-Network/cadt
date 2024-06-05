'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('statistics', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      uri: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      statisticsJsonString: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      timestamp: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('statistics');
  },
};
