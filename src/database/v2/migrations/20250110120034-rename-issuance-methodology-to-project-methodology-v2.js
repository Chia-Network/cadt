'use strict';

/**
 * Migration to rename cad_trust_methodology_id to cad_trust_project_methodology_id
 * in the issuance table. The column data is identical - this is purely a name change.
 * Existing issuance data is preserved during the rename.
 */
export default {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    let tableInfo;
    if (dialect === 'mysql' || dialect === 'mariadb') {
      const [columns] = await queryInterface.sequelize.query(
        "SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'issuance' AND TABLE_SCHEMA = DATABASE()",
      );
      tableInfo = columns;
    } else {
      // SQLite
      tableInfo = await queryInterface.sequelize.query(
        "PRAGMA table_info('issuance')",
        { type: Sequelize.QueryTypes.SELECT },
      );
    }

    const hasOldColumn = tableInfo.some(col => col.name === 'cad_trust_methodology_id');
    const hasNewColumn = tableInfo.some(col => col.name === 'cad_trust_project_methodology_id');

    if (hasOldColumn && !hasNewColumn) {
      // Remove the old index before renaming
      try {
        await queryInterface.removeIndex('issuance', ['cad_trust_methodology_id']);
      } catch (error) {
        // Index might not exist, continue
        console.log('Note: Index on cad_trust_methodology_id may not have existed');
      }

      // Rename the column - preserves existing data
      await queryInterface.renameColumn('issuance', 'cad_trust_methodology_id', 'cad_trust_project_methodology_id');

      // Add index on the renamed column
      try {
        await queryInterface.addIndex('issuance', ['cad_trust_project_methodology_id']);
      } catch (error) {
        console.log('Note: Index on cad_trust_project_methodology_id may already exist');
      }
    } else if (!hasOldColumn && !hasNewColumn) {
      // If no legacy column exists, existing rows cannot be backfilled safely.
      // Keep the repair nullable so SQLite can apply it in-place.
      await queryInterface.addColumn('issuance', 'cad_trust_project_methodology_id', {
        type: Sequelize.STRING(36),
        allowNull: true,
        comment: 'Foreign key to project_methodology table',
      });

      try {
        await queryInterface.addIndex('issuance', ['cad_trust_project_methodology_id']);
      } catch (error) {
        console.log('Note: Index on cad_trust_project_methodology_id may already exist');
      }
    }
    // If hasNewColumn is already true, nothing to do - column already has the correct name
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    let tableInfo;
    if (dialect === 'mysql' || dialect === 'mariadb') {
      const [columns] = await queryInterface.sequelize.query(
        "SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'issuance' AND TABLE_SCHEMA = DATABASE()",
      );
      tableInfo = columns;
    } else {
      // SQLite
      tableInfo = await queryInterface.sequelize.query(
        "PRAGMA table_info('issuance')",
        { type: Sequelize.QueryTypes.SELECT },
      );
    }

    const hasOldColumn = tableInfo.some(col => col.name === 'cad_trust_methodology_id');
    const hasNewColumn = tableInfo.some(col => col.name === 'cad_trust_project_methodology_id');

    if (hasNewColumn && !hasOldColumn) {
      try {
        await queryInterface.removeIndex('issuance', ['cad_trust_project_methodology_id']);
      } catch (error) {
        console.log('Note: Index on cad_trust_project_methodology_id may not have existed');
      }

      await queryInterface.renameColumn('issuance', 'cad_trust_project_methodology_id', 'cad_trust_methodology_id');

      try {
        await queryInterface.addIndex('issuance', ['cad_trust_methodology_id']);
      } catch (error) {
        console.log('Note: Index on cad_trust_methodology_id may already exist');
      }
    }
  },
};
