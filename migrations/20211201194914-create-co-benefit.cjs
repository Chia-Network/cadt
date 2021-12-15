'use strict';

const modelTypes = require('../src/models/co-benefits/co-benifets.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('coBenefits', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('coBenefits');
  },
};
