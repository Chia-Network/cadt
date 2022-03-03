'use strict';

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
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
        ) VALUES (
          new.warehouseUnitId,
          new.issuanceId,
          new.projectLocationId,
          new.orgUid,
          new.unitOwner,
          new.countryJurisdictionOfOwner,
          new.inCountryJurisdictionOfOwner,
          new.serialNumberBlock,
          new.serialNumberPattern,
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
          new.timeStaged
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
        ) VALUES (
          new.warehouseUnitId,
          new.issuanceId,
          new.projectLocationId,
          new.orgUid,
          new.unitOwner,
          new.countryJurisdictionOfOwner,
          new.inCountryJurisdictionOfOwner,
          new.serialNumberBlock,
          new.serialNumberPattern,
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
          new.correspondingAdjustmentStatus
        );
      END;
      `);
    }
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query('DROP TRIGGER unit_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER unit_delete_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER unit_update_fts;');
    }
  },
};
