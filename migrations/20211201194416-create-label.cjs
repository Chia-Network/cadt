'use strict';

const modelTypes = require('../src/models/labels/labels.modeltypes.cjs');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('labels', modelTypes);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('labels');
  },
};
