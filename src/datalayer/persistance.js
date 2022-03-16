import _ from 'lodash';

import fs from 'fs';
import path from 'path';
import request from 'request-promise';
import axios from 'axios';
import https from 'https';
import os from 'os';

import Debug from 'debug';

Debug.enable('climate-warehouse:datalayer:persistance');

const log = Debug('climate-warehouse:datalayer:persistance');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const rpcUrl = process.env.DATALAYER_URL;

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

export const createDataLayerStore = async () => {
  const options = {
    url: `${rpcUrl}/create_data_store`,
    body: JSON.stringify({}),
  };

  const baseOptions = getBaseOptions();

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    cert: baseOptions.cert,
    key: baseOptions.key,
  });

  const { data } = await axios.post(options.url, {}, { httpsAgent });

  if (data.success) {
    return data.id;
  }

  log(data);

  throw new Error(data.error);
};

export const pushChangeListToDataLayer = async (storeId, changelist) => {
  try {
    const options = {
      url: `${rpcUrl}/batch_update`,
      body: JSON.stringify({
        changelist,
        id: storeId,
      }),
    };

    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      { changelist, id: storeId },
      {
        httpsAgent,
      },
    );

    log(options, data);

    if (data.success) {
      log('Success!');
      return true;
    }

    if (data.error.includes('Key already present')) {
      log('Success, I guess...');
      return true;
    }

    log(data);

    return false;
  } catch (error) {
    log('There was an error pushing your changes to the datalayer');
  }
};

export const getRoots = async (storeIds) => {
  const options = {
    url: `${rpcUrl}/get_roots`,
    body: JSON.stringify({
      ids: storeIds,
    }),
  };

  try {
    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      {
        ids: storeIds,
      },
      {
        httpsAgent,
      },
    );

    if (data.success) {
      return data;
    }

    return [];
  } catch (error) {
    return [];
  }
};

export const getRoot = async (storeId, ignoreEmptyStore = false) => {
  const options = {
    url: `${rpcUrl}/get_root`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  try {
    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      {
        id: storeId,
      },
      {
        httpsAgent,
      },
    );

    log(`Root for ${storeId}`, data);
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

export const getStoreData = async (storeId, rootHash) => {
  if (storeId) {
    const payload = {
      id: storeId,
    };

    if (rootHash) {
      payload.root_hash = rootHash;
    }

    const options = {
      url: `${rpcUrl}/get_keys_values`,
      body: JSON.stringify(payload),
    };

    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(options.url, payload, {
      httpsAgent,
    });

    if (data.success) {
      if (!_.isEmpty(data.keys_values)) {
        log('Downloaded Data', data);
      }
      return data;
    }

    log(data);
  }

  return false;
};

export const dataLayerAvailable = async () => {
  const options = {
    url: `${rpcUrl}/get_value`,
    body: JSON.stringify({}),
  };

  try {
    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      {},
      {
        httpsAgent,
      },
    );

    // We just care that we got some response, not what the response is
    if (Object.keys(data).includes('success')) {
      return true;
    }

    log(data);
    return false;
  } catch (error) {
    log(error);

    return false;
  }
};

export const subscribeToStoreOnDataLayer = async (storeId, ip, port) => {
  const options = {
    url: `${rpcUrl}/subscribe`,
    body: JSON.stringify({
      id: storeId,
      ip,
      port,
    }),
  };

  log('RPC Call: ', `${rpcUrl}/subscribe`, storeId, ip, port);

  try {
    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      {
        id: storeId,
        ip,
        port,
      },
      {
        httpsAgent,
      },
    );

    if (Object.keys(data).includes('success') && data.success) {
      log('Successfully Subscribed: ', storeId, ip, port);
      return data;
    }

    return false;
  } catch (error) {
    log('Error Subscribing: ', error);
    return false;
  }
};

export const getRootHistory = async (storeId) => {
  const options = {
    url: `${rpcUrl}/get_root_history`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  try {
    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      {
        id: storeId,
      },
      {
        httpsAgent,
      },
    );

    if (data.success) {
      return _.get(data, 'root_history', []);
    }

    return [];
  } catch (error) {
    return [];
  }
};

export const getRootDiff = async (storeId, root1, root2) => {
  const options = {
    url: `${rpcUrl}/get_kv_diff`,
    body: JSON.stringify({
      id: storeId,
      hash_1: root1,
      hash_2: root2,
    }),
  };

  try {
    const baseOptions = getBaseOptions();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: baseOptions.cert,
      key: baseOptions.key,
    });

    const { data } = await axios.post(
      options.url,
      {
        id: storeId,
        hash_1: root1,
        hash_2: root2,
      },
      {
        httpsAgent,
      },
    );

    if (data.success) {
      return _.get(data, 'diff', []);
    }

    return [];
  } catch (error) {
    return [];
  }
};
