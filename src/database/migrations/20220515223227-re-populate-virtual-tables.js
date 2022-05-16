'use strict';

export default {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`INSERT INTO projects_fts SELECT
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
      FROM projects`);
    }
  },

  down() {
    return Promise.resolve();
  },
};
