'use strict';

const TABLES = ['methodology', 'program', 'stakeholder', 'label', 'aef_t1_submission'];

export default {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'org_uid', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
      await queryInterface.addIndex(table, ['org_uid'], {
        name: `${table}_org_uid`,
      });
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      try {
        await queryInterface.removeIndex(table, `${table}_org_uid`);
      } catch {
        // Index may not exist
      }
      await queryInterface.removeColumn(table, 'org_uid');
    }
  },
};
