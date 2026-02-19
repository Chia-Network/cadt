'use strict';

// Governance is a system table used only by the main SQLite database.
// It must not be created in the MySQL mirror.
export default {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== 'sqlite') {
      return;
    }
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
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'sqlite') {
      return;
    }
    await queryInterface.dropTable('governance');
  },
};
