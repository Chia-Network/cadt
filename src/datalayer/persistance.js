import _ from 'lodash';

import fs from 'fs';
import path from 'path';
import request from 'request-promise';
import os from 'os';

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

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data.id;
  }

  console.log(data);

  throw new Error(data.error);
};

export const pushChangeListToDataLayer = async (storeId, changelist) => {
  const options = {
    url: `${rpcUrl}/batch_update`,
    body: JSON.stringify({
      changelist,
      id: storeId,
    }),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  console.log(options, data);

  if (data.success) {
    console.log('Success!');
    return true;
  }

  if (data.error.includes('Key already present')) {
    console.log('Success, I guess...');
    return true;
  }

  console.log(data);

  return false;
};

export const getRoots = async (storeIds) => {
  const options = {
    url: `${rpcUrl}/get_roots`,
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

export const getRoot = async (storeId, ignoreEmptyStore = false) => {
  const options = {
    url: `${rpcUrl}/get_root`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  try {
    const data = JSON.parse(response);
    console.log(`Root for ${storeId}`, data);
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

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (data.success) {
      console.log('Downloaded Data', data);
      return data;
    }

    console.log(data);
  }

  return false;
};

export const dataLayerAvailable = async () => {
  const options = {
    url: `${rpcUrl}/get_value`,
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

    console.error(data);
    return false;
  } catch (error) {
    console.error(error);
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

  console.log('RPC Call: ', `${rpcUrl}/subscribe`, storeId, ip, port);

  try {
    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    const data = JSON.parse(response);

    if (Object.keys(data).includes('success') && data.success) {
      console.log('Successfully Subscribed: ', storeId, ip, port);
      return data;
    }

    return false;
  } catch (error) {
    console.log('Error Subscribing: ', error);
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
