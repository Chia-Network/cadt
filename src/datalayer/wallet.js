import fs from 'fs';
import path from 'path';
import request from 'request-promise';
import { getConfig } from '../utils/config-loader';
import { getChiaRoot } from '../utils/chia-root.js';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const rpcUrl = getConfig().APP.WALLET_URL;
const USE_SIMULATOR = getConfig().APP.USE_SIMULATOR;

const getBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certFile = path.resolve(
    `${chiaRoot}/config/ssl/wallet/private_wallet.crt`,
  );
  const keyFile = path.resolve(
    `${chiaRoot}/config/ssl/wallet/private_wallet.key`,
  );

  const baseOptions = {
    method: 'POST',
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };

  return baseOptions;
};

const walletIsSynced = async () => {
  const options = {
    url: `${rpcUrl}/get_sync_status`,
    body: JSON.stringify({}),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data.synced;
  }

  return false;
};

const walletIsAvailable = async () => {
  try {
    const options = {
      url: `${rpcUrl}/get_sync_status`,
      body: JSON.stringify({}),
    };

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    if (response) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const getWalletBalance = async () => {
  try {
    if (getConfig().APP.USE_SIMULATOR) {
      return Promise.resolve('999.00');
    }

    const options = {
      url: `${rpcUrl}/get_wallet_balance`,
      body: JSON.stringify({
        wallet_id: 1,
      }),
    };

    const response = await request(
      Object.assign({}, getBaseOptions(), options),
    );

    if (response) {
      const data = JSON.parse(response);
      const balance = data?.wallet_balance?.spendable_balance;
      return balance / 1000000000000;
    }

    return false;
  } catch {
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
  const options = {
    url: `${rpcUrl}/get_transactions`,
    body: JSON.stringify({
      wallet_id: '1',
      sort_key: 'RELEVANCE',
    }),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

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

  const options = {
    url: `${rpcUrl}/get_next_address`,
    body: JSON.stringify({ wallet_id: 1, new_address: false }),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data.address;
  }

  return false;
};

export default {
  hasUnconfirmedTransactions,
  walletIsSynced,
  walletIsAvailable,
  getPublicAddress,
  getWalletBalance,
  waitForAllTransactionsToConfirm,
};
