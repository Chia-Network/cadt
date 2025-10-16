import { logger } from '../config/logger.js';

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
 * Check if staging table is empty
 * @param {Model} StagingModel - Staging model
 * @returns {Promise<void>}
 */
export const assertStagingTableIsEmpty = async (StagingModel) => {
  const count = await StagingModel.count();
  if (count > 0) {
    throw new Error('Staging table is not empty. Please commit or clean staging first.');
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
    throw new Error('Staging table is empty. Please stage some records first.');
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

