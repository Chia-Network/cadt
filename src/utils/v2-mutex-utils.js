'use strict';

import { Mutex } from 'async-mutex';

/**
 * Mutex which must be acquired to run the sync-registries-v2 task job.
 * This mutex exists to prevent multiple registry sync tasks from running at the same time
 * and overloading the chia RPC's or causing a SQLite locking error due to multiple task
 * instances trying to commit large update transactions.
 * @type {Mutex}
 */
export const syncRegistriesTaskMutexV2 = new Mutex();

/**
 * Mutex which must be acquired when writing registry update information until the transaction
 * has been committed. Audit model update transactions are large and lock the DB for long periods.
 * @type {Mutex}
 */
export const processingSyncRegistriesTransactionMutexV2 = new Mutex();
