'use strict';

export default {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'sqlite') {
      await queryInterface.dropTable('governance');
    }
  },

  async down(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== 'sqlite') {
      await queryInterface.createTable('governance', {
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
        confirmed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
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
    }
  },
};
