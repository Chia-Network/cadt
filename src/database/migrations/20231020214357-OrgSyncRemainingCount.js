'use strict';

export default {
  async up(queryInterface, Sequelize) {
    const tableDescription =
      await queryInterface.describeTable('organizations');

    // Check if the 'sync_remaining' column exists before adding it
    if (!tableDescription.sync_remaining) {
      await queryInterface.addColumn('organizations', 'sync_remaining', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const tableDescription =
      await queryInterface.describeTable('organizations');

    // Check if the 'sync_remaining' column exists before removing it
    if (tableDescription.sync_remaining) {
      await queryInterface.removeColumn('organizations', 'sync_remaining');
    }
  },
};
