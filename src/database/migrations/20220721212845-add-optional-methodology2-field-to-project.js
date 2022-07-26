'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['projects'].map((table) => {
        queryInterface.addColumn(table, 'methodology2', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['projects'].map((table) => {
        queryInterface.removeColumn(table, 'methodology2');
      }),
    );
  },
};
