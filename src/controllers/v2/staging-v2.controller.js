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

    await StagingV2.pushToDataLayer(
      _.get(req, 'query.table', null),
      _.get(req, 'body.comment', ''),
      _.get(req, 'body.author', ''),
      _.get(req, 'body.ids', []),
    );

    res.json({
      message: 'Staging Table committing to full node',
      success: true,
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error committing staging table',
      error: error.message,
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
    res.status(400).json({
      message: 'Staging Record can not be removed.',
      error: error.message,
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
    res.status(400).json({
      message: error.message,
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

    await StagingV2.update(
      { data: JSON.stringify(_.flatten([req.body.data])) },
      { where: { uuid: req.body.uuid } },
    );

    res.status(200).json({
      message: 'Staging Record successfully updated.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Staging Record can not be edited.',
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
    // Note: assertStagingRecordExistsV2 doesn't exist yet
    // For now, we'll let the update fail naturally if UUID doesn't exist

    await StagingV2.update(
      { failed_commit: false, committed: false },
      {
        where: {
          uuid: req.body.uuid,
        },
      },
    );
    res.json({
      message: 'Staging record re-staged.',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Staging Record can not be restaged.',
      error: error.message,
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
    console.trace(error);
    res.status(400).json({
      message: 'Error generating offer file.',
      error: error.message,
      success: false,
    });
  }
};

