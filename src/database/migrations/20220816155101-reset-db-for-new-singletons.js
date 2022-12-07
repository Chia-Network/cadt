'use strict';

export default {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS project_delete_fts`,
      );
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS project_insert_fts`,
      );
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS project_update_fts`,
      );
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS unit_delete_fts`,
      );
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS unit_insert_fts`,
      );
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS unit_update_fts`,
      );
      await Promise.all(
        [
          'audit',
          'coBenefits',
          'estimations',
          'fileStore',
          'governance',
          'issuances',
          'label_unit',
          'labels',
          'meta',
          'organizations',
          'projectLocations',
          'projectRatings',
          'projects',
          'relatedProjects',
          'simulator',
          'staging',
          'units',
        ].map((table) => {
          queryInterface.bulkDelete(
            table,
            {},
            {
              truncate: true,
              cascade: true,
              restartIdentity: true,
            },
          );
        }),
      );

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

      await queryInterface.dropTable('projects_fts');
      await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE projects_fts USING fts5(
        warehouseProjectId,
        orgUid,
        currentRegistry,
        projectId,
        description,
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
        methodology2,
        validationBody,
        validationDate,
        timeStaged
      );
      `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_insert_fts AFTER INSERT ON projects BEGIN
        INSERT INTO projects_fts(
          warehouseProjectId,
          orgUid,
          currentRegistry,
          projectId,
          description,
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
          methodology2,
          validationBody,
          validationDate,
          timeStaged
        ) VALUES (
          new.warehouseProjectId,
          new.orgUid,
          new.currentRegistry,
          new.projectId,
          new.description,
          new.registryOfOrigin,
          new.originProjectId,
          new.program,
          new.projectName,
          new.projectLink,
          new.projectDeveloper,
          new.sector,
          new.coveredByNDC,
          new.projectType,
          new.projectTags,
          new.ndcInformation,
          new.projectStatus,
          new.projectStatusDate,
          new.unitMetric,
          new.methodology,
          new.methodology2,
          new.validationBody,
          new.validationDate,
          new.timeStaged
        );
      END;`);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_delete_fts AFTER DELETE ON projects BEGIN
        DELETE FROM projects_fts WHERE warehouseProjectId = old.warehouseProjectId;
      END;
      `);

      await queryInterface.sequelize.query(`
      CREATE TRIGGER project_update_fts AFTER UPDATE ON projects BEGIN
        DELETE FROM projects_fts WHERE warehouseProjectId = old.warehouseProjectId;
        INSERT INTO projects_fts(
          warehouseProjectId,
          orgUid,
          currentRegistry,
          projectId,
          description,
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
          methodology2,
          validationBody,
          validationDate,
          timeStaged
        ) VALUES (
          new.warehouseProjectId,
          new.orgUid,
          new.currentRegistry,
          new.projectId,
          new.description,
          new.registryOfOrigin,
          new.originProjectId,
          new.program,
          new.projectName,
          new.projectLink,
          new.projectDeveloper,
          new.sector,
          new.coveredByNDC,
          new.projectType,
          new.projectTags,
          new.ndcInformation,
          new.projectStatus,
          new.projectStatusDate,
          new.unitMetric,
          new.methodology,
          new.methodology2,
          new.validationBody,
          new.validationDate,
          new.timeStaged
        );
      END;
      `);
    }
  },

  async down() {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
