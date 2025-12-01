'use strict';

export default {
  async up(queryInterface, Sequelize) {
    // Only create FTS5 triggers for SQLite (FTS5 is SQLite-specific)
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      // Drop existing triggers if they exist (to allow re-running migration)
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS project_v2_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS project_v2_update_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS project_v2_delete_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS unit_v2_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS unit_v2_update_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS unit_v2_delete_fts;');

      // Projects INSERT trigger
      await queryInterface.sequelize.query(`
        CREATE TRIGGER project_v2_insert_fts AFTER INSERT ON project BEGIN
          INSERT INTO projects_v2_fts(
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
          ) VALUES (
            new.cad_trust_project_id,
            new.org_uid,
            new.project_registry_name,
            new.project_id,
            new.project_crediting_program,
            new.project_name,
            new.project_link,
            new.project_description,
            new.project_sector,
            new.project_type,
            new.project_subtype,
            new.project_status,
            new.project_status_date,
            new.project_unit_metric,
            new.cad_trust_reference_project_id,
            new.cad_trust_program_id
          );
        END;
      `);

      // Projects UPDATE trigger (using INSERT OR REPLACE for efficiency)
      await queryInterface.sequelize.query(`
        CREATE TRIGGER project_v2_update_fts AFTER UPDATE ON project BEGIN
          INSERT OR REPLACE INTO projects_v2_fts(
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
          ) VALUES (
            new.cad_trust_project_id,
            new.org_uid,
            new.project_registry_name,
            new.project_id,
            new.project_crediting_program,
            new.project_name,
            new.project_link,
            new.project_description,
            new.project_sector,
            new.project_type,
            new.project_subtype,
            new.project_status,
            new.project_status_date,
            new.project_unit_metric,
            new.cad_trust_reference_project_id,
            new.cad_trust_program_id
          );
        END;
      `);

      // Projects DELETE trigger
      await queryInterface.sequelize.query(`
        CREATE TRIGGER project_v2_delete_fts AFTER DELETE ON project BEGIN
          DELETE FROM projects_v2_fts WHERE cad_trust_project_id = old.cad_trust_project_id;
        END;
      `);

      // Units INSERT trigger
      await queryInterface.sequelize.query(`
        CREATE TRIGGER unit_v2_insert_fts AFTER INSERT ON unit BEGIN
          INSERT INTO units_v2_fts(
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
          ) VALUES (
            new.cad_trust_unit_id,
            new.org_uid,
            new.unit_serial_id,
            new.unit_start_block,
            new.unit_end_block,
            new.unit_count,
            new.unit_type,
            new.unit_vintage_year,
            new.unit_status,
            new.unit_status_reason,
            new.unit_status_date,
            new.unit_retirement_detail,
            new.unit_retirement_beneficiary,
            new.unit_retirement_beneficiary_id,
            new.unit_link,
            new.unit_metric,
            new.unit_current_owner,
            new.unit_itmos_reference_id,
            new.marketplace,
            new.marketplace_link,
            new.marketplace_identifier,
            new.cad_trust_issuance_id
          );
        END;
      `);

      // Units UPDATE trigger (using INSERT OR REPLACE for efficiency)
      await queryInterface.sequelize.query(`
        CREATE TRIGGER unit_v2_update_fts AFTER UPDATE ON unit BEGIN
          INSERT OR REPLACE INTO units_v2_fts(
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
          ) VALUES (
            new.cad_trust_unit_id,
            new.org_uid,
            new.unit_serial_id,
            new.unit_start_block,
            new.unit_end_block,
            new.unit_count,
            new.unit_type,
            new.unit_vintage_year,
            new.unit_status,
            new.unit_status_reason,
            new.unit_status_date,
            new.unit_retirement_detail,
            new.unit_retirement_beneficiary,
            new.unit_retirement_beneficiary_id,
            new.unit_link,
            new.unit_metric,
            new.unit_current_owner,
            new.unit_itmos_reference_id,
            new.marketplace,
            new.marketplace_link,
            new.marketplace_identifier,
            new.cad_trust_issuance_id
          );
        END;
      `);

      // Units DELETE trigger
      await queryInterface.sequelize.query(`
        CREATE TRIGGER unit_v2_delete_fts AFTER DELETE ON unit BEGIN
          DELETE FROM units_v2_fts WHERE cad_trust_unit_id = old.cad_trust_unit_id;
        END;
      `);

      // Verify triggers were created
      const triggerCheck = await queryInterface.sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%v2%fts%'",
        { type: Sequelize.QueryTypes.SELECT },
      );

      if (triggerCheck.length !== 6) {
        throw new Error(`Expected 6 triggers but found ${triggerCheck.length}`);
      }
    }
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() === 'sqlite') {
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS project_v2_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS project_v2_update_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS project_v2_delete_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS unit_v2_insert_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS unit_v2_update_fts;');
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS unit_v2_delete_fts;');
    }
  },
};


