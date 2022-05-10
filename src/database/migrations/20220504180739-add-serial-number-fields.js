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
        type: Sequelize.INTEGER,
        allowNull: true,
      }),
      queryInterface.removeColumn('units', 'serialNumberPattern'),
    ]);
  },

  async down(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.removeColumn('units', 'unitBlockStart'),
      queryInterface.removeColumn('units', 'unitBlockEnd'),
      queryInterface.removeColumn('units', 'unitCount'),
      queryInterface.addColumn('units', 'serialNumberPattern', {
        type: Sequelize.STRING,
        defaultValue: '[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$',
      }),
    ]);
  },
};
