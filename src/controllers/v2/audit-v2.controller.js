'use strict';

import _ from 'lodash';
import { AuditV2 } from '../../models/v2/index.js';
import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../../utils/helpers.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
} from '../../utils/v2-data-assertions.js';

/**
 * Get audit history with pagination
 * GET /v2/audit
 * Query params: orgUid, order, limit, page
 */
export const findAll = async (req, res) => {
  try {
    const { page, limit, orgUid, order, excludeChange } = req.query;

    // Validate pagination parameters BEFORE normalization to catch invalid values
    // This prevents normalization from masking validation errors
    // Security: Validate using parseInt() which is safe - values are used in Sequelize parameterized queries
    let validatedLimit = limit;
    let validatedPage = page;

    if (limit !== undefined && limit !== null && limit !== '') {
      const safeLimit = parseInt(limit, 10);
      if (isNaN(safeLimit) || safeLimit < 1 || safeLimit > 1000) {
        return res.status(400).json({
          message: 'Cannot retrieve audit data',
          error: 'Invalid limit value. Must be between 1 and 1000',
          success: false,
        });
      }
      validatedLimit = safeLimit;
    }

    if (page !== undefined && page !== null && page !== '') {
      const safePage = parseInt(page, 10);
      if (isNaN(safePage) || safePage < 1 || safePage > 100000) {
        return res.status(400).json({
          message: 'Cannot retrieve audit data',
          error: 'Invalid page value. Must be between 1 and 100000',
          success: false,
        });
      }
      validatedPage = safePage;
    }

    // Now normalize validated values for pagination calculation
    const pagination = paginationParams(validatedPage, validatedLimit);

    // Use findAuditHistory (renamed from findAll to avoid Sequelize conflict)
    // Pass validated values - findAuditHistory will use them directly (validation already done)
    // Default invalid order values to DESC
    const validatedOrder = (order && (order.toUpperCase() === 'ASC' || order.toUpperCase() === 'DESC'))
      ? order.toUpperCase()
      : 'DESC';
    const auditResults = await AuditV2.findAuditHistory(
      orgUid,
      validatedOrder,
      pagination.limit,
      validatedPage,
      excludeChange,
    );

    return res.json(optionallyPaginatedResponse(auditResults, validatedPage, validatedLimit));
  } catch (error) {
    res.status(400).json({
      message: 'Cannot retrieve audit data',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Find conflicts in audit history
 * GET /v2/audit/findConflicts
 * Query param: orgUid (optional)
 */
export const findConflicts = async (req, res) => {
  try {
    const { orgUid } = req.query;

    const conflicts = await AuditV2.findConflicts(orgUid);

    return res.json(conflicts);
  } catch (error) {
    res.status(400).json({
      message: 'Cannot retrieve audit data',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Reset organization to specific generation
 * POST /v2/audit/resetToGeneration
 * Body: { generation, orgUid }
 */
export const resetToGeneration = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    const { generation, orgUid } = req.body;

    const result = await AuditV2.resetToGeneration(orgUid, generation);
    if (_.isNil(result)) {
      throw new Error('query failed');
    }
    return res.json({
      message: result
        ? 'reset to generation ' + String(generation)
        : 'no matching records',
      success: true,
    });
  } catch (error) {
    if (error.message === 'SQLITE_BUSY: database is locked') {
      res.status(400).json({
        message: 'failed to change generation',
        error: 'cadt is currently syncing, please try again later',
        success: false,
      });
    } else {
      res.status(400).json({
        message: 'failed to change generation',
        error: error.message,
        success: false,
      });
    }
  }
};

/**
 * Reset organization to specific date
 * POST /v2/audit/resetToDate
 * Body: { date, orgUid (optional), includeHomeOrg (optional) }
 */
export const resetToDate = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    const { date, orgUid, includeHomeOrg } = req.body;

    // Note: V2 resetToDate doesn't support includeHomeOrg parameter yet
    // It always excludes home org when orgUid is not provided
    // If includeHomeOrg is true and orgUid is not provided, we'd need to modify the model
    // For now, we'll just pass orgUid to the model method
    const result = await AuditV2.resetToDate(orgUid, date);
    if (_.isNil(result)) {
      throw new Error('query failed');
    }
    return res.json({
      message: result ? 'reset to date ' + String(date) : 'no matching records',
      success: true,
    });
  } catch (error) {
    if (error.message === 'SQLITE_BUSY: database is locked') {
      res.status(400).json({
        message: 'failed to reset to date',
        error: 'cadt is currently syncing, please try again later',
        success: false,
      });
    } else {
      res.status(400).json({
        message: 'failed to reset to date',
        error: error.message,
        success: false,
      });
    }
  }
};

