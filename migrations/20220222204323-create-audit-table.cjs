'use strict';

const modelTypes = require('../src/models/audit/audit.modeltypes.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('audit', modelTypes);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit');
  },
};
