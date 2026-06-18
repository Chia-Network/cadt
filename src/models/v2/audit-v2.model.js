'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2, mirrorWriteV2 } from '../../database/v2/index.js';
import AuditV2Mirror from './audit-v2.model.mirror.js';
import OrganizationsV2 from './organizations-v2.model.js';
import { loggerV2 } from '../../config/logger.js';

import ModelTypes from './audit-v2.modeltypes.js';
import {
  getCachedCount,
  clearAuditCountCache,
} from '../../utils/audit-count-cache.js';
import { normalizeRawTimestamps } from '../../utils/helpers.js';

class AuditV2 extends Model {
  static async create(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditV2Mirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.create(values, options);
    clearAuditCountCache();
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditV2Mirror.bulkCreate(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.bulkCreate(values, options);
    clearAuditCountCache();
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditV2Mirror.update(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.update(values, options);
    clearAuditCountCache();
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditV2Mirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.upsert(values, options);
    clearAuditCountCache();
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditV2Mirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.destroy(options);
    clearAuditCountCache();
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Get audit history with pagination
   * Note: Named findAuditHistory to avoid conflict with Sequelize's built-in findAll method
   * @param {string} orgUid - Organization UID to filter by
   * @param {string} order - Sort order ('ASC' or 'DESC', defaults to 'DESC')
   * @param {number} limit - Number of records per page
   * @param {number} page - Page number (1-indexed)
   * @param {boolean} excludeChange - When true, omit the heavy `change` column
   * @returns {Promise<{rows: Array, count: number}>} Audit records with total count
   * @throws {Error} If orgUid is invalid
   */
  static async findAuditHistory(orgUid, order = 'DESC', limit, page, excludeChange = false) {
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

    // Validate order parameter to prevent SQL injection
    const safeOrder = (order && (order.toUpperCase() === 'ASC' || order.toUpperCase() === 'DESC'))
      ? order.toUpperCase()
      : 'DESC'; // Default to DESC if invalid

    const queryOptions = {
      where,
      order: [['onchain_confirmation_time_stamp', safeOrder]],
      // Plain objects instead of Sequelize instances to avoid the
      // dataValues/_previousDataValues memory overhead on large pages.
      raw: true,
    };

    if (excludeChange) {
      queryOptions.attributes = { exclude: ['change'] };
    }

    // Add pagination if limit and page are provided
    // Validate and sanitize limit and page to prevent SQL injection
    const isPaginated = Boolean(limit && page);
    if (isPaginated) {
      // Validate limit is a safe integer
      const safeLimit = parseInt(limit, 10);
      if (isNaN(safeLimit) || safeLimit < 1 || safeLimit > 1000) {
        loggerV2.warn('[v2]: Invalid limit value in findAuditHistory', { providedLimit: limit });
        throw new Error('Invalid limit value. Must be between 1 and 1000');
      }

      // Validate page is a safe integer
      const safePage = parseInt(page, 10);
      if (isNaN(safePage) || safePage < 1 || safePage > 100000) {
        loggerV2.warn('[v2]: Invalid page value in findAuditHistory', { providedPage: page });
        throw new Error('Invalid page value. Must be between 1 and 100000');
      }

      const offset = (safePage - 1) * safeLimit;
      queryOptions.limit = safeLimit;
      queryOptions.offset = offset;
    }

    // Decouple rows from the count: only the paginated response needs a total,
    // and the cached count avoids re-running COUNT(*) on every deep page.
    const rows = await AuditV2.findAll(queryOptions);
    normalizeRawTimestamps(rows, ['created_at', 'updated_at']);
    const count = isPaginated
      ? await getCachedCount(`v2:${orgUid}`, () => AuditV2.count({ where }))
      : rows.length;

    return { count, rows };
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
    loggerV2.debug('[v2]: findConflicts called for V2 - returning empty array (not yet implemented)');
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
