'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['audit'].map((table) => {
        queryInterface.addColumn(table, 'comment', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['audit'].map((table) => {
        queryInterface.removeColumn(table, 'comment');
      }),
    );
  },
};
