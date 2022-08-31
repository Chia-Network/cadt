import _ from 'lodash';

import fs from 'fs';
import path from 'path';
import request from 'request-promise';
import os from 'os';
import { getConfig } from '../utils/config-loader';
import { decodeHex } from '../utils/datalayer-utils';
import fullNode from './fullNode';
import { publicIpv4 } from '../utils/ip-tools';

import { logger } from '../config/logger.cjs';

logger.info('climate-warehouse:datalayer:persistance');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const CONFIG = getConfig().APP;

const getBaseOptions = () => {
  const homeDir = os.homedir();
  const certFile = path.resolve(
    `${homeDir}/.chia/mainnet/config/ssl/data_layer/private_data_layer.crt`,
  );
  const keyFile = path.resolve(
    `${homeDir}/.chia/mainnet/config/ssl/data_layer/private_data_layer.key`,
  );

  const baseOptions = {
    method: 'POST',
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };

  return baseOptions;
};

const createDataLayerStore = async () => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/create_data_store`,
    body: JSON.stringify({}),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data.id;
  }

  throw new Error(data.error);
};

const pushChangeListToDataLayer = async (storeId, changelist) => {
  try {
    const options = {
      url: `${CONFIG.DATALAYER_URL}/batch_update`,
      body: JSON.stringify({
        changelist,
        id: storeId,
      }),
    };

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      logger.info(
        `Success!, Changes were submitted to the datalayer for storeId: ${storeId}`,
      );
      return true;
    }

    if (data.error.includes('Key already present')) {
      logger.info(
        `The datalayer key was already present, its possible your data was pushed to the datalayer but never broadcasted to the blockchain. This can create a mismatched state in your node.`,
      );
      return true;
    }

    logger.error(
      `There was an error pushing your changes to the datalayer, ${JSON.stringify(
        data,
      )}`,
    );
    return false;
  } catch (error) {
    logger.info('There was an error pushing your changes to the datalayer');
  }
};

const getRoots = async (storeIds) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/get_roots`,
    body: JSON.stringify({
      ids: storeIds,
    }),
  };

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      return data;
    }

    return [];
  } catch (error) {
    return [];
  }
};

const getRoot = async (storeId, ignoreEmptyStore = false) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/get_root`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  try {
    const data = JSON.parse(response);

    if (
      (data.confirmed && !ignoreEmptyStore) ||
      (data.confirmed &&
        ignoreEmptyStore &&
        !data.hash.includes('0x00000000000'))
    ) {
      return data;
    }

    return false;
  } catch (error) {
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

    const options = {
      url: `${CONFIG.DATALAYER_URL}/get_keys_values`,
      body: JSON.stringify(payload),
    };

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      if (!_.isEmpty(data.keys_values)) {
        logger.info(
          `Downloaded Data: ${JSON.stringify(
            data.keys_values.map((record) => {
              return {
                key: decodeHex(record.key),
              };
            }),
            null,
            2,
          )}`,
        );
      }
      return data;
    }
  }

  return false;
};

const dataLayerAvailable = async () => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/get_routes`,
    body: JSON.stringify({}),
  };

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    // We just care that we got some response, not what the response is
    if (Object.keys(data).includes('success')) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
};

const unsubscribeFromDataLayerStore = async (storeId) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/unsubscribe`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  logger.info(`RPC Call: ${CONFIG.DATALAYER_URL}/unsubscribe ${storeId}`);

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

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

const subscribeToStoreOnDataLayer = async (storeId) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/subscribe`,
    body: JSON.stringify({
      id: storeId,
      urls: [],
    }),
  };

  logger.info(`RPC Call: ${CONFIG.DATALAYER_URL}/subscribe ${storeId}`);

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (Object.keys(data).includes('success') && data.success) {
      logger.info(`Successfully Subscribed: ${storeId}`);

      const chiaConfig = fullNode.getChiaConfig();
      await addMirror(
        storeId,
        `http://${await publicIpv4()}:${chiaConfig.data_layer.host_port}`,
      );

      return data;
    }

    return false;
  } catch (error) {
    logger.info(`Error Subscribing: ${error}`);
    return false;
  }
};

const getRootHistory = async (storeId) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/get_root_history`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      return _.get(data, 'root_history', []);
    }

    return [];
  } catch (error) {
    return [];
  }
};

const getRootDiff = async (storeId, root1, root2) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/get_kv_diff`,
    body: JSON.stringify({
      id: storeId,
      hash_1: root1,
      hash_2: root2,
    }),
  };

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      return _.get(data, 'diff', []);
    }

    return [];
  } catch (error) {
    return [];
  }
};

const addMirror = async (storeId, url) => {
  const mirrors = await getMirrors(storeId);

  // Dont add the mirror if it already exists.
  const mirror = mirrors.find(
    (mirror) => mirror.launcher_id === storeId && mirror.urls.includes(url),
  );

  if (mirror) {
    return true;
  }

  try {
    const options = {
      url: `${CONFIG.DATALAYER_URL}/add_mirror`,
      body: JSON.stringify({
        id: storeId,
        urls: [url],
        amount: _.get(CONFIG, 'MIRROR_FEE', 1000000000 /* 1 billion mojos */),
      }),
    };

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      logger.info(`Adding mirror ${storeId} at ${url}`);
      return true;
    }

    logger.error(`FAILED ADDING MIRROR FOR ${storeId}`);
    return false;
  } catch (error) {
    return false;
  }
};

const removeMirror = async (storeId, coinId) => {
  const mirrors = await getMirrors(storeId);

  // Dont add the mirror if it already exists.
  const mirrorExists = mirrors.find(
    (mirror) => mirror.coin_id === coinId && mirror.launcher_id === storeId,
  );

  if (mirrorExists) {
    logger.error(
      `Mirror doesnt exist for: storeId: ${storeId}, coinId: ${coinId}`,
    );
    return false;
  }

  try {
    const options = {
      url: `${CONFIG.DATALAYER_URL}/delete_mirror`,
      body: JSON.stringify({
        id: coinId,
      }),
    };

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      logger.info(`Removed mirror for ${storeId}`);
      return true;
    }

    logger.error(`Failed removing mirror for ${storeId}`);
    return false;
  } catch (error) {
    return false;
  }
};

const getMirrors = async (storeId) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/get_mirrors `,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      return data.mirrors;
    }

    logger.error(`FAILED GETTING MIRRORS FOR ${storeId}`);
    return [];
  } catch (error) {
    return [];
  }
};

const makeOffer = async (offer) => {
  const options = {
    url: `${CONFIG.DATALAYER_URL}/make_offer `,
    body: JSON.stringify(offer),
  };

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      return data;
    }

    throw new Error(data.error);
  } catch (error) {
    console.log(error);
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
};
