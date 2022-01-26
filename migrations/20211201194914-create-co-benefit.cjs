'use strict';

const modelTypes = require('../src/models/co-benefits/co-benefits.modeltypes.cjs');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('coBenefits', modelTypes);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('coBenefits');
  },
};
