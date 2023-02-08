import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import request from 'request-promise';
import { getConfig } from '../utils/config-loader';
import yaml from 'js-yaml';
import { getChiaRoot } from '../utils/chia-root.js';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const rpcUrl = getConfig().APP.WALLET_URL;
const CONFIG = getConfig().APP;

const getBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certFile =
    CONFIG.NODE_CERTIFICATE_PATH ||
    path.resolve(`${chiaRoot}/config/ssl/full_node/private_full_node.crt`);

  const keyFile =
    CONFIG.NODE_KEY_PATH ||
    path.resolve(`${chiaRoot}/config/ssl/full_node/private_full_node.key`);

  const baseOptions = {
    method: 'POST',
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };

  return baseOptions;
};

const getActiveNetwork = async () => {
  const options = {
    url: `${rpcUrl}/get_network_info`,
    body: JSON.stringify({}),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data;
  }

  return false;
};

export const getChiaConfig = _.memoize(() => {
  const chiaRoot = getChiaRoot();
  const persistanceFolder = `${chiaRoot}/config`;
  const configFile = path.resolve(`${persistanceFolder}/config.yaml`);
  return yaml.load(fs.readFileSync(configFile, 'utf8'));
});

export default {
  getActiveNetwork,
  getChiaConfig,
};
