'use strict';

const modelTypes = require('../src/models/simulator/simulator.modeltypes.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('simulator', modelTypes);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('simulator');
  },
};
