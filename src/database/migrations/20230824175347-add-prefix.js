'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.addColumn(table, 'prefix', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: '0',
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.removeColumn(table, 'prefix');
      }),
    );
  },
};
