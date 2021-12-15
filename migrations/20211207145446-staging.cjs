'use strict';

const modelTypes = require('../src/models/staging/staging.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staging', modelTypes);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('staging');
  },
};
