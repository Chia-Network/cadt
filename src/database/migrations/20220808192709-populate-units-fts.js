'use strict';

export default {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.dropTable('units_fts');
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
        unitBlockStart,
        unitBlockEnd,
        unitCount,
        timeStaged
      );
      `);
      await queryInterface.sequelize.query(
        `INSERT INTO units_fts SELECT
        warehouseUnitId,
        issuanceId,
        projectLocationId,
        orgUid,
        unitOwner,
        countryJurisdictionOfOwner,
        inCountryJurisdictionOfOwner,
        serialNumberBlock,
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
        unitBlockStart,
        unitBlockEnd,
        unitCount,
        timeStaged
      FROM units`,
      );

      await queryInterface.sequelize.query(`
      CREATE TRIGGER unit_insert_fts AFTER INSERT ON units BEGIN
        INSERT INTO units_fts(
          warehouseUnitId,
          issuanceId,
          projectLocationId,
          orgUid,
          unitOwner,
          countryJurisdictionOfOwner,
          inCountryJurisdictionOfOwner,
          serialNumberBlock,
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
          unitBlockStart,
          unitBlockEnd,
          unitCount
        ) VALUES (
          new.warehouseUnitId,
          new.issuanceId,
          new.projectLocationId,
          new.orgUid,
          new.unitOwner,
          new.countryJurisdictionOfOwner,
          new.inCountryJurisdictionOfOwner,
          new.serialNumberBlock,
          new.vintageYear,
          new.unitType,
          new.marketplace,
          new.marketplaceLink,
          new.marketplaceIdentifier,
          new.unitTags,
          new.unitStatus,
          new.unitStatusReason,
          new.unitRegistryLink,
          new.correspondingAdjustmentDeclaration,
          new.correspondingAdjustmentStatus,
          new.unitBlockStart,
          new.unitBlockEnd,
          new.unitCount
        );
      END;`);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER unit_delete_fts AFTER DELETE ON units BEGIN
        DELETE FROM units_fts WHERE warehouseUnitId = old.warehouseUnitId;
      END;
      `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER unit_update_fts AFTER UPDATE ON units BEGIN
        DELETE FROM units_fts WHERE warehouseUnitId = old.warehouseUnitId;
        INSERT INTO units_fts(
          warehouseUnitId,
          issuanceId,
          projectLocationId,
          orgUid,
          unitOwner,
          countryJurisdictionOfOwner,
          inCountryJurisdictionOfOwner,
          serialNumberBlock,
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
          unitBlockStart,
          unitBlockEnd,
          unitCount
        ) VALUES (
         new.warehouseUnitId,
          new.issuanceId,
          new.projectLocationId,
          new.orgUid,
          new.unitOwner,
          new.countryJurisdictionOfOwner,
          new.inCountryJurisdictionOfOwner,
          new.serialNumberBlock,
          new.vintageYear,
          new.unitType,
          new.marketplace,
          new.marketplaceLink,
          new.marketplaceIdentifier,
          new.unitTags,
          new.unitStatus,
          new.unitStatusReason,
          new.unitRegistryLink,
          new.correspondingAdjustmentDeclaration,
          new.correspondingAdjustmentStatus,
          new.unitBlockStart,
          new.unitBlockEnd,
          new.unitCount
        );
      END;
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('units_fts');
    await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE units_fts USING fts5(
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
    await queryInterface.sequelize.query(
      `INSERT INTO units_fts SELECT warehouseUnitId,
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
        timeStaged FROM units`,
    );
  },
};
