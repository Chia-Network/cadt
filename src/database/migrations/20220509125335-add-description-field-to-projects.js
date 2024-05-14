'use strict';

export default {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('projects');

    // Check if the 'description' column exists before adding it
    if (!tableDescription.description) {
      await queryInterface.addColumn('projects', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      const tables = await queryInterface.showAllTables();

      // Drop the virtual table if it exists
      if (tables.includes('projects_fts')) {
        await queryInterface.sequelize.query(`DROP TABLE projects_fts;`);
      }

      // Create the virtual table
      await queryInterface.sequelize.query(`
        CREATE VIRTUAL TABLE projects_fts USING fts5(
          warehouseProjectId,
          orgUid,
          currentRegistry,
          projectId,
          registryOfOrigin,
          originProjectId,
          program,
          projectName,
          projectLink,
          projectDeveloper,
          sector,
          coveredByNDC,
          projectType,
          projectTags,
          ndcInformation,
          projectStatus,
          projectStatusDate,
          unitMetric,
          methodology,
          validationBody,
          validationDate,
          timeStaged,
          description
        );
      `);
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('projects');

    // Remove the 'description' column if it exists
    if (tableDescription.description) {
      await queryInterface.removeColumn('projects', 'description');
    }

    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      const tables = await queryInterface.showAllTables();

      // Drop the virtual table if it exists
      if (tables.includes('projects_fts')) {
        await queryInterface.sequelize.query(`DROP TABLE projects_fts;`);
      }

      // Recreate the original virtual table without the 'description' column
      await queryInterface.sequelize.query(`
        CREATE VIRTUAL TABLE projects_fts USING fts5(
          warehouseProjectId,
          orgUid,
          currentRegistry,
          projectId,
          registryOfOrigin,
          originProjectId,
          program,
          projectName,
          projectLink,
          projectDeveloper,
          sector,
          coveredByNDC,
          projectType,
          projectTags,
          ndcInformation,
          projectStatus,
          projectStatusDate,
          unitMetric,
          methodology,
          validationBody,
          validationDate,
          timeStaged
        );
      `);
    }
  },
};
