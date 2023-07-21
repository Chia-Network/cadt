import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { getConfig } from '../utils/config-loader';
import { getChiaRoot } from '../utils/chia-root.js';
import { logger } from '../config/logger.cjs';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const rpcUrl = getConfig().APP.WALLET_URL;
const USE_SIMULATOR = getConfig().APP.USE_SIMULATOR;
const CONFIG = getConfig().APP;

const getBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certificateFolderPath =
    CONFIG.CERTIFICATE_FOLDER_PATH || `${chiaRoot}/config/ssl`;

  const certFile = path.resolve(
    `${certificateFolderPath}/wallet/private_wallet.crt`,
  );
  const keyFile = path.resolve(
    `${certificateFolderPath}/wallet/private_wallet.key`,
  );

  const baseOptions = {
    method: 'POST',
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
    timeout: 300000,
  };
  return baseOptions;
};

const walletIsSynced = async () => {
  try {
    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${rpcUrl}/get_sync_status`)
      .send({})
      .key(key)
      .cert(cert)
      .timeout(timeout);

    const data = JSON.parse(response.text);

    if (data.success) {
      return data.synced;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const walletIsAvailable = async () => {
  return await walletIsSynced();
};

const getWalletBalance = async () => {
  try {
    if (getConfig().APP.USE_SIMULATOR) {
      return Promise.resolve('999.00');
    }

    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${rpcUrl}/get_wallet_balance`)
      .send({
        wallet_id: 1,
      })
      .key(key)
      .cert(cert)
      .timeout(timeout);

    if (response.text) {
      const data = JSON.parse(response.text);
      const balance = data?.wallet_balance?.spendable_balance;
      return balance / 1000000000000;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const waitForAllTransactionsToConfirm = async () => {
  if (USE_SIMULATOR) {
    return true;
  }

  const unconfirmedTransactions = await hasUnconfirmedTransactions();
  await new Promise((resolve) => setTimeout(() => resolve(), 15000));

  if (unconfirmedTransactions) {
    return waitForAllTransactionsToConfirm();
  }

  return true;
};

const hasUnconfirmedTransactions = async () => {
  const { cert, key, timeout } = getBaseOptions();

  const response = await superagent
    .post(`${rpcUrl}/get_transactions`)
    .send({
      wallet_id: '1',
      sort_key: 'RELEVANCE',
    })
    .key(key)
    .cert(cert)
    .timeout(timeout);

  const data = JSON.parse(response.text);

  if (data.success) {
    console.log(
      `Pending confirmations: ${
        data.transactions.filter((transaction) => !transaction.confirmed).length
      }`,
    );

    return data.transactions.some((transaction) => !transaction.confirmed);
  }

  return false;
};

const getPublicAddress = async () => {
  if (getConfig().APP.USE_SIMULATOR) {
    return Promise.resolve('xch33300ddsje98f33hkkdf9dfuSIMULATED_ADDRESS');
  }

  const { cert, key, timeout } = getBaseOptions();

  const response = await superagent
    .post(`${rpcUrl}/get_next_address`)
    .send({ wallet_id: 1, new_address: false })
    .key(key)
    .cert(cert)
    .timeout(timeout);

  const data = JSON.parse(response.text);

  if (data.success) {
    return data.address;
  }

  return false;
};

const getActiveNetwork = async () => {
  const url = `${rpcUrl}/get_network_info`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send(JSON.stringify({}));

    const data = response.body;

    if (data.success) {
      return data;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

export default {
  hasUnconfirmedTransactions,
  walletIsSynced,
  walletIsAvailable,
  getPublicAddress,
  getWalletBalance,
  waitForAllTransactionsToConfirm,
  getActiveNetwork,
};
