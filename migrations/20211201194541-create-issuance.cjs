'use strict';

const modelTypes = require('../src/models/issuances/issuances.modeltypes.cjs');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('issuances', modelTypes);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('issuances');
  },
};
