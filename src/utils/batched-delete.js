'use strict';

import { Op } from 'sequelize';

// Rows deleted per organization-purge batch. Background orglist purges run in
// committed-batch mode, so each batch is its own transaction: a smaller batch
// holds the SQLite write lock for a shorter window between commits, letting
// other writers interleave. Kept deliberately conservative to avoid the purge
// ever becoming a lock-contention source, at the cost of some extra overhead on
// very large purges.
export const DEFAULT_ORG_PURGE_DELETE_BATCH_SIZE = 1000;

export const resolveDeleteBatchSize = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ORG_PURGE_DELETE_BATCH_SIZE;
};

const buildPrimaryKeyWhere = (primaryKeyAttributes, rows) => {
  if (primaryKeyAttributes.length === 1) {
    const primaryKey = primaryKeyAttributes[0];
    return {
      [primaryKey]: {
        [Op.in]: rows.map((row) => row[primaryKey]),
      },
    };
  }

  return {
    [Op.or]: rows.map((row) =>
      Object.fromEntries(
        primaryKeyAttributes.map((primaryKey) => [primaryKey, row[primaryKey]]),
      ),
    ),
  };
};

export const destroyByPrimaryKeyBatches = async (
  model,
  {
    where,
    batchSize,
    transactionRunner,
    findOptions = {},
  } = {},
) => {
  const primaryKeyAttributes = model.primaryKeyAttributes || [];
  if (!primaryKeyAttributes.length) {
    throw new Error(`${model.name} does not define a primary key`);
  }

  let totalDeleted = 0;
  while (true) {
    const selectBatch = (transaction) =>
      model.findAll({
        where,
        attributes: primaryKeyAttributes,
        limit: batchSize,
        raw: true,
        transaction,
        ...findOptions,
      });

    const deleteBatch = async (transaction) => {
      const batchRows = await selectBatch(transaction);

      if (!batchRows.length) {
        return 0;
      }

      return await model.destroy({
        where: buildPrimaryKeyWhere(primaryKeyAttributes, batchRows),
        transaction,
      });
    };

    let deleted;
    try {
      deleted = transactionRunner
        ? await transactionRunner(deleteBatch)
        : await deleteBatch();
      totalDeleted += deleted;
    } catch (error) {
      throw new Error(
        `failed to delete ${model.name} batch after ${totalDeleted} row(s): ${error.message}`,
      );
    }

    if (deleted < batchSize) {
      break;
    }
  }

  return totalDeleted;
};
