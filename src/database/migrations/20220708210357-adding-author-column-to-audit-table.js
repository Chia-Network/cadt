'use strict';

export default {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('audit');

    // Check if the 'author' column exists before adding it
    if (!tableDescription.author) {
      await queryInterface.addColumn('audit', 'author', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('audit');

    // Check if the 'author' column exists before removing it
    if (tableDescription.author) {
      await queryInterface.removeColumn('audit', 'author');
    }
  },
};
