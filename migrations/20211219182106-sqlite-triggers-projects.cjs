'use strict';

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_insert_fts AFTER INSERT ON projects BEGIN
        INSERT INTO projects_fts(
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
        ) VALUES (
          new.warehouseProjectId,
          new.orgUid,
          new.currentRegistry,
          new.projectId,
          new.registryOfOrigin,
          new.originProjectId,
          new.program,
          new.projectName,
          new.projectLink,
          new.projectDeveloper,
          new.sector,
          new.coveredByNDC,
          new.projectType,
          new.projectTags,
          new.ndcInformation,
          new.projectStatus,
          new.projectStatusDate,
          new.unitMetric,
          new.methodology,
          new.validationBody,
          new.validationDate,
          new.timeStaged
        );
      END;`);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_delete_fts AFTER DELETE ON projects BEGIN
        DELETE FROM projects_fts WHERE warehouseProjectId = old.warehouseProjectId;
      END;
      `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_update_fts AFTER UPDATE ON projects BEGIN
        DELETE FROM projects_fts WHERE warehouseProjectId = old.warehouseProjectId;
        INSERT INTO projects_fts(
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
        ) VALUES (
          new.warehouseProjectId,
          new.orgUid,
          new.currentRegistry,
          new.projectId,
          new.registryOfOrigin,
          new.originProjectId,
          new.program,
          new.projectName,
          new.projectLink,
          new.projectDeveloper,
          new.sector,
          new.coveredByNDC,
          new.projectType,
          new.projectTags,
          new.ndcInformation,
          new.projectStatus,
          new.projectStatusDate,
          new.unitMetric,
          new.methodology,
          new.validationBody,
          new.validationDate,
          new.timeStaged
        );
      END;
      `);
    }
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query('DROP TRIGGER project_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER project_delete_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER project_update_fts;');
    }
  },
};
