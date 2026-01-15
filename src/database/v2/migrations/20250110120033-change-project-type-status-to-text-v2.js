'use strict';

/**
 * Migration to change project_type and project_status columns from STRING to TEXT
 * to support storing JSON arrays.
 * 
 * For existing data: single string values are preserved and will be wrapped in arrays
 * when read by the model getter. No data transformation is needed during migration
 * because the model's getter handles backwards compatibility.
 */
export default {
  async up(queryInterface, Sequelize) {
    // Change project_type from STRING to TEXT
    await queryInterface.changeColumn('project', 'project_type', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Change project_status from STRING to TEXT
    await queryInterface.changeColumn('project', 'project_status', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Also update the mirror table if it exists
    try {
      await queryInterface.changeColumn('project_mirror', 'project_type', {
        type: Sequelize.TEXT,
        allowNull: true,
      });

      await queryInterface.changeColumn('project_mirror', 'project_status', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } catch (error) {
      // Mirror table may not exist, that's OK
      console.log('Note: project_mirror table does not exist or columns already changed');
    }
  },

  async down(queryInterface, Sequelize) {
    // Revert project_type back to STRING
    await queryInterface.changeColumn('project', 'project_type', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Revert project_status back to STRING
    await queryInterface.changeColumn('project', 'project_status', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Also revert the mirror table if it exists
    try {
      await queryInterface.changeColumn('project_mirror', 'project_type', {
        type: Sequelize.STRING,
        allowNull: true,
      });

      await queryInterface.changeColumn('project_mirror', 'project_status', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (error) {
      // Mirror table may not exist, that's OK
      console.log('Note: project_mirror table does not exist or columns already changed');
    }
  },
};
