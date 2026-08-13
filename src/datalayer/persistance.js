import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { getConfig, getConfigV2 } from '../utils/config-loader';
import wallet from './wallet';
import { Organization } from '../models';
import { OrganizationsV2 } from '../models/v2/index.js';
import { logger } from '../config/logger.js';
import { getChiaRoot } from '../utils/chia-root.js';
import { getMirrorUrl, decodeHex } from '../utils/datalayer-utils';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const CONFIG = getConfig().APP;

/**
 * Get home organization from the appropriate version (V2 if enabled, otherwise V1)
 * Prioritizes V2 when enabled, falls back to V1 only if V1 is also enabled
 * @returns {Promise<Object|null>} Home organization record or null if not found
 */
const getHomeOrg = async () => {
  const configV1 = getConfig();
  const configV2 = getConfigV2();
  const enableV1 = configV1?.ENABLE !== false;
  const enableV2 = configV2?.ENABLE !== false;

  // Try V2 first if enabled
  if (enableV2) {
    try {
      const v2HomeOrg = await OrganizationsV2.getHomeOrg();
      if (v2HomeOrg) {
        return v2HomeOrg;
      }
    } catch (error) {
      // V2 org doesn't exist or error - fall through to V1 if enabled
      logger.debug('[persistance]: V2 home org not found, trying V1');
    }
  }

  // Fallback to V1 only if V1 is enabled
  if (enableV1) {
    try {
      return await Organization.getHomeOrg();
    } catch (error) {
      // V1 org doesn't exist
      logger.debug('[persistance]: No home org found in V1');
      return null;
    }
  }

  // Neither V1 nor V2 is enabled or orgs don't exist
  logger.debug(
    '[persistance]: No home org found - V1 and V2 both disabled or no orgs exist',
  );
  return null;
};

const getBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certificateFolderPath =
    CONFIG.CERTIFICATE_FOLDER_PATH || `${chiaRoot}/config/ssl`;

  const certFile = path.resolve(
    `${certificateFolderPath}/data_layer/private_data_layer.crt`,
  );

  const keyFile = path.resolve(
    `${certificateFolderPath}/data_layer/private_data_layer.key`,
  );

  const baseOptions = {
    method: 'POST',
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
    timeout: 1_800_000,
  };
  return baseOptions;
};

const getValue = async (storeId, storeKey) => {
  const url = `${CONFIG.DATALAYER_URL}/get_value`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId, key: storeKey });

    const data = response.body;

    if (data.success) {
      return data.value;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const getMirrors = async (storeId) => {
  logger.silly(`[MIRROR_DEBUG] Starting getMirrors for storeId: ${storeId}`);

  // In simulator mode, return empty array (no mirrors in simulator)
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    logger.debug(
      `[MIRROR_DEBUG] Simulator mode - returning empty mirrors array`,
    );
    return [];
  }

  const url = `${CONFIG.DATALAYER_URL}/get_mirrors`;
  const { cert, key, timeout } = getBaseOptions();

  logger.silly(`[MIRROR_DEBUG] Making RPC call to: ${url}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId });

    const data = response.body;
    logger.debug(
      `[MIRROR_DEBUG] getMirrors RPC response: ${JSON.stringify(data)}`,
    );

    if (data.success) {
      logger.debug(
        `[MIRROR_DEBUG] Successfully retrieved ${data.mirrors ? data.mirrors.length : 0} mirrors for storeId: ${storeId}`,
      );
      return data.mirrors;
    }

    logger.error(`FAILED GETTING MIRRORS FOR ${storeId}`);
    logger.debug(
      `[MIRROR_DEBUG] getMirrors failed - response: ${JSON.stringify(data)}`,
    );
    return [];
  } catch (error) {
    logger.error(error);
    logger.silly(`[MIRROR_DEBUG] getMirrors error: ${error.message}`);
    return [];
  }
};

const clearPendingRoots = async (storeId) => {
  const url = `${CONFIG.DATALAYER_URL}/clear_pending_roots`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ store_id: storeId });

    const data = response.body;

    if (data.success) {
      return true;
    }

    logger.error(`Unable to clear pending root for ${storeId}`);
    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

/**
 * DataLayer stages a pending root before it creates the wallet transaction that
 * publishes it, so a failure between those two steps leaves a root DataLayer
 * will never reconcile: its confirmation check returns early while the store's
 * on-chain generation stays put, and every later push to the store is rejected.
 * Dropping the root is only safe once the wallet is known to be settled, since
 * an unconfirmed transaction may be the one the root is waiting on.
 *
 * @returns {Promise<boolean>} true when a pending root was cleared
 */
const clearOrphanedPendingRoot = async (storeId) => {
  try {
    // The transaction that publishes a root belongs to the DataLayer wallet, so
    // without its id a settled wallet is indistinguishable from one that was
    // never asked.
    const dlWalletId = await wallet.getDLWalletId();
    if (!dlWalletId) {
      logger.warn(
        `DataLayer wallet id is unavailable, so the pending root for store ` +
          `${storeId} cannot be shown to be orphaned. Leaving it in place.`,
      );
      return false;
    }

    // getTransactionHealth throws when the RPC reports failure, which keeps an
    // unanswerable question from being read as "nothing is unconfirmed".
    // A DataLayer update can also spend from the standard wallet to pay its fee,
    // so both wallets have to be settled.
    const walletIds = dlWalletId === '1' ? ['1'] : ['1', dlWalletId];
    for (const walletId of walletIds) {
      const { inMempool, pending } =
        await wallet.getTransactionHealth(walletId);

      // Only a transaction that can still confirm keeps the root alive. A
      // rejected one never will, and is itself a reason the root was stranded,
      // so it must not block recovery.
      if (inMempool.length + pending.length > 0) {
        return false;
      }
    }
  } catch (error) {
    logger.warn(
      `Could not determine wallet transaction state for store ${storeId}; ` +
        `leaving its pending root in place. ${error.message}`,
    );
    return false;
  }

  const cleared = await clearPendingRoots(storeId);
  if (cleared) {
    logger.warn(
      `Cleared the pending root for store ${storeId}: no transaction remained ` +
        `that could confirm it.`,
    );
  }
  return cleared;
};

const checkWalletBalanceForMirror = async (coinAmount, fee) => {
  try {
    const balanceXCH = await wallet.getWalletBalance();
    if (balanceXCH === false) {
      logger.warn(
        'Failed to retrieve wallet balance, proceeding with default fee',
      );
      return { sufficient: true, fee: fee, balanceXCH: 'unknown' };
    }

    // Convert XCH balance to mojos for comparison
    // Handle both string (simulator) and number (real wallet) formats
    const balanceXCHNum =
      typeof balanceXCH === 'string' ? parseFloat(balanceXCH) : balanceXCH;
    const balanceMojos = Math.floor(balanceXCHNum * 1000000000000);
    const totalRequired = coinAmount + fee;

    logger.info(`Wallet balance: ${balanceXCH} XCH (${balanceMojos} mojos)`);
    logger.info(
      `Required for mirror: ${coinAmount} mojos + ${fee} mojos = ${totalRequired} mojos`,
    );

    if (balanceMojos >= totalRequired) {
      logger.info(
        `Sufficient funds available for mirror creation with fee (balance: ${balanceXCH} XCH, ${balanceMojos} mojos, need: ${totalRequired} mojos)`,
      );
      return { sufficient: true, fee: fee, balanceXCH: balanceXCH };
    } else if (balanceMojos >= coinAmount) {
      logger.warn(
        `Insufficient funds for fee, proceeding with zero fee (balance: ${balanceXCH} XCH, ${balanceMojos} mojos, need: ${totalRequired} mojos)`,
      );
      return { sufficient: true, fee: 0, balanceXCH: balanceXCH };
    } else {
      // The wallet is the source of truth for in-flight spends: any
      // unconfirmed transaction (coin split, store creation, ...) temporarily
      // reduces the spendable balance and resolves itself on confirmation.
      const hasUnconfirmed = await wallet
        .hasAnyUnconfirmedTransactions()
        .catch((error) => {
          // Failing open means a shortfall is reported as genuinely
          // insufficient funds below, so leave a trace of the failed check.
          logger.warn(
            `Could not check for unconfirmed transactions while evaluating mirror funding: ${error.message}`,
          );
          return false;
        });
      if (hasUnconfirmed) {
        logger.warn(
          `Wallet balance temporarily reduced by unconfirmed transaction(s) ` +
            `(have ${balanceMojos} mojos, need ${coinAmount} mojos). ` +
            `Skipping mirror creation - will retry after they confirm.`,
        );
      } else {
        logger.error(
          `Insufficient funds: need ${coinAmount} mojos, have ${balanceMojos} mojos (balance: ${balanceXCH} XCH)`,
        );
      }
      return { sufficient: false, fee: 0, balanceXCH: balanceXCH };
    }
  } catch (error) {
    logger.error('Error checking wallet balance:', error);
    logger.warn('Proceeding with default fee due to balance check error');
    return { sufficient: true, fee: fee, balanceXCH: 'unknown' };
  }
};

// Tracks stores with in-flight mirror creation to prevent duplicates from
// concurrent callers. The mirrorCheckInProgress lock in mirror-check-v2.js
// can be defeated by module dual-instantiation under the extensionless loader,
// so this per-store guard at the persistance layer is the authoritative lock.
const pendingMirrorCreations = new Set();

const addMirror = async (storeId, url, forceAddMirror = false) => {
  logger.silly(
    `[MIRROR_DEBUG] Starting addMirror for storeId: ${storeId}, url: ${url}, force: ${forceAddMirror}`,
  );

  if (!storeId) {
    logger.warn(
      `[MIRROR_DEBUG] StoreId is null/undefined, skipping mirror creation`,
    );
    return false;
  }

  const lockKey = `${storeId}:${url}`;
  if (pendingMirrorCreations.has(lockKey)) {
    logger.info(
      `[MIRROR_DEBUG] Mirror creation already in-flight for ${storeId} at ${url}, skipping duplicate`,
    );
    return true;
  }

  pendingMirrorCreations.add(lockKey);
  try {
    return await addMirrorInner(storeId, url, forceAddMirror);
  } finally {
    pendingMirrorCreations.delete(lockKey);
  }
};

const addMirrorInner = async (storeId, url, forceAddMirror) => {
  await wallet.waitForAllTransactionsToConfirm();
  logger.silly('[MIRROR_DEBUG] Wallet transactions confirmed');

  const homeOrg = await getHomeOrg();
  logger.debug(
    `[MIRROR_DEBUG] Home org retrieved: ${homeOrg ? 'found' : 'not found'}`,
  );

  logger.info(
    `Checking mirrors for storeID is ${storeId} with mirror URL ${url}`,
  );

  if (!url) {
    logger.info(
      `No DATALAYER_FILE_SERVER_URL specified so skipping mirror for ${storeId}`,
    );
    logger.silly('[MIRROR_DEBUG] Exiting addMirror - no URL provided');
    return false;
  }

  if (!homeOrg && !forceAddMirror) {
    logger.info(`No home org detected so skipping mirror for ${storeId}`);
    logger.debug(
      '[MIRROR_DEBUG] Exiting addMirror - no home org and force=false',
    );
    return false;
  }

  logger.debug(
    `[MIRROR_DEBUG] Getting existing mirrors for storeId: ${storeId}`,
  );
  const mirrors = await getMirrors(storeId);
  logger.silly(`[MIRROR_DEBUG] Retrieved ${mirrors.length} existing mirrors`);

  // Dont add the mirror if it already exists.
  logger.debug(
    `[MIRROR_DEBUG] Checking for existing mirror with launcher_id: ${storeId} and url: ${url}`,
  );
  const mirror = mirrors.find(
    (mirror) =>
      mirror.launcher_id.replace('0x', '') === storeId &&
      mirror.urls.includes(url),
  );

  if (mirror) {
    logger.verbose(`Mirror already available for ${storeId} at ${url}`);
    logger.silly('[MIRROR_DEBUG] Mirror already exists, returning true');
    return true;
  }

  logger.debug(
    '[MIRROR_DEBUG] No existing mirror found, proceeding to create new mirror',
  );

  // In simulator mode, return success without making RPC call
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    logger.debug(
      `[MIRROR_DEBUG] Simulator mode - returning success for addMirror`,
    );
    return true;
  }

  try {
    const coinAmount = _.get(CONFIG, 'DEFAULT_COIN_AMOUNT', 300);
    const defaultFee = _.get(CONFIG, 'DEFAULT_FEE', 3000);

    // Check wallet balance before creating mirror
    const balanceCheck = await checkWalletBalanceForMirror(
      coinAmount,
      defaultFee,
    );

    if (!balanceCheck.sufficient) {
      logger.error(`Cannot create mirror for ${storeId}: insufficient funds`);
      return false;
    }

    const options = {
      id: storeId,
      urls: [url],
      amount: coinAmount,
      fee: balanceCheck.fee,
    };

    logger.silly(`[MIRROR_DEBUG] Mirror options: ${JSON.stringify(options)}`);
    logger.info(
      `Creating mirror with fee: ${balanceCheck.fee} mojos (balance: ${balanceCheck.balanceXCH} XCH)`,
    );

    const { cert, key, timeout } = getBaseOptions();
    logger.debug(
      `[MIRROR_DEBUG] Making RPC call to ${CONFIG.DATALAYER_URL}/add_mirror`,
    );

    const response = await superagent
      .post(`${CONFIG.DATALAYER_URL}/add_mirror`)
      .key(key)
      .cert(cert)
      .send(options)
      .timeout(timeout);

    const data = response.body;
    logger.silly(`[MIRROR_DEBUG] RPC response: ${JSON.stringify(data)}`);

    if (data.success) {
      logger.info(`Adding mirror ${storeId} at ${url}`);
      logger.silly('[MIRROR_DEBUG] Mirror added successfully');
      return true;
    }

    logger.error(`FAILED ADDING MIRROR FOR ${storeId}`);
    logger.debug(
      `[MIRROR_DEBUG] Mirror addition failed - response: ${JSON.stringify(data)}`,
    );
    return false;
  } catch (error) {
    logger.error('ADD_MIRROR', error);
    logger.silly(`[MIRROR_DEBUG] Mirror addition error: ${error.message}`);
    logger.debug('Mirror addition stack trace:', error.stack);
    return false;
  }
};

const removeMirror = async (storeId, coinId) => {
  const mirrors = await getMirrors(storeId);

  const mirrorExists = mirrors.find(
    (mirror) => mirror.coin_id === coinId && mirror.launcher_id === storeId,
  );

  if (!mirrorExists) {
    logger.error(
      `Mirror doesn't exist for: storeId: ${storeId}, coinId: ${coinId}`,
    );
    return false;
  }

  const url = `${CONFIG.DATALAYER_URL}/delete_mirror`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: coinId,
        fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
      });

    const data = response.body;

    if (data.success) {
      logger.info(`Removed mirror for ${storeId}`);
      return true;
    }

    logger.error(`Failed removing mirror for ${storeId}`);
    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const getRootDiff = async (storeId, root1, root2) => {
  const url = `${CONFIG.DATALAYER_URL}/get_kv_diff`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: storeId,
        hash_1: root1,
        hash_2: root2,
      });

    const data = response.body;

    if (data.success) {
      return _.get(data, 'diff', []);
    }

    throw new Error(
      data.error ||
        `DataLayer get_kv_diff failed for store ${storeId} between roots ${root1} and ${root2}`,
    );
  } catch (error) {
    logger.error(
      `DataLayer get_kv_diff failed for store ${storeId} between roots ${root1} and ${root2}: ${error.message}`,
    );
    throw error;
  }
};

const getRootHistory = async (storeId) => {
  const url = `${CONFIG.DATALAYER_URL}/get_root_history`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: storeId,
      });

    const data = response.body;

    if (data.success) {
      return _.get(data, 'root_history', []);
    }

    return [];
  } catch (error) {
    logger.error(error);
    return [];
  }
};

const unsubscribeFromDataLayerStore = async (storeId) => {
  const url = `${CONFIG.DATALAYER_URL}/unsubscribe`;
  const { cert, key, timeout } = getBaseOptions();

  logger.info(`RPC Call: ${url} ${storeId}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: storeId,
        fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
      });

    const data = response.body;

    if (data.success) {
      logger.info(`Successfully Unsubscribed from store: ${storeId}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Error Unsubscribing from store ${storeId}. Error: ${error}`);
    return false;
  }
};

const dataLayerAvailable = async () => {
  const url = `${CONFIG.DATALAYER_URL}/get_routes`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({});

    const data = response.body;

    // We just care that we got some response, not what the response is
    if (Object.keys(data).includes('success')) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const getStoreData = async (storeId, rootHash) => {
  if (storeId) {
    const payload = {
      id: storeId,
    };

    if (rootHash) {
      payload.root_hash = rootHash;
    }

    const url = `${CONFIG.DATALAYER_URL}/get_keys_values`;
    const { cert, key, timeout } = getBaseOptions();

    try {
      const response = await superagent
        .post(url)
        .key(key)
        .cert(cert)
        .timeout(timeout)
        .send(payload);

      const data = response.body;

      if (data.success) {
        if (_.isEmpty(data.keys_values)) {
          logger.warn(
            `datalayer get_keys_values returned no data for store ${storeId} at root hash: ${rootHash || 'latest'}`,
          );
        }

        logger.silly(
          `raw keys and values from RPC for store ${storeId}

          ${JSON.stringify(data.keys_values)}`,
        );
        return data;
      } else {
        throw new Error(JSON.stringify(data));
      }
    } catch (error) {
      logger.error(
        `failed to get keys and values from datalayer for store ${storeId} at root ${
          rootHash || 'latest'
        }. Error: ${error.message}`,
      );
      return false;
    }
  }

  logger.info(
    `Unable to find store data for ${storeId} at root ${rootHash || 'latest'}`,
  );
  return false;
};

const getRoot = async (storeId) => {
  // In simulator mode, use simulator instead of making RPC calls
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    const simulator = await import('./simulator.js');
    return await simulator.getRoot(storeId);
  }

  const url = `${CONFIG.DATALAYER_URL}/get_root`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId });

    logger.debug(
      `the current root data for store ${storeId} is ${JSON.stringify(response.body)}`,
    );

    const { success, error, traceback } = response.body;

    if (!success || error || traceback) {
      throw new Error(`${error}, ${traceback}`);
    }

    return response.body;
  } catch (error) {
    logger.error(
      `could not get root data for store ${storeId}. this could be due to the store being in the process of confirming. error: ${error.message}`,
    );
    return {};
  }
};

/**
 * Get the local root hash of a store. Use for owned or subscribed stores.
 * Chia get_root returns invalid hash (0x00...) for subscribed stores; get_local_root returns the actual root.
 * @param {string} storeId - Store ID
 * @returns {Promise<{ hash?: string, success?: boolean }>}
 */
const getLocalRoot = async (storeId) => {
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    const simulator = await import('./simulator.js');
    return await simulator.getRoot(storeId);
  }

  const url = `${CONFIG.DATALAYER_URL}/get_local_root`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId });

    const { success, error, traceback, hash } = response.body;
    if (!success || error || traceback) {
      throw new Error(`${error}, ${traceback}`);
    }
    return { hash, confirmed: true };
  } catch (error) {
    logger.debug(
      `could not get local root for store ${storeId}: ${error.message}`,
    );
    return {};
  }
};

const getRoots = async (storeIds) => {
  const url = `${CONFIG.DATALAYER_URL}/get_roots`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ ids: storeIds });

    const data = response.body;

    if (data.success) {
      return data;
    }

    return [];
  } catch (error) {
    logger.error(error);
    return [];
  }
};

// Grace period between pending-root sightings. A concurrent push that has staged a
// root but has not yet published it is invisible to the wallet check in
// clearOrphanedPendingRoot, so elapsed time is the only thing keeping its changelist
// from being discarded. Must stay well inside the maxAttempts budget below.
const PENDING_ROOT_GRACE_MS = 45000;

const pushChangeListToDataLayer = async (
  storeId,
  changelist,
  {
    skipTransactionWait = false,
    pendingRootGraceMs = PENDING_ROOT_GRACE_MS,
  } = {},
) => {
  let attempts = 0;
  let pendingRootSightings = 0;
  let pendingRootCleared = false;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      // skipTransactionWait: with coin splitting we maintain multiple coins so back-to-back
      // transactions work without waiting for the first to confirm. Callers that know they
      // have available coins (e.g. org creation after coin management) can skip this wait.
      if (!skipTransactionWait) {
        await wallet.waitForAllTransactionsToConfirm();
      }

      // Log the changelist being sent (with decoded keys/values for readability)
      logger.debug(
        `[DATALAYER_RPC] Sending changelist to storeId: ${storeId}`,
        {
          storeId,
          changelistSize: changelist.length,
          changelist: changelist.map((change) => {
            const decoded = {
              action: change.action,
              key: change.key ? decodeHex(change.key) : change.key,
            };
            if (change.value) {
              try {
                decoded.value = decodeHex(change.value);
                // Try to parse as JSON for better readability
                try {
                  decoded.valueParsed = JSON.parse(decoded.value);
                } catch {
                  // Not JSON, that's fine
                }
              } catch (e) {
                decoded.value = change.value; // Keep hex if decode fails
              }
            }
            return decoded;
          }),
        },
      );

      const url = `${CONFIG.DATALAYER_URL}/batch_update`;
      const { cert, key, timeout } = getBaseOptions();

      logger.silly(`[DATALAYER_RPC] Making RPC call to: ${url}`, {
        url,
        storeId,
        changelistLength: changelist.length,
        fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
      });

      const response = await superagent
        .post(url)
        .key(key)
        .cert(cert)
        .timeout(timeout)
        .send({
          changelist,
          id: storeId,
          fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
        });

      const data = response.body;
      logger.debug('DataLayer response:', data);

      if (data.success) {
        logger.info(
          `Success!, Changes were submitted to the datalayer for storeId: ${storeId}`,
        );
        return true;
      }

      // Chia returns this when this store (or wallet) already has a root pending confirmation.
      // Wait for confirmation then retry the push instead of failing to writeService.
      if (
        data.error &&
        data.error.includes(
          'Already have a pending root waiting for confirmation',
        )
      ) {
        attempts++;
        pendingRootSightings++;
        // Sightings are logged alongside the attempt because a successful clear
        // refunds an attempt, so the same attempt number can appear twice.
        logger.info(
          `Pending root for store ${storeId}; waiting for confirmation ` +
            `(sighting ${pendingRootSightings}, attempt ${attempts}/${maxAttempts})`,
        );
        await wallet.waitForAllTransactionsToConfirm();

        // A first sighting gets the benefit of the doubt, since a concurrent
        // push to this store may still be between staging its root and creating
        // the transaction that publishes it. Count sightings of this error
        // rather than reading `attempts`, which a successful clear refunds and
        // which therefore says nothing about how often this store reported a
        // pending root. Clearing again after that would only repeat the same
        // gamble, so a push discards at most one root.
        if (
          pendingRootSightings > 1 &&
          !pendingRootCleared &&
          (await clearOrphanedPendingRoot(storeId))
        ) {
          pendingRootCleared = true;
          // The clear is what makes the next push viable, so the sighting that
          // triggered it must not be the attempt that exhausts the budget;
          // otherwise a clear on the last attempt reports failure without ever
          // retrying the push it just unblocked. Bounded by pendingRootCleared,
          // so this refunds at most one attempt per push.
          attempts--;
          continue;
        }

        // Only worth waiting if another attempt remains; on the last sighting the
        // loop exits immediately and the delay would just postpone the failure.
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pendingRootGraceMs));
        }
        continue;
      }

      // A key collision is raised inside DataLayer's writer transaction, and
      // the pending-root check runs before it, so this error can neither have
      // staged a root of ours nor have been caused by one. Any root present now
      // belongs to a concurrent push and would lose its changelist if cleared.
      // Note the batch is rejected as a unit, so this error does not establish
      // that the rest of the changelist landed.
      if (data.error && data.error.includes('Key already present')) {
        logger.info(
          `Key already present in datalayer for storeId: ${storeId}. ` +
            `Treating as success.`,
        );
        return true;
      }

      // Handle "no change to tree data" error - this means the changelist wouldn't
      // change the datalayer state (data already exists or is already in desired state)
      // Treat this as success since the desired end state is already achieved
      if (
        data.error &&
        data.error.includes('Changelist resulted in no change to tree data')
      ) {
        logger.info(
          `Changelist resulted in no change to tree data for storeId: ${storeId}. ` +
            `This indicates the data is already in the desired state. Treating as success.`,
        );
        return true;
      }

      // Handle "Latest root is already confirmed" error - this means the store's
      // current root is already confirmed on-chain and the changelist would not
      // produce a new publishable root. This typically happens after a restart
      // where changes were pushed successfully but CADT didn't record the success.
      // Treat as success since the desired state is already achieved.
      if (
        data.error &&
        data.error.includes('Latest root is already confirmed')
      ) {
        logger.info(
          `Latest root is already confirmed for storeId: ${storeId}. ` +
            `This indicates the data has already been pushed and confirmed on-chain. Treating as success.`,
        );
        return true;
      }

      // Handle "unknown key" errors - this is an ERROR, not acceptable
      // All data in CADT must come from datalayer, so DELETE operations should always find the keys
      // If keys are not found, it indicates a key format mismatch that needs to be fixed
      if (data.error && data.error.includes('unknown key')) {
        const isDeleteOnlyChangelist = changelist.every(
          (change) => change.action === 'delete',
        );

        // Log detailed information about the keys we're trying to delete
        const deleteKeys = changelist.map((change) => ({
          hex: change.key,
          decoded: decodeHex(change.key),
        }));

        logger.error(
          `[DELETE KEY MISMATCH ERROR] Unknown key error for ${isDeleteOnlyChangelist ? 'DELETE-only' : ''} changelist`,
          {
            storeId,
            deleteKeysCount: deleteKeys.length,
            deleteKeys,
            error: data.error,
            traceback: data.traceback,
          },
        );

        if (isDeleteOnlyChangelist) {
          logger.error(
            `CRITICAL: DELETE operation failed - keys not found in datalayer for storeId: ${storeId}. ` +
              `This indicates a key format mismatch. All data in CADT must come from datalayer, ` +
              `so DELETE operations should always find the keys. ` +
              `Check logs for [DELETE KEY MISMATCH ERROR] and [DELETE KEY DEBUG] for details.`,
          );
        }

        // Do NOT treat as success - this is an error that needs to be fixed
        return false;
      }

      if (data.error && data.error.includes('is not owned by DL Wallet')) {
        logger.error(
          `Store ${storeId} is not owned by this wallet's DL Wallet. ` +
            `This is a permanent error — push will never succeed until store ownership is restored. ` +
            `This typically happens when the node was redeployed with a new wallet.`,
        );
        const err = new Error(
          `Store ${storeId} is not owned by this wallet's DL Wallet`,
        );
        err.permanent = true;
        throw err;
      }

      logger.error(
        `There was an error pushing your changes to the datalayer, ${JSON.stringify(
          data,
        )}`,
      );
      return false;
    } catch (error) {
      if (error.permanent) {
        throw error;
      }
      logger.error(error.message);
      logger.info('There was an error pushing your changes to the datalayer');
      return false;
    }
  }

  logger.error(
    'Maximum attempts reached. Unable to push changes to the datalayer.',
  );
  return false;
};

const createDataLayerStore = async () => {
  const url = `${CONFIG.DATALAYER_URL}/create_data_store`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
        verbose: true,
      });

    const data = response.body;

    if (data.success) {
      // With verbose=true, the RPC returns { id, txs } where txs is an array
      // of TransactionRecord objects, each with a `name` field (tx_id/bundle_id).
      // Older nodes without verbose support will only return { id }.
      const txIds = Array.isArray(data.txs)
        ? data.txs.map((tx) => tx.name).filter(Boolean)
        : [];

      return { storeId: data.id, txIds };
    }

    throw new Error(data.error);
  } catch (error) {
    logger.error(error);
    throw new Error(error.message);
  }
};

const subscribeToStoreOnDataLayer = async (storeId) => {
  if (!storeId) {
    logger.info(`No storeId found to subscribe to: ${storeId}`);
    return false;
  }

  const { storeIds: subscriptions, success } = await getSubscriptions();
  if (!success) {
    return false;
  }

  if (subscriptions.includes(storeId)) {
    logger.debug(`Already subscribed to: ${storeId}`);
    return true;
  }

  const url = `${CONFIG.DATALAYER_URL}/subscribe`;
  const { cert, key, timeout } = getBaseOptions();

  logger.info(`Subscribing to: ${storeId}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: storeId,
        fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
      });

    const data = response.body;

    if (Object.keys(data).includes('success') && data.success) {
      logger.info(`Successfully Subscribed: ${storeId}`);

      const shouldMirror = CONFIG.AUTO_MIRROR_EXTERNAL_STORES ?? true;
      if (shouldMirror) {
        const mirrorUrl = await getMirrorUrl();
        if (mirrorUrl) {
          await addMirror(storeId, mirrorUrl, true);
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    logger.info(`Error Subscribing: ${error}`);
    return false;
  }
};

const getSubscriptions = async () => {
  try {
    if (CONFIG.USE_SIMULATOR) {
      return { success: true, storeIds: [] };
    }

    const url = `${CONFIG.DATALAYER_URL}/subscriptions`;
    const { cert, key, timeout } = getBaseOptions();

    logger.debug(`invoking ${url} to retrieve subscriptions`);
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({});

    const data = response.body;
    logger.debug(`data returned from ${url}: ${JSON.stringify(data)}`);

    if (data.success) {
      return { success: true, storeIds: data.store_ids };
    }

    logger.error(`Failed to retrieve subscriptions from datalayer`);
    return { success: false, storeIds: [] };
  } catch (error) {
    logger.error(error);
    return { success: false, storeIds: [] };
  }
};

const getOwnedStores = async () => {
  try {
    if (CONFIG.USE_SIMULATOR) {
      const simulator = await import('./simulator.js');
      return simulator.getOwnedStores();
    }

    const url = `${CONFIG.DATALAYER_URL}/get_owned_stores`;
    const { cert, key, timeout } = getBaseOptions();

    logger.debug(`invoking ${url} to retrieve owned stores`);
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({});

    const data = response.body;
    logger.debug(`data returned from ${url}: ${data.store_ids}`);

    if (data.success) {
      return { success: true, storeIds: data.store_ids };
    }

    logger.error(`Failed to retrieve owned stores from datalayer`);
    return { success: false, storeIds: [] };
  } catch (error) {
    logger.error(error);
    return { success: false, storeIds: [] };
  }
};

const makeOffer = async (offer) => {
  // In simulator mode, return mock response
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    return {
      success: true,
      offer: {
        trade_id: `simulator-trade-${Date.now()}`,
        ...offer,
      },
    };
  }

  const url = `${CONFIG.DATALAYER_URL}/make_offer`;
  const { cert, key, timeout } = getBaseOptions();
  offer.fee = CONFIG.DEFAULT_FEE;

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send(offer);

    const data = response.body;

    if (data.success) {
      return data;
    }

    throw new Error(data.error);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const takeOffer = async (offer) => {
  // In simulator mode, return mock response
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    return {
      success: true,
      trade_id: `simulator-trade-${Date.now()}`,
    };
  }

  const url = `${CONFIG.DATALAYER_URL}/take_offer`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send(offer);

    const data = response.body;

    if (data.success) {
      return data;
    }

    throw new Error(data.error);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const verifyOffer = async (offer) => {
  logger.debug('Verifying offer:', offer);

  // In simulator mode, return success without making RPC call
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    return true;
  }

  const url = `${CONFIG.DATALAYER_URL}/verify_offer`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send(offer);

    const data = response.body;

    if (data.success) {
      return true;
    }

    throw new Error(data.error);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const cancelOffer = async (tradeId) => {
  // In simulator mode, return success without making RPC call
  if (CONFIG.USE_SIMULATOR || CONFIG.USE_DEVELOPMENT_MODE) {
    return { success: true };
  }

  const url = `${CONFIG.DATALAYER_URL}/cancel_offer`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        trade_id: tradeId,
        secure: true,
        fee: _.get(CONFIG, 'DEFAULT_FEE', 3000),
      });

    const data = response.body;

    if (data.success) {
      return data;
    }

    throw new Error(data.error);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

/**
 * @typedef {Object} SyncStatus
 * @property {number} generation - The current generation of the Merkle tree.
 * @property {string} root_hash - The root hash of the Merkle tree.
 * @property {number} target_generation - The target generation of the Merkle tree.
 * @property {string} target_root_hash - The target root hash of the Merkle tree.
 */

/**
 * Fetches the DataLayer store synchronization status for a given store.
 * This checks how synced a specific DataLayer store is (generation, target_generation, etc.).
 * NOT to be confused with wallet blockchain sync status (use getWalletBlockchainSyncStatus for that).
 *
 * @param {string} storeId - The identifier of the DataLayer store.
 * @returns {Promise<{sync_status: SyncStatus} | boolean>} - A promise that resolves to an object containing the sync status or `false` if the status cannot be retrieved.
 */
const getDataLayerStoreSyncStatus = async (storeId) => {
  if (CONFIG.USE_SIMULATOR) {
    return {
      sync_status: {
        generation: 10000,
        target_generation: 10000,
        target_root_hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
      },
    };
  }

  const url = `${CONFIG.DATALAYER_URL}/get_sync_status`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: storeId,
      });

    const data = response.body;

    // We just care that we got some response, not what the response is
    if (Object.keys(data).includes('success')) {
      return data;
    } else {
      logger.warn(
        `datalayer '/get_sync_status' RPC failed to get sync status for ${storeId}`,
      );
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

export {
  addMirror,
  makeOffer,
  getMirrors,
  removeMirror,
  getRootDiff,
  getRootHistory,
  subscribeToStoreOnDataLayer,
  unsubscribeFromDataLayerStore,
  dataLayerAvailable,
  getStoreData,
  getRoot,
  getLocalRoot,
  getRoots,
  pushChangeListToDataLayer,
  createDataLayerStore,
  getSubscriptions,
  getOwnedStores,
  cancelOffer,
  verifyOffer,
  takeOffer,
  clearPendingRoots,
  getValue,
  getDataLayerStoreSyncStatus,
  checkWalletBalanceForMirror,
};
