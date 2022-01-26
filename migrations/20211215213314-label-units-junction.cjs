'use strict';

const modelTypes = require('../src/models/labelUnits/labelUnits.modeltypes.cjs');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('label_unit', modelTypes);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('label_unit');
  },
};
