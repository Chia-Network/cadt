'use strict';

export default {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      const tables = await queryInterface.showAllTables();

      if (!tables.includes('projects_fts')) {
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
      }

      if (!tables.includes('units_fts')) {
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
            correspondingAdjustmentStatus,
            timeStaged
          );
        `);
      }
    }
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      const tables = await queryInterface.showAllTables();

      if (tables.includes('projects_fts')) {
        await queryInterface.sequelize.query('DROP TABLE projects_fts;');
      }

      if (tables.includes('units_fts')) {
        await queryInterface.sequelize.query('DROP TABLE units_fts;');
      }
    }
  },
};
