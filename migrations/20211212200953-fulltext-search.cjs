'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE projects_fts USING fts5(
        orgUid,
        warehouseProjectId,
        projectId,
        projectLocationId,
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
        estimatedAnnualAverageEmissionReduction
      );
      `);
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE units_fts USING fts5(
          warehouseUnitId,
          orgUid,
          unitOwnerOrgUid,
          unitBlockStart,
          unitBlockEnd,
          unitCount,
          countryJuridictionOfOwner,
          inCountryJuridictionOfOwner,
          intendedBuyerOrgUid,
          tags,
          tokenIssuanceHash,
          marketplaceIdentifier
        );
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`drop table projects_fts;`);
      await queryInterface.sequelize.query('drop table units_fts;');
    }
  },
};
