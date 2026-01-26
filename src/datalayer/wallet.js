import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { getActiveConfig } from '../utils/config-loader';
import { getChiaRoot } from '../utils/chia-root.js';
import { logger } from '../config/logger.js';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

// Use getActiveConfig() to get wallet URL from the enabled version's config
// This ensures we use V2 config when V1 is disabled and V2 is enabled
const getWalletConfig = () => getActiveConfig().APP;

const rpcUrl = getWalletConfig().WALLET_URL;
const USE_SIMULATOR = getWalletConfig().USE_SIMULATOR;
const CONFIG = getWalletConfig();

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

// Store last error for assertWalletIsSynced to check
let lastWalletSyncError = null;

const walletIsSynced = async () => {
  lastWalletSyncError = null; // Clear previous error

  try {
    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${rpcUrl}/get_sync_status`)
      .send({})
      .key(key)
      .cert(cert)
      .timeout(timeout);

    // Use response.body if available (superagent auto-parses JSON), otherwise parse response.text
    const data = response.body || JSON.parse(response.text);

    if (data.success) {
      // Check both synced and syncing fields for robustness
      // Wallet is considered synced if synced is true AND (syncing is false or undefined)
      // Some wallet RPC versions may not include syncing field
      const isSynced = data.synced === true && (data.syncing === false || data.syncing === undefined);

      if (!isSynced) {
        logger.debug(`Wallet sync status: synced=${data.synced}, syncing=${data.syncing}, genesis_initialized=${data.genesis_initialized}`);
      }

      return isSynced;
    }

    logger.warn(`Wallet sync status check returned success=false: ${JSON.stringify(data)}`);
    return false;
  } catch (error) {
    // Distinguish between connection errors and other errors
    const errorCode = error.code || error.errno || '';
    const errorMessage = error.message || '';

    // Check for connection-related errors
    const isConnectionError =
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNRESET' ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('connect') ||
      errorMessage.includes('timeout');

    if (isConnectionError) {
      logger.error(`Wallet RPC is not responding at ${rpcUrl}. Error: ${error.message}`, error);
      // Store error info for assertWalletIsSynced to use
      lastWalletSyncError = {
        isConnectionError: true,
        walletRpcUrl: rpcUrl,
        message: error.message,
      };
    } else {
      logger.error(`Error checking wallet sync status: ${error.message}`, error);
    }

    // Return false to maintain backward compatibility
    return false;
  }
};

// Export function to check last error (for assertWalletIsSynced)
const getLastWalletSyncError = () => lastWalletSyncError;

const walletIsAvailable = async () => {
  return await walletIsSynced();
};

const getWalletBalance = async () => {
  try {
    if (getWalletConfig().USE_SIMULATOR) {
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
  if (getWalletConfig().USE_SIMULATOR) {
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

/**
 * Get coin records from the wallet (includes coin IDs)
 * @returns {Promise<{success: boolean, coin_records: Array}>} Object with coin_records array and success flag
 */
const getCoinRecords = async () => {
  if (USE_SIMULATOR) {
    // In simulator mode, return mock coins
    return {
      success: true,
      coin_records: [
        {
          id: '0xmockcoinid1234567890',
          amount: 1000000000000,
          spent_height: 0,
        },
      ],
    };
  }

  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(`${rpcUrl}/get_coin_records`)
      .send({ wallet_id: 1 })
      .key(key)
      .cert(cert)
      .timeout(timeout);

    const data = response.body || JSON.parse(response.text);

    if (data.success) {
      return data;
    }

    logger.error('Failed to get coin records:', data);
    return { success: false, coin_records: [] };
  } catch (error) {
    logger.error('Error getting coin records:', error);
    return { success: false, coin_records: [] };
  }
};

/**
 * Get the wallet balance in mojos
 * @returns {Promise<number|null>} Wallet balance in mojos or null on error
 */
const getWalletBalanceMojos = async () => {
  if (USE_SIMULATOR) {
    return 999000000000000; // Mock balance for simulator
  }

  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(`${rpcUrl}/get_wallet_balance`)
      .send({ wallet_id: 1 })
      .key(key)
      .cert(cert)
      .timeout(timeout);

    const data = response.body || JSON.parse(response.text);

    if (data.success) {
      return data.wallet_balance?.spendable_balance || 0;
    }

    return null;
  } catch (error) {
    logger.error('Error getting wallet balance in mojos:', error);
    return null;
  }
};

/**
 * Split a coin into multiple smaller coins
 * @param {string} targetCoinId - The coin ID to split (hex string, with or without 0x prefix)
 * @param {number} numberOfCoins - Number of new coins to create
 * @param {number} amountPerCoin - Amount per new coin in mojos
 * @param {number} fee - Transaction fee in mojos
 * @returns {Promise<{success: boolean, error?: string}>} Result of the split operation
 */
const splitCoins = async (targetCoinId, numberOfCoins, amountPerCoin, fee = 0) => {
  if (USE_SIMULATOR) {
    logger.info(`[SIMULATOR] Would split coin into ${numberOfCoins} new coins`);
    return { success: true };
  }

  const { cert, key, timeout } = getBaseOptions();

  // Ensure coin ID has 0x prefix
  const formattedCoinId = targetCoinId.startsWith('0x')
    ? targetCoinId
    : `0x${targetCoinId}`;

  try {
    const response = await superagent
      .post(`${rpcUrl}/split_coins`)
      .send({
        wallet_id: 1,
        target_coin_id: formattedCoinId,
        number_of_coins: numberOfCoins,
        amount_per_coin: amountPerCoin,
        fee: fee,
      })
      .key(key)
      .cert(cert)
      .timeout(timeout);

    const data = response.body || JSON.parse(response.text);

    if (data.success) {
      logger.info(`Successfully initiated coin split: ${numberOfCoins} new coins of ${amountPerCoin} mojos each`);
      return { success: true, transactions: data.transactions };
    }

    logger.error('Failed to split coins:', data.error || data);
    return { success: false, error: data.error || 'Unknown error' };
  } catch (error) {
    logger.error('Error splitting coins:', error.message);
    return { success: false, error: error.message };
  }
};

export default {
  hasUnconfirmedTransactions,
  walletIsSynced,
  walletIsAvailable,
  getPublicAddress,
  getWalletBalance,
  getWalletBalanceMojos,
  waitForAllTransactionsToConfirm,
  getActiveNetwork,
  getLastWalletSyncError,
  getCoinRecords,
  splitCoins,
};
