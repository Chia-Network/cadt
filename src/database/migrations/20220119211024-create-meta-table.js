'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('meta', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      metaKey: {
        type: Sequelize.STRING,
        unique: true,
      },
      metaValue: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('meta');
  },
};
