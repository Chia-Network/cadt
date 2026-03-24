'use strict';

import _ from 'lodash';

import { MetaV2, StagingV2 } from '../../models/v2/index.js';
import { OfferV2 } from '../../models/v2/offer-v2.model.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertNoPendingCommits,
  assertStagingTableNotEmpty,
  assertStagingTableIsEmpty,
} from '../../utils/v2-data-assertions.js';
import {
  isReadOnlyError,
  sendReadOnlyError,
} from '../../utils/read-only-response.js';
import { deserializeMaker, deserializeTaker } from '../../utils/datalayer-utils.js';
import { loggerV2 } from '../../config/logger.js';
import { getConfig } from '../../utils/config-loader.js';

const CONFIG = getConfig().APP;

/**
 * Generate offer file from staging transfer records
 * GET /v2/offer
 */
export const generateOfferFile = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const offerFile = await OfferV2.generateOfferFile();
    res.json(offerFile);
  } catch (error) {
    loggerV2.error('[v2]: Error generating offer file:', error);
    res.status(400).json({
      message: 'Error generating offer file.',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Cancel active offer
 * DELETE /v2/offer
 */
export const cancelActiveOffer = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    await OfferV2.cancelActiveOffer();

    res.status(200).json({
      message: 'Active offer has been canceled.',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error canceling active offer:', error);
    res.status(400).json({
      message: 'Cannot cancel active offer',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Import offer file
 * POST /v2/offer/accept/import
 */
export const importOfferFile = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertStagingTableIsEmpty();
    await assertV2HomeOrgExists();
    await assertNoPendingCommits();

    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const offerFileBuffer = req.file.buffer;
    await OfferV2.importOfferFile(offerFileBuffer);

    res.json({
      message: 'Offer has been imported for review.',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error importing offer file:', error);
    res.status(400).json({
      message: 'Cannot import offer file',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Commit imported offer
 * POST /v2/offer/accept/commit
 */
export const commitImportedOffer = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertStagingTableIsEmpty();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const result = await OfferV2.commitImportedOffer();

    res.json({
      message: 'Offer Accepted.',
      tradeId: result.tradeId,
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error committing imported offer:', error);
    res.status(400).json({
      message: 'Cannot commit offer',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Cancel imported offer
 * DELETE /v2/offer/accept/cancel
 */
export const cancelImportedOffer = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await OfferV2.cancelImportedOffer();

    res.json({
      message: 'Offer Cancelled',
      success: true,
    });
  } catch (error) {
    if (isReadOnlyError(error)) {
      return sendReadOnlyError(res);
    }
    loggerV2.error('[v2]: Error canceling imported offer:', error);
    res.status(400).json({
      message: 'Cannot cancel offer',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get current offer info
 * GET /v2/offer/accept
 */
export const getCurrentOfferInfo = async (req, res) => {
  try {
    const offerInfo = await OfferV2.getCurrentOfferInfo();

    if (!offerInfo) {
      return res.status(200).json({
        message: 'No offer to accept',
        success: true,
      });
    }

    const offerFile = offerInfo;

    // Project child records that should be nested
    const projectChildRecords = [
      'issuances',
      'projectLocations',
      'estimations',
      'labels',
      'projectRatings',
      'coBenefits',
      'relatedProjects',
    ];

    const makerChanges = deserializeMaker(offerFile.offer.maker);
    const takerChanges = deserializeTaker(offerFile.offer.taker);

    let maker = makerChanges.filter((record) => record.table === 'project');

    makerChanges.forEach((record) => {
      if (projectChildRecords.includes(record.table)) {
        if (maker.length > 0 && maker[0]) {
          if (!maker[0].value[record.table]) {
            maker[0].value[record.table] = [];
          }

          maker[0].value[record.table].push(record.value);
        }
      }
    });

    maker = maker.concat(
      makerChanges.filter((record) => record.table === 'unit'),
    );

    let taker = takerChanges.filter((record) => record.table === 'project');

    takerChanges.forEach((record) => {
      if (projectChildRecords.includes(record.table)) {
        if (taker.length > 0 && taker[0]) {
          if (!taker[0].value[record.table]) {
            taker[0].value[record.table] = [];
          }

          taker[0].value[record.table].push(record.value);
        }
      }
    });

    taker = taker.concat(
      takerChanges.filter((record) => record.table === 'unit'),
    );

    res.status(200).json({
      changes: {
        maker,
        taker,
      },
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error getting offer info:', error);
    res.status(400).json({
      message: 'Cannot get offer',
      error: error.message,
      success: false,
    });
  }
};

