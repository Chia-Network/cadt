'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    queryInterface.addIndex('Projects', ['orgUid']);
    queryInterface.addIndex('Units', ['orgUid']);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
