'use strict';

const modelTypes = require('../src/models/units/units.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('units', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('units');
  },
};
