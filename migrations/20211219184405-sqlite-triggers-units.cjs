'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(`
      CREATE TRIGGER unit_insert_fts AFTER INSERT ON units BEGIN
        INSERT INTO units_fts(
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
        ) VALUES (
          new.warehouseUnitId,
          new.orgUid,
          new.unitOwnerOrgUid,
          new.unitBlockStart,
          new.unitBlockEnd,
          new.unitCount,
          new.countryJuridictionOfOwner,
          new.inCountryJuridictionOfOwner,
          new.intendedBuyerOrgUid,
          new.tags,
          new.tokenIssuanceHash,
          new.marketplaceIdentifier
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
          orgUid,
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
        ) VALUES (
          new.warehouseUnitId,
          new.orgUid,
          new.projectId,
          new.buyer,
          new.registry,
          new.blockIdentifier,
          new.identifier,
          new.qualificationId,
          new.unitType,
          new.unitCount,
          new.unitStatus,
          new.unitStatusDate,
          new.transactionType,
          new.unitIssuanceLocation,
          new.unitLink,
          new.correspondingAdjustment,
          new.unitTag,
          new.vintageId
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
