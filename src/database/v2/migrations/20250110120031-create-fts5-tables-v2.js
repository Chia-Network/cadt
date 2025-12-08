'use strict';

export default {
  async up(queryInterface, Sequelize) {
    // Only create FTS5 tables for SQLite (FTS5 is SQLite-specific)
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      // Create projects_v2_fts virtual table
      await queryInterface.sequelize.query(`
        CREATE VIRTUAL TABLE projects_v2_fts USING fts5(
          cad_trust_project_id,
          org_uid,
          project_registry_name,
          project_id,
          project_crediting_program,
          project_name,
          project_link,
          project_description,
          project_sector,
          project_type,
          project_subtype,
          project_status,
          project_status_date,
          project_unit_metric,
          cad_trust_reference_project_id,
          cad_trust_program_id
        );
      `);

      // Create units_v2_fts virtual table
      await queryInterface.sequelize.query(`
        CREATE VIRTUAL TABLE units_v2_fts USING fts5(
          cad_trust_unit_id,
          org_uid,
          unit_serial_id,
          unit_start_block,
          unit_end_block,
          unit_count,
          unit_type,
          unit_vintage_year,
          unit_status,
          unit_status_reason,
          unit_status_date,
          unit_retirement_detail,
          unit_retirement_beneficiary,
          unit_retirement_beneficiary_id,
          unit_link,
          unit_metric,
          unit_current_owner,
          unit_itmos_reference_id,
          marketplace,
          marketplace_link,
          marketplace_identifier,
          cad_trust_issuance_id
        );
      `);

      // Populate initial data from existing tables
      await queryInterface.sequelize.query(`
        INSERT INTO projects_v2_fts SELECT
          cad_trust_project_id,
          org_uid,
          project_registry_name,
          project_id,
          project_crediting_program,
          project_name,
          project_link,
          project_description,
          project_sector,
          project_type,
          project_subtype,
          project_status,
          project_status_date,
          project_unit_metric,
          cad_trust_reference_project_id,
          cad_trust_program_id
        FROM project;
      `);

      await queryInterface.sequelize.query(`
        INSERT INTO units_v2_fts SELECT
          cad_trust_unit_id,
          org_uid,
          unit_serial_id,
          unit_start_block,
          unit_end_block,
          unit_count,
          unit_type,
          unit_vintage_year,
          unit_status,
          unit_status_reason,
          unit_status_date,
          unit_retirement_detail,
          unit_retirement_beneficiary,
          unit_retirement_beneficiary_id,
          unit_link,
          unit_metric,
          unit_current_owner,
          unit_itmos_reference_id,
          marketplace,
          marketplace_link,
          marketplace_identifier,
          cad_trust_issuance_id
        FROM unit;
      `);
    }
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS projects_v2_fts;');
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS units_v2_fts;');
    }
  },
};



