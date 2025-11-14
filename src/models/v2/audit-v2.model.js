'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';
import OrganizationsV2 from './organizations-v2.model.js';
import { logger } from '../../config/logger.js';

import ModelTypes from './audit-v2.modeltypes.cjs';

class AuditV2 extends Model {
  /**
   * Get audit history with pagination
   * Note: Named findAuditHistory to avoid conflict with Sequelize's built-in findAll method
   * @param {string} orgUid - Organization UID to filter by
   * @param {string} order - Sort order ('ASC' or 'DESC', defaults to 'DESC')
   * @param {number} limit - Number of records per page
   * @param {number} page - Page number (1-indexed)
   * @returns {Promise<{rows: Array, count: number}>} Audit records with total count
   * @throws {Error} If orgUid is invalid
   */
  static async findAuditHistory(orgUid, order = 'DESC', limit, page) {
    // Validate orgUid exists in V2 organizations if provided
    if (orgUid) {
      // Get all organizations and check if orgUid exists
      const orgs = await OrganizationsV2.findAll({
        attributes: ['org_uid'],
        raw: true,
      });

      const orgExists = orgs.some(org => org.org_uid === orgUid);

      if (!orgExists) {
        throw new Error(
          `The orgUid: ${orgUid} is not in the list of subscribed organizations`,
        );
      }
    }

    const where = orgUid ? { org_uid: orgUid } : {};

    const queryOptions = {
      where,
      order: [['onchain_confirmation_time_stamp', order]],
    };

    // Add pagination if limit and page are provided
    if (limit && page) {
      const offset = (page - 1) * limit;
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    // Call Sequelize's findAndCountAll directly (not overridden)
    return await AuditV2.findAndCountAll(queryOptions);
  }

  /**
   * Find conflicts in audit history
   * Note: V2 conflict detection may differ from V1 due to schema differences
   * For now, returns empty array as V2 schema structure is different
   * @param {string} orgUid - Organization UID to filter by (optional)
   * @returns {Promise<Array>} Array of conflict records
   */
  static async findConflicts(orgUid) {
    // TODO: Implement V2-specific conflict detection
    // V1 uses a SQL query to find duplicate issuances across registries
    // V2 schema is different, so conflict detection logic needs to be adapted
    // For now, return empty array as placeholder
    logger.debug('findConflicts called for V2 - returning empty array (not yet implemented)');
    return [];
  }

  /**
   * Reset organization to specific generation
   * Deletes all audit records with generation greater than the specified generation
   * @param {string} orgUid - Organization UID
   * @param {number} generation - Generation number to reset to
   * @returns {Promise<number>} Number of records deleted
   * @throws {Error} If orgUid is invalid
   */
  static async resetToGeneration(orgUid, generation) {
    // Validate orgUid exists in V2 organizations
    if (orgUid) {
      const orgs = await OrganizationsV2.findAll({
        attributes: ['org_uid'],
        raw: true,
      });

      const orgExists = orgs.some(org => org.org_uid === orgUid);

      if (!orgExists) {
        throw new Error(
          `The orgUid: ${orgUid} is not in the list of subscribed organizations`,
        );
      }
    }

    const where = {
      generation: { [Sequelize.Op.gt]: generation },
    };

    if (orgUid) {
      where.org_uid = orgUid;
    }

    return await AuditV2.destroy({ where });
  }

  /**
   * Reset organization to specific date
   * Deletes all audit records with timestamp greater than the specified date
   * @param {string} orgUid - Organization UID (optional, if not provided resets all orgs)
   * @param {Date|string} date - Date to reset to
   * @returns {Promise<number>} Number of records deleted
   * @throws {Error} If orgUid is invalid
   */
  static async resetToDate(orgUid, date) {
    const timestampInSeconds = Math.round(new Date(date).valueOf() / 1000);

    // Validate orgUid exists in V2 organizations if provided
    if (orgUid) {
      const orgs = await OrganizationsV2.findAll({
        attributes: ['org_uid'],
        raw: true,
      });

      const orgExists = orgs.some(org => org.org_uid === orgUid);

      if (!orgExists) {
        throw new Error(
          `The orgUid: ${orgUid} is not in the list of subscribed organizations`,
        );
      }

      // Reset specific organization
      return await AuditV2.destroy({
        where: {
          org_uid: orgUid,
          [Sequelize.Op.and]: Sequelize.where(
            Sequelize.cast(
              Sequelize.col('onchain_confirmation_time_stamp'),
              'UNSIGNED',
            ),
            { [Sequelize.Op.gt]: timestampInSeconds },
          ),
        },
      });
    }

    // Reset all organizations (excluding home org by default)
    const homeOrg = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    const conditions = [
      Sequelize.where(
        Sequelize.cast(
          Sequelize.col('onchain_confirmation_time_stamp'),
          'UNSIGNED',
        ),
        { [Sequelize.Op.gt]: timestampInSeconds },
      ),
    ];

    // Exclude home org from reset
    if (homeOrg) {
      conditions.push({ org_uid: { [Sequelize.Op.ne]: homeOrg.org_uid } });
    }

    return await AuditV2.destroy({
      where: { [Sequelize.Op.and]: conditions },
    });
  }
}

AuditV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AuditV2',
  tableName: 'audit',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default AuditV2;
