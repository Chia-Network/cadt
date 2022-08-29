'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['staging'].map((table) => {
        queryInterface.addColumn(table, 'isTransfer', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['staging'].map((table) => {
        queryInterface.removeColumn(table, 'isTransfer');
      }),
    );
  },
};
