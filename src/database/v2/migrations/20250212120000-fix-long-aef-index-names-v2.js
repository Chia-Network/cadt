'use strict';

/**
 * Corrective migration to fix AEF index names that exceed MySQL's 64-character limit.
 *
 * The original migrations (20250110120023, 20250110120024) used Sequelize's
 * auto-generated index names which exceeded 64 characters:
 *   - aef_t5_authorized_entities_aef_t5_authorized_entities_authorization_date (73 chars)
 *   - aef_t5_authorized_entities_aef_t5_authorized_entities_incorporation_country (76 chars)
 *   - aef_t2_authorizations_aef_t2_authorizations_cooperative_approach_id (68 chars)
 *
 * On SQLite these indexes were created successfully. On MySQL they failed with
 * ER_TOO_LONG_IDENT. This migration:
 *   - On SQLite: drops the old auto-named indexes and recreates with short names
 *   - On MySQL: creates the indexes with short names (they never existed)
 *   - On fresh installs: indexes already exist from the fixed originals (caught by try/catch)
 */
export default {
  async up(queryInterface, Sequelize) {
    // Fix aef_t5_authorized_entities authorization_date index
    try {
      await queryInterface.removeIndex(
        'aef_t5_authorized_entities',
        'aef_t5_authorized_entities_aef_t5_authorized_entities_authorization_date',
      );
    } catch {
      // Index may not exist (MySQL or fresh install) - that's expected
    }
    try {
      await queryInterface.addIndex(
        'aef_t5_authorized_entities',
        ['aef_t5_authorized_entities_authorization_date'],
        { name: 'aef_t5_auth_entities_auth_date' },
      );
    } catch {
      // Index may already exist (fresh install with fixed originals)
    }

    // Fix aef_t5_authorized_entities incorporation_country index
    try {
      await queryInterface.removeIndex(
        'aef_t5_authorized_entities',
        'aef_t5_authorized_entities_aef_t5_authorized_entities_incorporation_country',
      );
    } catch {
      // Index may not exist (MySQL or fresh install) - that's expected
    }
    try {
      await queryInterface.addIndex(
        'aef_t5_authorized_entities',
        ['aef_t5_authorized_entities_incorporation_country'],
        { name: 'aef_t5_auth_entities_incorp_country' },
      );
    } catch {
      // Index may already exist (fresh install with fixed originals)
    }

    // Fix aef_t2_authorizations cooperative_approach_id index
    try {
      await queryInterface.removeIndex(
        'aef_t2_authorizations',
        'aef_t2_authorizations_aef_t2_authorizations_cooperative_approach_id',
      );
    } catch {
      // Index may not exist (MySQL or fresh install) - that's expected
    }
    try {
      await queryInterface.addIndex(
        'aef_t2_authorizations',
        ['aef_t2_authorizations_cooperative_approach_id'],
        { name: 'aef_t2_auth_coop_approach_id' },
      );
    } catch {
      // Index may already exist (fresh install with fixed originals)
    }
  },

  async down(queryInterface, Sequelize) {
    // Revert to original auto-named indexes
    try {
      await queryInterface.removeIndex(
        'aef_t5_authorized_entities',
        'aef_t5_auth_entities_auth_date',
      );
    } catch {
      // Ignore
    }
    await queryInterface.addIndex(
      'aef_t5_authorized_entities',
      ['aef_t5_authorized_entities_authorization_date'],
    );

    try {
      await queryInterface.removeIndex(
        'aef_t5_authorized_entities',
        'aef_t5_auth_entities_incorp_country',
      );
    } catch {
      // Ignore
    }
    await queryInterface.addIndex(
      'aef_t5_authorized_entities',
      ['aef_t5_authorized_entities_incorporation_country'],
    );

    try {
      await queryInterface.removeIndex(
        'aef_t2_authorizations',
        'aef_t2_auth_coop_approach_id',
      );
    } catch {
      // Ignore
    }
    await queryInterface.addIndex(
      'aef_t2_authorizations',
      ['aef_t2_authorizations_cooperative_approach_id'],
    );
  },
};
