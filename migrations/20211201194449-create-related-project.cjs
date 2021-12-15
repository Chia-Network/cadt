'use strict';

const modelTypes = require('../src/models/related-projects/related-projects.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('relatedProjects', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('relatedProjects');
  },
};
