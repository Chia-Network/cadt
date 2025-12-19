'use strict';

import _ from 'lodash';

import { Sequelize } from 'sequelize';
import { StagingV2 } from '../../models/v2/index.js';

import {
  optionallyPaginatedResponse,
  paginationParams,
} from '../../utils/helpers';

import {
  assertV2IfReadOnlyMode,
  assertStagingTableNotEmpty,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
} from '../../utils/v2-data-assertions.js';
import { loggerV2 } from '../../config/logger.js';

// Note: assertWalletIsSyncedV2 doesn't exist yet, will need to be implemented
// For now, we'll skip wallet sync check or use V1 assertion if compatible

/**
 * Check if there are pending commits
 * This checks for uncommitted records (committed: false) that need to be committed,
 * NOT for committed records waiting for blockchain confirmation.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const hasPendingCommits = async (req, res) => {
  try {
    const uncommittedCount = await StagingV2.count({
      where: {
        committed: false,
        is_transfer: false,
      },
    });

    if (uncommittedCount > 0) {
      res.json({
        confirmed: false,
        message: 'There are currently pending commits',
        success: true,
      });
    } else {
      res.json({
        confirmed: true,
        message: 'There are no pending commits',
        success: true,
      });
    }
  } catch (error) {
    res.status(400).json({
      message: 'Error checking for pending commits',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get staging records with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const findAll = async (req, res) => {
  try {
    let { page, limit, type, table } = req.query;

    let pagination = paginationParams(page, limit);

    let where = {};
    if (type === 'staged') {
      where = { committed: false, failed_commit: false };
    } else if (type === 'pending') {
      where = { committed: true, failed_commit: false };
    } else if (type === 'failed') {
      where = { failed_commit: true };
    }

    if (table) {
      where.table = table;
    }

    let stagingData = await StagingV2.findAndCountAll({
      distinct: true,
      where,
      ...pagination,
    });

    const results = await Promise.all(
      stagingData.rows.map(async (stagingRecord) => {
        const { uuid, table, action, data } = stagingRecord;
        const workingData = _.cloneDeep(stagingRecord.dataValues);
        workingData.diff = await StagingV2.getDiffObject(
          uuid,
          table,
          action,
          data,
        );

        delete workingData.data;

        return workingData;
      }),
    );

    stagingData.rows = results;

    const response = optionallyPaginatedResponse(stagingData, page, limit);

    res.json(response);
  } catch (error) {
    res.status(400).json({
      message: 'Error retrieving staging table',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Commit staging records to datalayer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const commit = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertV2HomeOrgExists();
    // Note: assertWalletIsSyncedV2 doesn't exist yet, skipping for now
    // await assertWalletIsSyncedV2();
    await assertNoPendingCommitsExcludingTransfers();

    // Validate ids parameter if provided - must be an array to prevent DoS attacks
    let ids = _.get(req, 'body.ids', []);
    if (ids !== undefined && ids !== null) {
      if (!Array.isArray(ids)) {
        return res.status(400).json({
          message: 'Error committing staging table',
          error: 'ids must be an array',
          success: false,
        });
      }

      // Limit array length to prevent DoS attacks
      if (ids.length > 10000) {
        return res.status(400).json({
          message: 'Error committing staging table',
          error: 'ids array exceeds maximum length of 10000',
          success: false,
        });
      }
    } else {
      ids = [];
    }

    await StagingV2.pushToDataLayer(
      _.get(req, 'query.table', null),
      _.get(req, 'body.comment', ''),
      _.get(req, 'body.author', ''),
      ids,
    );

    res.json({
      message: 'Staging Table committing to full node',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error committing staging table:', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      errorType: typeof error,
      errorConstructor: error.constructor?.name,
    });
    const table = _.get(req, 'query.table', 'all tables');
    const ids = _.get(req, 'body.ids', []);
    // Safely get error message - handle cases where error.message might throw
    let errorMessage = 'An internal error occurred while committing staging table';
    try {
      errorMessage = error.message || errorMessage;
    } catch (msgError) {
      loggerV2.error('[v2]: Error accessing error.message:', {
        msgError: msgError.message,
        msgErrorStack: msgError.stack,
      });
      errorMessage = 'An internal error occurred (error message unavailable)';
    }
    res.status(400).json({
      message: 'Error committing staging table',
      error: errorMessage,
      success: false,
    });
  }
};

/**
 * Delete staging record by UUID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const destroy = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    // Note: assertStagingRecordExistsV2 doesn't exist yet
    // For now, we'll let the destroy fail naturally if UUID doesn't exist
    await StagingV2.destroy({
      where: {
        uuid: req.body.uuid,
      },
    });
    res.json({
      message: 'Deleted from staging',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error removing staging record:', error);
    const uuid = req.body?.uuid || 'unknown';
    res.status(400).json({
      message: 'Cannot remove staging record',
      error: error.message || `An internal error occurred while removing staging record with uuid '${uuid}'`,
      success: false,
    });
  }
};

/**
 * Truncate all staging records
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const clean = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await StagingV2.destroy({
      where: {
        id: {
          [Sequelize.Op.ne]: null,
        },
      },
      truncate: true,
    });
    res.json({
      message: 'Staging Data Cleaned',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error cleaning staging table:', error);
    res.status(400).json({
      message: 'Error cleaning staging table',
      error: error.message || 'An internal error occurred while cleaning the staging table',
      success: false,
    });
  }
};

/**
 * Update staging record data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const editRecord = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    // Note: assertStagingRecordExistsV2 doesn't exist yet
    // For now, we'll let the update fail naturally if UUID doesn't exist

    // Validate that data is an array to prevent DoS attacks via malicious length property
    if (!req.body.data) {
      return res.status(400).json({
        message: 'Staging Record can not be edited.',
        error: 'data field is required',
        success: false,
      });
    }

    if (!Array.isArray(req.body.data)) {
      return res.status(400).json({
        message: 'Staging Record can not be edited.',
        error: 'data must be an array',
        success: false,
      });
    }

    // Limit array length to prevent DoS attacks
    if (req.body.data.length > 10000) {
      return res.status(400).json({
        message: 'Staging Record can not be edited.',
        error: 'data array exceeds maximum length of 10000',
        success: false,
      });
    }

    await StagingV2.update(
      { data: JSON.stringify(_.flatten([req.body.data])) },
      { where: { uuid: req.body.uuid } },
    );

    res.status(200).json({
      message: 'Staging Record successfully updated.',
    });
  } catch (error) {
    loggerV2.error('[v2]: Error editing staging record:', error);
    const uuid = req.body?.uuid || 'unknown';
    res.status(400).json({
      message: 'Cannot edit staging record',
      error: error.message || `An internal error occurred while editing staging record with uuid '${uuid}'`,
      success: false,
    });
  }
};

/**
 * Reset committed records that are blocking new commits
 * This is useful when a commit partially succeeded but then failed,
 * leaving some records with committed: true that block future commits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const resetCommittedRecords = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();

    // Reset all committed records that haven't failed (these are blocking new commits)
    // This handles the case where a commit partially succeeded but then failed
    const [affectedRows] = await StagingV2.update(
      { committed: false },
      {
        where: {
          committed: true,
          failed_commit: false,
          is_transfer: false,
        },
      },
    );

    res.json({
      message: `Reset ${affectedRows} committed staging record(s). You can now retry your commit.`,
      affectedRows,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error resetting committed records',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Reset failed commit for retry
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const retryRecord = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();

    // Validate UUID is provided
    if (!req.body.uuid) {
      return res.status(400).json({
        message: 'UUID is required',
        error: 'Missing uuid in request body',
        success: false,
      });
    }

    // Check if record exists and has failed_commit: true
    const existingRecord = await StagingV2.findOne({
      where: {
        uuid: req.body.uuid,
        failed_commit: true,
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: 'No failed staging record found with the provided UUID',
        error: `No staging record with uuid '${req.body.uuid}' found with failed_commit: true`,
        success: false,
      });
    }

    // Reset failed_commit and committed flags
    const [affectedRows] = await StagingV2.update(
      { failed_commit: false, committed: false },
      {
        where: {
          uuid: req.body.uuid,
          failed_commit: true, // Only update records that have failed_commit: true
        },
      },
    );

    if (affectedRows === 0) {
      return res.status(404).json({
        message: 'No failed staging record found with the provided UUID',
        error: `No staging record with uuid '${req.body.uuid}' found with failed_commit: true`,
        success: false,
      });
    }

    res.json({
      message:
        'Staging record re-staged successfully. Please retry your staging commit using POST /v2/staging/commit.',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error restaging record:', error);
    const uuid = req.body?.uuid || 'unknown';
    res.status(400).json({
      message: 'Cannot restage staging record',
      error: error.message || `An internal error occurred while restaging record with uuid '${uuid}'`,
      success: false,
    });
  }
};

/**
 * Generate offer file for project transfer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generateOfferFile = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertV2HomeOrgExists();
    // Note: assertWalletIsSyncedV2 doesn't exist yet, skipping for now
    // await assertWalletIsSyncedV2();
    await assertNoPendingCommitsExcludingTransfers();

    const offerFile = await StagingV2.generateOfferFile();
    res.json(offerFile);
  } catch (error) {
    loggerV2.error('[v2]: Error generating offer file:', error);
    res.status(400).json({
      message: 'Error generating offer file',
      error: error.message || 'An internal error occurred while generating the offer file',
      success: false,
    });
  }
};

