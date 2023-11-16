'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.addColumn(table, 'sync_remaining', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: false,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.removeColumn(table, 'sync_remaining');
      }),
    );
  },
};
