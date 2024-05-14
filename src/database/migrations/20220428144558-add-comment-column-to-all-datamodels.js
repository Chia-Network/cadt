'use strict';

export default {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('audit');

    // Check if the 'comment' column exists before adding it using a safer method
    if (!Object.prototype.hasOwnProperty.call(tableDescription, 'comment')) {
      await queryInterface.addColumn('audit', 'comment', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('audit');

    // Check if the 'comment' column exists before removing it using a safer method
    if (Object.prototype.hasOwnProperty.call(tableDescription, 'comment')) {
      await queryInterface.removeColumn('audit', 'comment');
    }
  },
};
