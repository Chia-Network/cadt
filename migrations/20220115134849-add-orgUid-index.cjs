'use strict';

module.exports = {
  async up(queryInterface) {
    queryInterface.addIndex('projects', ['orgUid']);
    queryInterface.addIndex('units', ['orgUid']);
  },

  async down() {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
