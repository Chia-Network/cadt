import { columnsToInclude } from './helpers.js';
import Sequelize from 'sequelize';
import { Mutex } from 'async-mutex';

export async function waitForSyncRegistriesTransaction() {
  if (processingSyncRegistriesTransactionMutex.isLocked()) {
    // when the mutex is acquired, the current sync transaction has completed
    const releaseMutex =
      await processingSyncRegistriesTransactionMutex.acquire();
    await releaseMutex();
  }
}

/**
 * mutex which must be acquired to run the sync-registries task job.
 * this mutex exists to prevent multiple registry sync tasks from running at the same time and overloading the chia
 * RPC's or causing a SQLite locking error due to multiple task instances trying to commit large update transactions
 * @type {Mutex}
 */
export const syncRegistriesTaskMutex = new Mutex();

/**
 * mutex which must be acquired when writing registry update information until the transaction has been committed
 * audit model update transactions are large and lock the DB for long periods.
 * @type {Mutex}
 */
export const processingSyncRegistriesTransactionMutex = new Mutex();

export function formatModelAssociationName(model) {
  if (model == null || model.model == null) return '';

  return `${model.model.name}${model.pluralize ? 's' : ''}`;
}

/**
 * mutex which should be acquired by any function what intends on deleting or adding rows to the organization table
 * @type {Mutex}
 */
export const addOrDeleteOrganizationRecordMutex = new Mutex();

/**
 * Finds the deleted sub-items (e.g. labels)
 * @param updatedItems {Array<Object>} - The projects updated by the user
 * @param primaryKeyMap {Object} - Object map containing the primary keys for all tables
 * @param model {Unit | Project} - the model to operate in
 * @param modelKeyName {string} - the name of the key correspondent in {@param primaryKeyMap} for the model
 */
export async function getDeletedItems(
  updatedItems,
  primaryKeyMap,
  model,
  modelKeyName,
) {
  const updatedUnitIds = updatedItems
    .map((record) => record[primaryKeyMap[modelKeyName]])
    .filter(Boolean);

  let originalProjects = [];
  if (updatedUnitIds.length > 0) {
    const includes = model.getAssociatedModels();

    const columns = [primaryKeyMap[modelKeyName]].concat(
      includes.map(formatModelAssociationName),
    );

    const query = {
      ...columnsToInclude(columns, includes),
    };

    originalProjects = await model.findAll({
      where: {
        [primaryKeyMap[modelKeyName]]: {
          [Sequelize.Op.in]: updatedUnitIds,
        },
      },
      ...query,
    });
  }

  const associatedColumns = model
    .getAssociatedModels()
    .map(formatModelAssociationName);

  return originalProjects.map((originalItem) => {
    const result = { ...originalItem.dataValues };

    const updatedItem = updatedItems.find(
      (item) =>
        item[primaryKeyMap[modelKeyName]] ===
        originalItem[primaryKeyMap[modelKeyName]],
    );
    if (updatedItem == null) return;

    associatedColumns.forEach((column) => {
      if (originalItem[column] == null || !Array.isArray(originalItem[column]))
        return;
      if (updatedItem[column] == null || !Array.isArray(updatedItem[column]))
        return;

      result[column] = [...originalItem[column]];
      for (let index = originalItem[column].length - 1; index >= 0; --index) {
        const item = originalItem[column][index];
        if (
          updatedItem[column].findIndex(
            (searchedItem) =>
              searchedItem[primaryKeyMap[column]] ===
              item[primaryKeyMap[column]],
          ) >= 0
        )
          result[column].splice(index, 1);
      }
    });
    return result;
  });
}
