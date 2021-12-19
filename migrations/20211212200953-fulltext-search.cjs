'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE projects_fts USING fts5(projects);
      `);
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE units_fts USING fts5(units);
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`drop table projects_fts;`);
      await queryInterface.sequelize.query('drop table units_fts;');
    }
  },
};
