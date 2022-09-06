'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.addColumn(table, 'metadata', {
          type: Sequelize.String,
          allowNull: true,
          defaultValue: false,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      [].map((table) => {
        queryInterface.removeColumn(table, 'metadata');
      }),
    );
  },
};