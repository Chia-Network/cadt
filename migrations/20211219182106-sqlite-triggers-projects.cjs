'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_insert_fts AFTER INSERT ON projects BEGIN
        INSERT INTO projects_fts(
          id,
          warehouseProjectId, 
          currentRegistry, 
          registryOfOrigin,
          originProjectId, 
          program, 
          projectName, 
          projectLink, 
          projectDeveloper,
          sector, 
          projectType, 
          coveredByNDC, 
          NDCLinkage, 
          projectStatus,
          projectStatusDate, 
          unitMetric, 
          methodology, 
          methodologyVersion,
          validationApproach, 
          validationDate,
          projectTag
        ) VALUES (
          new.id,
          new.warehouseProjectId,
          new.currentRegistry,
          new.registryOfOrigin,
          new.originProjectId,
          new.program,
          new.projectName,
          new.projectLink,
          new.projectDeveloper,
          new.sector,
          new.projectType,
          new.coveredByNDC,
          new.NDCLinkage,
          new.projectStatus,
          new.projectStatusDate,
          new.unitMetric,
          new.methodology,
          new.methodologyVersion,
          new.validationApproach,
          new.validationDate,
          new.projectTag
        );
      END;`);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_delete_fts AFTER DELETE ON projects BEGIN
        DELETE FROM projects_fts WHERE id = old.id;
      END;
      `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_update_fts AFTER UPDATE ON projects BEGIN
        DELETE FROM projects_fts WHERE id = old.id;
        INSERT INTO projects_fts(
          id,
          warehouseProjectId, 
          currentRegistry, 
          registryOfOrigin,
          originProjectId, 
          program, 
          projectName, 
          projectLink, 
          projectDeveloper,
          sector, 
          projectType, 
          coveredByNDC, 
          NDCLinkage, 
          projectStatus,
          projectStatusDate, 
          unitMetric, 
          methodology, 
          methodologyVersion,
          validationApproach, 
          validationDate,
          projectTag
        ) VALUES (
          new.id,
          new.warehouseProjectId,
          new.currentRegistry,
          new.registryOfOrigin,
          new.originProjectId,
          new.program,
          new.projectName,
          new.projectLink,
          new.projectDeveloper,
          new.sector,
          new.projectType,
          new.coveredByNDC,
          new.NDCLinkage,
          new.projectStatus,
          new.projectStatusDate,
          new.unitMetric,
          new.methodology,
          new.methodologyVersion,
          new.validationApproach,
          new.validationDate,
          new.projectTag
        );
      END;
      `);
    }},

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query("DROP TRIGGER project_insert_fts;");
      await queryInterface.sequelize.query("DROP TRIGGER project_delete_fts;");
      await queryInterface.sequelize.query("DROP TRIGGER project_update_fts;");
    }
  }
};
