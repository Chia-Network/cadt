'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('governance', {
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
      confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('governance');
  },
};
