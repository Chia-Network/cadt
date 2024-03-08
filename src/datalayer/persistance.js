import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { getConfig } from '../utils/config-loader';
import wallet from './wallet';
import { Organization } from '../models';
import { logger } from '../config/logger.cjs';
import { getChiaRoot } from '../utils/chia-root.js';
import { getMirrorUrl } from '../utils/datalayer-utils';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const CONFIG = getConfig().APP;

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
  const url = `${CONFIG.DATALAYER_URL}/get_mirrors`;
  const { cert, key, timeout } = getBaseOptions();

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

  try {
    const options = {
      id: storeId,
      urls: [url],
      amount: _.get(CONFIG, 'DEFAULT_COIN_AMOUNT', 300000000),
      fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
    };

    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${CONFIG.DATALAYER_URL}/add_mirror`)
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
        fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
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

    return [];
  } catch (error) {
    logger.error(error);
    return [];
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
        fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
      });

    const data = response.body;

    if (Object.keys(data).includes('success') && data.success) {
      logger.info(`Successfully UnSubscribed: ${storeId}`);
      return data;
    }

    return false;
  } catch (error) {
    logger.info(`Error UnSubscribing: ${error}`);
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
        if (!_.isEmpty(data.keys_values)) {
          logger.info(`Downloaded Data, root hash: ${rootHash || 'latest'}`);
        }
        return data;
      }

      logger.error(
        `FAILED GETTING STORE DATA FOR ${storeId}: ${JSON.stringify(data)}`,
      );
    } catch (error) {
      logger.info(
        `Unable to find store data for ${storeId} at root ${
          rootHash || 'latest'
        }`,
      );
      logger.error(error.message);
      return false;
    }
  }

  logger.info(
    `Unable to find store data for ${storeId} at root ${rootHash || 'latest'}`,
  );
  return false;
};

const getRoot = async (storeId, ignoreEmptyStore = false) => {
  const url = `${CONFIG.DATALAYER_URL}/get_root`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId });

    const { confirmed, hash } = response.body;

    if (confirmed && (!ignoreEmptyStore || !hash.includes('0x00000000000'))) {
      return response.body;
    }

    return false;
  } catch (error) {
    logger.error(error.message);
    return false;
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

const pushChangeListToDataLayer = async (storeId, changelist) => {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      await wallet.waitForAllTransactionsToConfirm();

      const url = `${CONFIG.DATALAYER_URL}/batch_update`;
      const { cert, key, timeout } = getBaseOptions();

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
  const url = `${CONFIG.DATALAYER_URL}/create_data_store`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
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

  const homeOrg = await Organization.getHomeOrg();

  if (homeOrg && [(homeOrg.orgUid, homeOrg.registryId)].includes(storeId)) {
    logger.info(`Cant subscribe to self: ${storeId}`);
    return { success: true };
  }

  const subscriptions = await getSubscriptions();

  if (subscriptions.includes(storeId)) {
    logger.info(`Already subscribed to: ${storeId}`);
    return { success: true };
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
        fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
      });

    const data = response.body;

    if (Object.keys(data).includes('success') && data.success) {
      logger.info(`Successfully Subscribed: ${storeId}`);

      const mirrorUrl = await getMirrorUrl();

      await addMirror(storeId, mirrorUrl, true);

      return data;
    }

    return false;
  } catch (error) {
    logger.info(`Error Subscribing: ${error}`);
    return false;
  }
};

const getSubscriptions = async () => {
  if (CONFIG.USE_SIMULATOR) {
    return [];
  }

  const url = `${CONFIG.DATALAYER_URL}/subscriptions`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({});

    const data = response.body;

    if (data.success) {
      // console.log('Your Subscriptions:', data.store_ids);
      return data.store_ids;
    }

    logger.error(`FAILED GETTING SUBSCRIPTIONS ON DATALAYER`);
    return [];
  } catch (error) {
    logger.error(error);
    return [];
  }
};

const makeOffer = async (offer) => {
  const url = `${CONFIG.DATALAYER_URL}/make_offer`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({
        ...offer,
        fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
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
  console.log(offer);
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
        fee: _.get(CONFIG, 'DEFAULT_FEE', 300000000),
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
  cancelOffer,
  verifyOffer,
  takeOffer,
  clearPendingRoots,
  getValue,
};
