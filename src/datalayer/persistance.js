import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { CONFIG } from '../user-config';
import wallet from './wallet';
import { Organization } from '../models';
import { logger } from '../logger.js';
import { getChiaRoot } from 'chia-root-resolver';
import { getMirrorUrl } from '../utils/datalayer-utils';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const getBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certificateFolderPath =
    CONFIG().CHIA.CERTIFICATE_FOLDER_PATH || `${chiaRoot}/config/ssl`;

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
    timeout: 300000,
  };
  return baseOptions;
};

const getMirrors = async (storeId) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_mirrors`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId });

    const data = response.body;

    if (data.success) {
      return data.mirrors;
    }

    logger.error(`FAILED GETTING MIRRORS FOR ${storeId}`);
    return [];
  } catch (error) {
    logger.error(error);
    return [];
  }
};

const getValue = async (storeId, storeKey) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_value`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId, key: storeKey });

    const data = response.body;

    logger.debug(JSON.stringify({ id: storeId, key: storeKey }));
    logger.debug(JSON.stringify(data));

    if (data.success) {
      return data.value;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const addMirror = async (storeId, url, forceAddMirror = false) => {
  await wallet.waitForAllTransactionsToConfirm();
  const homeOrg = await Organization.getHomeOrg();
  logger.info(
    `Checking mirrors for storeID is ${storeId} with mirror URL ${url}`,
  );

  if (!url) {
    logger.info(
      `No DATALAYER_FILE_SERVER_URL specified so skipping mirror for ${storeId}`,
    );
    return false;
  }

  if (!homeOrg && !forceAddMirror) {
    logger.info(`No home org detected so skipping mirror for ${storeId}`);
    return false;
  }

  const mirrors = await getMirrors(storeId);

  // Dont add the mirror if it already exists.
  const mirror = mirrors.find(
    (mirror) => mirror.launcher_id === storeId && mirror.urls.includes(url),
  );

  if (mirror) {
    logger.info(`Mirror already available for ${storeId} at ${url}`);
    return true;
  }

  logger.trace(
    `RPC Call: ${CONFIG().CHIA.DATALAYER_HOST}/add_mirror ${storeId}`,
  );

  try {
    const options = {
      id: storeId,
      urls: [url],
      amount: CONFIG().CHIA?.DEFAULT_COIN_AMOUNT || 300000000,
      fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
    };

    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${CONFIG().CHIA.DATALAYER_HOST}/add_mirror`)
      .key(key)
      .cert(cert)
      .send(options)
      .timeout(timeout);

    const data = response.body;

    if (data.success) {
      logger.info(`Adding mirror ${storeId} at ${url}`);
      return true;
    }

    logger.error(`FAILED ADDING MIRROR FOR ${storeId}`);
    return false;
  } catch (error) {
    logger.error('ADD_MIRROR', error);
    console.trace(error);
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

  const url = `${CONFIG().CHIA.DATALAYER_HOST}/delete_mirror`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: coinId,
        fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
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
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_kv_diff`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

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

    return [];
  } catch (error) {
    logger.error(error);
    return [];
  }
};

const getRootHistory = async (storeId) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_root_history`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

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
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/unsubscribe`;
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
        fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
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
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_routes`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

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

    const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_keys_values`;
    const { cert, key, timeout } = getBaseOptions();

    logger.trace(`RPC Call: ${url} ${storeId}`);

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

        logger.trace(
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

/**
 * Fetches the root data for a specific store.
 *
 * @param {string} storeId - The ID of the store to fetch data for.
 * @returns {Object} - Returns the data object. empty if the fetch operation fails.
 */
const getRoot = async (storeId) => {
  const { CHIA } = CONFIG();
  const url = `${CHIA.DATALAYER_HOST}/get_root`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

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

const getRoots = async (storeIds) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_roots`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

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

const clearPendingRoots = async (storeId) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/clear_pending_roots`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url} ${storeId}`);

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

const pushChangeListToDataLayer = async (storeId, changelist) => {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      await wallet.waitForAllTransactionsToConfirm();

      const url = `${CONFIG().CHIA.DATALAYER_HOST}/batch_update`;
      const { cert, key, timeout } = getBaseOptions();

      logger.trace(`RPC Call: ${url} ${storeId}`);

      const response = await superagent
        .post(url)
        .key(key)
        .cert(cert)
        .timeout(timeout)
        .send({
          changelist,
          id: storeId,
          fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
        });

      const data = response.body;
      console.log(data);

      if (data.success) {
        logger.info(
          `Success!, Changes were submitted to the datalayer for storeId: ${storeId}`,
        );
        return true;
      }

      if (data.error.includes('Key already present')) {
        logger.info('Pending root detected, waiting 5 seconds and retrying');
        const rootsCleared = await clearPendingRoots(storeId);

        if (rootsCleared) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue; // Retry
        }
      }

      logger.error(
        `There was an error pushing your changes to the datalayer, ${JSON.stringify(
          data,
        )}`,
      );
      return false;
    } catch (error) {
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
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/create_data_store`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
      });

    const data = response.body;

    if (data.success) {
      return data.id;
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
    logger.info(`Already subscribed to: ${storeId}`);
    return true;
  }

  const url = `${CONFIG().CHIA.DATALAYER_HOST}/subscribe`;
  const { cert, key, timeout } = getBaseOptions();

  logger.info(`Subscribing to: ${storeId}`);
  logger.trace(`RPC Call: ${url} ${storeId}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        id: storeId,
        fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
      });

    const data = response.body;

    if (Object.keys(data).includes('success') && data.success) {
      logger.info(`Successfully Subscribed: ${storeId}`);

      const mirrorUrl = await getMirrorUrl();

      await addMirror(storeId, mirrorUrl, true);

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
    if (CONFIG().CADT.USE_SIMULATOR) {
      return { success: true, storeIds: [] };
    }

    const url = `${CONFIG().CHIA.DATALAYER_HOST}/subscriptions`;
    const { cert, key, timeout } = getBaseOptions();

    logger.trace(`RPC Call: ${url}`);

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
    if (CONFIG().CADT.USE_SIMULATOR) {
      return { success: true, storeIds: [] };
    }

    const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_owned_stores`;
    const { cert, key, timeout } = getBaseOptions();

    logger.trace(`RPC Call: ${url}`);

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
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/make_offer`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        ...offer,
        fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
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

const takeOffer = async (offer) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/take_offer`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

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
  console.log(offer);
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/verify_offer`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

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
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/cancel_offer`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        trade_id: tradeId,
        secure: true,
        fee: CONFIG().CHIA?.DEFAULT_FEE || 300000000,
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
 * Fetches the synchronization status for a given store.
 *
 * @param {string} storeId - The identifier of the store.
 * @returns {Promise<{sync_status: SyncStatus} | boolean>} - A promise that resolves to an object containing the sync status or `false` if the status cannot be retrieved.
 */
const getSyncStatus = async (storeId) => {
  const url = `${CONFIG().CHIA.DATALAYER_HOST}/get_sync_status`;
  const { cert, key, timeout } = getBaseOptions();

  logger.trace(`RPC Call: ${url}`);

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

    logger.trace(
      `the /get_sync_status RPC response for store ${storeId} is ${JSON.stringify(data)}`,
    );

    // We just care that we got some response, not what the response is
    if (Object.keys(data).includes('success')) {
      return data;
    }

    return false;
  } catch (error) {
    logger.error(
      `failed to get sync status for store ${storeId}. Error: ${JSON.stringify(error.message)}`,
    );
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
  getSyncStatus,
};
