'use strict';

export default {
  async up(queryInterface, Sequelize) {
    const table = 'audit';
    const tableDescription = await queryInterface.describeTable(table);

    if (!tableDescription.generation) {
      await queryInterface.addColumn(table, 'generation', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'audit';
    const tableDescription = await queryInterface.describeTable(table);

    if (tableDescription.generation) {
      await queryInterface.removeColumn(table, 'generation');
    }
  },
};
