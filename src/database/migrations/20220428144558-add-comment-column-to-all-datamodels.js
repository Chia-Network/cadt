'use strict';

export default {
  async up(queryInterface, Sequelize) {
    return Promise.all(
      ['audit'].map((table) => {
        queryInterface.addColumn(table, 'comment', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }),
    );
  },

  async down(queryInterface) {
    return Promise.all(
      ['audit'].map((table) => {
        queryInterface.removeColumn(table, 'comment');
      }),
    );
  },
};
