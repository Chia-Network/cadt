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
    const { page, limit, orgUid, order } = req.query;

    const pagination = paginationParams(page, limit);

    // Use findAuditHistory (renamed from findAll to avoid Sequelize conflict)
    const auditResults = await AuditV2.findAuditHistory(
      orgUid,
      order || 'DESC',
      pagination.limit,
      page,
    );

    return res.json(optionallyPaginatedResponse(auditResults, page, limit));
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

