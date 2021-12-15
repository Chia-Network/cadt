'use strict';

const modelTypes = require('../src/models/vintages/vintages.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vintages', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vintages');
  },
};
