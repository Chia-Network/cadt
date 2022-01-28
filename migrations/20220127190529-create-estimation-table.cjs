'use strict';

const modelTypes = require('../src/models/estimations/estimations.modeltypes.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('estimations', modelTypes);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estimations');
  },
};
