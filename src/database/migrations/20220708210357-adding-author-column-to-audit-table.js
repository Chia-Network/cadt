'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['audit'].map((table) => {
        queryInterface.addColumn(table, 'author', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['audit'].map((table) => {
        queryInterface.removeColumn(table, 'author');
      }),
    );
  },
};
