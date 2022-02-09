'use strict';

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
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
        validationDate
      );
      `);
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE units_fts USING fts5(
        warehouseUnitId,
        issuanceId,
        projectLocationId,
        orgUid,
        unitOwner,
        countryJurisdictionOfOwner,
        inCountryJurisdictionOfOwner,
        serialNumberBlock,
        serialNumberPattern,
        vintageYear,
        unitType,
        marketplace,
        marketplaceLink,
        marketplaceIdentifier,
        unitTags,
        unitStatus,
        unitStatusReason,
        unitRegistryLink,
        correspondingAdjustmentDeclaration,
        correspondingAdjustmentStatus
      );
      `);
    }
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`drop table projects_fts;`);
      await queryInterface.sequelize.query('drop table units_fts;');
    }
  },
};
