'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn('projects', 'description', {
        type: Sequelize.STRING,
        allowNull: true,
      }),

      queryInterface.sequelize.query(`drop table projects_fts;`),

      queryInterface.sequelize.query(`
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
      `),
    ]);
  },

  async down(queryInterface) {
    await Promise.all([
      queryInterface.removeColumn('projects', 'description'),

      queryInterface.sequelize.query(`drop table projects_fts;`),

      queryInterface.sequelize.query(`
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
      `),
    ]);
  },
};
