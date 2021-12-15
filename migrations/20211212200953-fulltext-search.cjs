'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      create virtual table projects_fts using fts5 (
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
         projectTag,
        estimatedAnnualAverageEmissionReduction, 
        );`);
      await queryInterface.sequelize.query(
        `create virtual table units_fts using fts5 (
          projectId, 
          buyer, 
          registry, 
          blockIdentifier, 
          identifier,
          qualificationId, 
          unitType, 
          unitCount, 
          unitStatus, 
          unitStatusDate,
          transactionType, 
          unitIssuanceLocation,
          unitLink, 
          correspondingAdjustment,
          unitTag, 
          vintageId
        );`,
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`drop virtual table projects_fts;`);
      await queryInterface.sequelize.query('drop virtual table units_fts;');
    }
  },
};
