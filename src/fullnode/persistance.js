import fs from 'fs';
import path from 'path';
import request from 'request-promise';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const rpcUrl = process.env.DATALAYER_URL;

const getBaseOptions = () => {
  const certFile = path.resolve(
    `${process.env.CHIA_ROOT}/config/ssl/data_layer/private_data_layer.crt`,
  );
  const keyFile = path.resolve(
    `${process.env.CHIA_ROOT}/config/ssl/data_layer/private_data_layer.key`,
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

  if (response.body.id) {
    return response.body.id;
  }

  throw new Error('Error creating new datalayer store');
};

export const pushChangeListToDataLayer = async (storeId, changelist) => {
  const options = {
    url: `${rpcUrl}/batch_update`,
    body: JSON.stringify({
      changelist,
      id: storeId,
    }),
  };

  const response = request(Object.assign({}, getBaseOptions(), options));

  if (response.body) {
    return response.body;
  }

  throw new Error('Error updating datalayer store');
};

export const getRoots = async (storeIds) => {
  const options = {
    url: `${rpcUrl}/get_roots`,
    body: JSON.stringify({
      ids: storeIds,
    }),
  };

  const response = request(Object.assign({}, getBaseOptions(), options));

  if (response.body) {
    return response.body;
  }

  return [];
};

export const getRoot = async (storeId) => {
  const options = {
    url: `${rpcUrl}/get_root`,
    body: JSON.stringify({
      id: storeId,
    }),
  };

  const response = request(Object.assign({}, getBaseOptions(), options));

  if (response.body && response.body.keys_values) {
    return response.body.keys_values;
  }
};

export const getStoreData = async (storeId) => {
  if (storeId) {
    const options = {
      url: `${rpcUrl}/get_keys_values`,
      body: JSON.stringify({
        id: storeId,
      }),
    };

    const response = request(Object.assign({}, getBaseOptions(), options));

    if (response.body && response.body.keys_values) {
      return response.body.keys_values;
    }
  }

  return new Error('Error getting datalayer store data');
};
