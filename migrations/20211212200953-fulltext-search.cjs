'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.dialect == 'sqlite') {
      await queryInterface.sequelize.query(`
      create virtual table Projects using fts5
        (warehouseProjectId, currentRegistry, registryOfOrigin,
        originProjectId, program, projectName, projectLink, projectDeveloper,
        sector, projectType, coveredByNDC, NDCLinkage, projectStatus,
        projectStatusDate, unitMetric, methodology, methodologyVersion,
        validationApproach, validationDate, projectTag,
        estimatedAnnualAverageEmissionReduction, owner);`);
      await queryInterface.sequelize.query("create virtual table Units using fts5" +
        "(ProjectId, owner, buyer, registry, blockIdentifier, identifier," +
        "qualificationId, unitType, unitCount, unitStatus, unitStatusDate," +
        "transactionType, unitIssuanceLocation, unitLink, correspondingAdjustment," +
        "unitTag, vintageId);");
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.dialect == 'sqlite') {
      await queryInterface.sequelize.query(`drop virtual table Projects;`);
      await queryInterface.sequelize.query("create virtual table Units using fts5" +
        "(ProjectId, owner, buyer, registry, blockIdentifier, identifier," +
        "qualificationId, unitType, unitCount, unitStatus, unitStatusDate," +
        "transactionType, unitIssuanceLocation, unitLink, correspondingAdjustment," +
        "unitTag, vintageId);");
    }
  }
};
