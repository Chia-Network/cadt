import { logger } from '../config/logger.js';
import { OrganizationsV2 } from '../models/v2/index.js';

/**
 * Enhanced foreign key validation that checks both main table and staging table
 * @param {Model} Model - Sequelize model to check
 * @param {string} id - Record ID to validate
 * @param {Model} StagingModel - Staging model to check
 * @param {string} primaryKey - Primary key field name
 * @returns {Promise<void>}
 */
export const assertRecordExistanceOrStaged = async (Model, id, StagingModel, primaryKey) => {
  try {
    // Check main table first
    const mainRecord = await Model.findByPk(id);
    if (mainRecord) {
      return; // Record exists in main table
    }

    // Check staging table for uncommitted records
    const stagingRecord = await StagingModel.findOne({
      where: {
        table: Model.tableName || Model.name,
        action: ['INSERT', 'UPDATE'],
        data: {
          [Model.sequelize.Sequelize.Op.like]: `%"${primaryKey}":"${id}"%`
        }
      }
    });

    if (stagingRecord) {
      return; // Record exists in staging
    }

    // Record not found in either location
    throw new Error(`Record with ${primaryKey} '${id}' not found in main table or staging`);
  } catch (error) {
    logger.error(`Foreign key validation failed for ${Model.name}:`, error);
    throw error;
  }
};

/**
 * V2-specific home organization assertion
 * @returns {Promise<void>}
 */
export const assertV2HomeOrgExists = async () => {
  const homeOrg = await OrganizationsV2.findOne({
    where: { isHome: true },
    raw: true,
  });

  if (!homeOrg) {
    throw new Error(
      `No V2 Home organization found, please create an organization to write data`,
    );
  }

  if (!homeOrg.subscribed || homeOrg.subscribed === 0) {
    throw new Error(
      `Your V2 Home organization is still confirming, please wait a little longer for it to finish.`,
    );
  }

  return homeOrg;
};

/**
 * Check if staging table is empty
 * @param {Model} StagingModel - Staging model
 * @returns {Promise<void>}
 */
export const assertStagingTableIsEmpty = async (StagingModel) => {
  const count = await StagingModel.count();
  if (count > 0) {
    throw new Error('V2 Staging table is not empty. Please commit or clean staging first.');
  }
};

/**
 * Check if staging table is not empty
 * @param {Model} StagingModel - Staging model
 * @returns {Promise<void>}
 */
export const assertStagingTableNotEmpty = async (StagingModel) => {
  const count = await StagingModel.count();
  if (count === 0) {
    throw new Error('V2 Staging table is empty. Please stage some records first.');
  }
};

/**
 * Check if there are no pending commits (excluding transfers)
 * @param {Model} StagingModel - Staging model
 * @returns {Promise<void>}
 */
export const assertNoPendingCommitsExcludingTransfers = async (StagingModel) => {
  const count = await StagingModel.count({
    where: {
      isTransfer: false,
      commited: false
    }
  });
  if (count > 0) {
    throw new Error('There are pending commits in staging. Please commit or clean staging first.');
  }
};

/**
 * Check if there's an active offer file
 * @param {Model} MetaModel - Meta model
 * @returns {Promise<void>}
 */
export const assertActiveOfferFile = async (MetaModel) => {
  const activeOffer = await MetaModel.findOne({
    where: { metaKey: 'activeOfferTradeId' }
  });
  if (!activeOffer) {
    throw new Error('No active offer file found.');
  }
};

/**
 * Check if there's no active offer file
 * @param {Model} MetaModel - Meta model
 * @returns {Promise<void>}
 */
export const assertNoActiveOfferFile = async (MetaModel) => {
  const activeOffer = await MetaModel.findOne({
    where: { metaKey: 'activeOfferTradeId' }
  });
  if (activeOffer) {
    throw new Error('There is already an active offer file. Please cancel it first.');
  }
};



