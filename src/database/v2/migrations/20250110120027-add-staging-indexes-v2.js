'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    // Add index on committed column for faster filtering of unstaged records
    await queryInterface.addIndex('staging', ['committed'], {
      name: 'idx_staging_committed',
    });

    // Add index on table column for faster filtering by table name
    await queryInterface.addIndex('staging', ['table'], {
      name: 'idx_staging_table',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('staging', 'idx_staging_committed');
    await queryInterface.removeIndex('staging', 'idx_staging_table');
  },
};

