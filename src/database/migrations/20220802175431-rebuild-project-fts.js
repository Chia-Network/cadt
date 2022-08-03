'use strict';

export default {
  async up(queryInterface) {
    await queryInterface.dropTable('projects_fts');
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
        methodology2,
        validationBody,
        validationDate,
        timeStaged
      );
      `);
    await queryInterface.sequelize.query(
      `INSERT INTO projects_fts SELECT  warehouseProjectId,
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
        methodology2,
        validationBody,
        validationDate,
        timeStaged FROM projects`,
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('projects_fts');
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
    await queryInterface.sequelize.query(
      `INSERT INTO projects_fts SELECT warehouseProjectId,
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
        timeStaged FROM projects`,
    );
  },
};
