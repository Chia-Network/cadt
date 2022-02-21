import fs from 'fs';
import path from 'path';
import request from 'request-promise';
import os from 'os';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const rpcUrl = process.env.WALLET_URL;

const getBaseOptions = () => {
  const homeDir = os.homedir();
  const certFile = path.resolve(
    `${homeDir}/.chia/mainnet/config/ssl/wallet/private_wallet.crt`,
  );
  const keyFile = path.resolve(
    `${homeDir}/.chia/mainnet/config/ssl/wallet/private_wallet.key`,
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
    body: JSON.stringify({
      genesis_initialized: true,
      success: true,
      synced: true,
      syncing: false,
    }),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data.synced;
  }

  return false;
};

const hasUnconfirmedTransactions = async () => {
  const options = {
    url: `${rpcUrl}/get_transactions`,
    body: JSON.stringify({}),
  };

  const response = await request(Object.assign({}, getBaseOptions(), options));

  const data = JSON.parse(response);

  if (data.success) {
    return data.transactions.some((transaction) => !transaction.confirmed);
  }

  return false;
};

export default {
  hasUnconfirmedTransactions,
  walletIsSynced,
};
