'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('projects', 'description', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await Promise.all([
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
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('projects', 'description');
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await Promise.all([
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
    }
  },
};
