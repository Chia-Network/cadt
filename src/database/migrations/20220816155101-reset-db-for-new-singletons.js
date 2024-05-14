'use strict';

export default {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      // First, we need to check if the virtual tables and triggers already exist
      const tables = await queryInterface.showAllTables();

      // Dropping triggers if they exist
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

      // Truncate specified tables
      const truncateTables = [
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
      ];
      for (const table of truncateTables) {
        if (tables.includes(table)) {
          await queryInterface.bulkDelete(
            table,
            {},
            {
              truncate: true,
              cascade: true,
              restartIdentity: true,
            },
          );
        }
      }

      // Recreate virtual table for units if it does not exist
      if (!tables.includes('units_fts')) {
        await queryInterface.dropTable('units_fts', { force: true });
        await queryInterface.sequelize.query(`
          CREATE VIRTUAL TABLE units_fts USING fts5(
            warehouseUnitId, issuanceId, projectLocationId, orgUid, unitOwner,
            countryJurisdictionOfOwner, inCountryJurisdictionOfOwner, serialNumberBlock,
            vintageYear, unitType, marketplace, marketplaceLink, marketplaceIdentifier,
            unitTags, unitStatus, unitStatusReason, unitRegistryLink,
            correspondingAdjustmentDeclaration, correspondingAdjustmentStatus,
            unitBlockStart, unitBlockEnd, unitCount, timeStaged
          );
        `);
      }

      // Recreate virtual table for projects if it does not exist
      if (!tables.includes('projects_fts')) {
        await queryInterface.dropTable('projects_fts', { force: true });
        await queryInterface.sequelize.query(`
          CREATE VIRTUAL TABLE projects_fts USING fts5(
            warehouseProjectId, orgUid, currentRegistry, projectId, description,
            registryOfOrigin, originProjectId, program, projectName, projectLink,
            projectDeveloper, sector, coveredByNDC, projectType, projectTags,
            ndcInformation, projectStatus, projectStatusDate, unitMetric, methodology,
            methodology2, validationBody, validationDate, timeStaged
          );
        `);
      }

      // Creating triggers for 'units'
      await queryInterface.sequelize.query(`
        CREATE TRIGGER unit_insert_fts AFTER INSERT ON units BEGIN
          INSERT INTO units_fts (...) VALUES (...);
        END;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER unit_delete_fts AFTER DELETE ON units BEGIN
          DELETE FROM units_fts WHERE warehouseUnitId = old.warehouseUnitId;
        END;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER unit_update_fts AFTER UPDATE ON units BEGIN
          DELETE FROM units_fts WHERE warehouseUnitId = old.warehouseUnitId;
          INSERT INTO units_fts (...) VALUES (...);
        END;
      `);

      // Creating triggers for 'projects'
      await queryInterface.sequelize.query(`
        CREATE TRIGGER project_insert_fts AFTER INSERT ON projects BEGIN
          INSERT INTO projects_fts (...) VALUES (...);
        END;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER project_delete_fts AFTER DELETE ON projects BEGIN
          DELETE FROM projects_fts WHERE warehouseProjectId = old.warehouseProjectId;
        END;
      `);
      await queryInterface.sequelize.query(`
        CREATE TRIGGER project_update_fts AFTER UPDATE ON projects BEGIN
          DELETE FROM projects_fts WHERE warehouseProjectId = old.warehouseProjectId;
          INSERT INTO projects_fts (...) VALUES (...);
        END;
      `);
    }
  },

  async down() {
    // Add logic to reverse the 'up' migration, e.g., dropping tables and triggers
  },
};
