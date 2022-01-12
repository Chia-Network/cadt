'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      CREATE TRIGGER unit_insert_fts AFTER INSERT ON units BEGIN
        INSERT INTO units_fts(
          warehouseUnitId,
          countryJuridictionOfOwner,
          serialNumberBlock,
          unitIdentifier,
          unitType,
          marketplace,
          tags,
          inCountryJuridictionOfOwner,
          unitStatus,
          unitTransactionType,
          unitStatusReason,
          tokenIssuanceHash,
          marketplaceIdentifier,
          unitRegistryLink,
          unitMarketplaceLink,
          correspondingAdjustmentDeclaration,
          correspondingAdjustmentStatus
        ) VALUES (
          new.warehouseUnitId,
          new.countryJuridictionOfOwner,
          new.serialNumberBlock,
          new.unitIdentifier,
          new.unitType,
          new.marketplace,
          new.tags,
          new.inCountryJuridictionOfOwner,
          new.unitStatus,
          new.unitTransactionType,
          new.unitStatusReason,
          new.tokenIssuanceHash,
          new.marketplaceIdentifier,
          new.unitRegistryLink,
          new.unitMarketplaceLink,
          new.correspondingAdjustmentDeclaration,
          new.correspondingAdjustmentStatus
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
          countryJuridictionOfOwner,
          serialNumberBlock,
          unitIdentifier,
          unitType,
          marketplace,
          tags,
          inCountryJuridictionOfOwner,
          unitStatus,
          unitTransactionType,
          unitStatusReason,
          tokenIssuanceHash,
          marketplaceIdentifier,
          unitRegistryLink,
          unitMarketplaceLink,
          correspondingAdjustmentDeclaration,
          correspondingAdjustmentStatus
        ) VALUES (
          new.warehouseUnitId,
          new.countryJuridictionOfOwner,
          new.serialNumberBlock,
          new.unitIdentifier,
          new.unitType,
          new.marketplace,
          new.tags,
          new.inCountryJuridictionOfOwner,
          new.unitStatus,
          new.unitTransactionType,
          new.unitStatusReason,
          new.tokenIssuanceHash,
          new.marketplaceIdentifier,
          new.unitRegistryLink,
          new.unitMarketplaceLink,
          new.correspondingAdjustmentDeclaration,
          new.correspondingAdjustmentStatus
        );
      END;
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query('DROP TRIGGER unit_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER unit_delete_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER unit_update_fts;');
    }
  },
};
