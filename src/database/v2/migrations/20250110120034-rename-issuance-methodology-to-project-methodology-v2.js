'use strict';

/**
 * Migration to rename cad_trust_methodology_id to cad_trust_project_methodology_id
 * in the issuance table. This changes the foreign key reference from the methodology
 * table to the project_methodology table.
 * 
 * Note: Existing data in the issuance table will be deleted since the foreign key
 * reference is changing (methodology -> project_methodology). Users will need to
 * recreate any issuance records with valid project_methodology references.
 */
export default {
  async up(queryInterface, Sequelize) {
    // First, delete all existing data from the issuance table since the FK reference is changing
    // This is safe because:
    // 1. The user has confirmed existing issuance data doesn't need to be retained
    // 2. The old methodology references would be invalid for project_methodology anyway
    await queryInterface.sequelize.query('DELETE FROM issuance');
    
    // Remove the old index
    try {
      await queryInterface.removeIndex('issuance', ['cad_trust_methodology_id']);
    } catch (error) {
      // Index might not exist, continue
      console.log('Note: Index on cad_trust_methodology_id may not have existed');
    }

    // SQLite requires us to recreate the table to rename a column properly
    // However, Sequelize's renameColumn should work for SQLite 3.25+
    // For maximum compatibility, we'll use raw SQL to handle this
    
    // Check if the old column exists (for fresh databases, it won't)
    const tableInfo = await queryInterface.sequelize.query(
      "PRAGMA table_info('issuance')",
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    const hasOldColumn = tableInfo.some(col => col.name === 'cad_trust_methodology_id');
    const hasNewColumn = tableInfo.some(col => col.name === 'cad_trust_project_methodology_id');
    
    if (hasOldColumn && !hasNewColumn) {
      // Rename the column
      await queryInterface.renameColumn('issuance', 'cad_trust_methodology_id', 'cad_trust_project_methodology_id');
    } else if (!hasOldColumn && !hasNewColumn) {
      // Neither column exists, add the new column (shouldn't happen normally)
      await queryInterface.addColumn('issuance', 'cad_trust_project_methodology_id', {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Foreign key to project_methodology table'
      });
    }
    // If hasNewColumn is already true, the migration has already been applied

    // Add index on new column
    try {
      await queryInterface.addIndex('issuance', ['cad_trust_project_methodology_id']);
    } catch (error) {
      // Index might already exist
      console.log('Note: Index on cad_trust_project_methodology_id may already exist');
    }
  },

  async down(queryInterface, Sequelize) {
    // Delete all data since we're reverting FK reference
    await queryInterface.sequelize.query('DELETE FROM issuance');

    // Remove the new index
    try {
      await queryInterface.removeIndex('issuance', ['cad_trust_project_methodology_id']);
    } catch (error) {
      console.log('Note: Index on cad_trust_project_methodology_id may not have existed');
    }

    // Check if we need to rename back
    const tableInfo = await queryInterface.sequelize.query(
      "PRAGMA table_info('issuance')",
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    const hasOldColumn = tableInfo.some(col => col.name === 'cad_trust_methodology_id');
    const hasNewColumn = tableInfo.some(col => col.name === 'cad_trust_project_methodology_id');
    
    if (hasNewColumn && !hasOldColumn) {
      // Rename back to original column name
      await queryInterface.renameColumn('issuance', 'cad_trust_project_methodology_id', 'cad_trust_methodology_id');
    }

    // Add index on old column
    try {
      await queryInterface.addIndex('issuance', ['cad_trust_methodology_id']);
    } catch (error) {
      console.log('Note: Index on cad_trust_methodology_id may already exist');
    }
  },
};
