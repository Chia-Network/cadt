'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all(
      ['audit'].map((table) => {
        queryInterface.addColumn(table, 'generation', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      }),
    );
  },

  async down(queryInterface) {
    await Promise.all(
      ['audit'].map((table) => {
        queryInterface.removeColumn(table, 'generation');
      }),
    );
  },
};
