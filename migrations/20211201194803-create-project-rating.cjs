'use strict';

const modelTypes = require('../src/models/ratings/ratings.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('projectRatings', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('projectRatings');
  },
};
