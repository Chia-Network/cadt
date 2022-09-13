'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.addColumn(table, 'metadata', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: {},
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.removeColumn(table, 'metadata');
      }),
    );
  },
};
