'use strict';

const modelTypes = require('../src/models/qualificationUnits/qualificationUnits.modeltypes.cjs');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('qualification_unit', modelTypes);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('qualification_unit');
  },
};
