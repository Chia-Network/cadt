'use strict';

const modelTypes = require('../src/models/qualifications/qualifications.modeltypes.cjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('qualifications', modelTypes);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('qualifications');
  },
};
