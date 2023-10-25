'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.addColumn(table, 'synced', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.removeColumn(table, 'synced');
      }),
    );
  },
};
