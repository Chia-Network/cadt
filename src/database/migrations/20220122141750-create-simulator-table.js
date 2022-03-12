'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('simulator', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: Sequelize.STRING,
        unique: true,
      },
      value: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('simulator');
  },
};
