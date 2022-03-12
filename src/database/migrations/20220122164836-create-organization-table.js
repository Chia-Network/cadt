'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organizations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orgUid: {
        type: Sequelize.STRING,
        unique: true,
      },
      orgHash: Sequelize.STRING,
      name: Sequelize.STRING,
      icon: Sequelize.STRING,
      registryId: Sequelize.STRING,
      registryHash: Sequelize.STRING,
      subscribed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isHome: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('organizations');
  },
};
