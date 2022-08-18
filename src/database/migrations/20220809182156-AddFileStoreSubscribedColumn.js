'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.addColumn(table, 'fileStoreSubscribed', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['organizations'].map((table) => {
        queryInterface.removeColumn(table, 'fileStoreSubscribed');
      }),
    );
  },
};
