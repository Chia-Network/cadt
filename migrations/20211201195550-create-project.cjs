'use strict';

const modelTypes = require('../src/models/projects/projects.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('projects', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('projects');
  },
};
