'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn('units', 'unitBlockStart', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn('units', 'unitBlockEnd', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn('units', 'unitCount', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
    ]);
  },

  async down(queryInterface) {
    await Promise.all([
      queryInterface.removeColumn('units', 'unitBlockStart'),
      queryInterface.removeColumn('units', 'unitBlockEnd'),
      queryInterface.removeColumn('units', 'unitCount'),
    ]);
  },
};
