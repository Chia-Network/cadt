'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('meta', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      meta_key: {
        type: Sequelize.STRING,
        unique: true,
      },
      meta_value: Sequelize.STRING,
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('meta');
  },
};
