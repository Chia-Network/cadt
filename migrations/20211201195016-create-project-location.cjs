'use strict';

const modelTypes = require('../src/models/locations/locations.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('projectLocations', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('projectLocations');
  },
};
