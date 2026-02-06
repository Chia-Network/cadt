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
      // Only check synced=true
      // The syncing flag may remain true indefinitely on testnets while the wallet
      // continues to sync new blocks, but transactions can still be performed
      const isSynced = data.synced === true;

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

/**
 * Get the wallet's blockchain synchronization status.
 * This checks if the wallet is synced with the Chia blockchain.
 * NOT to be confused with DataLayer store sync status (use getDataLayerStoreSyncStatus for that).
 * @returns {Promise<{success: boolean, synced?: boolean, syncing?: boolean, genesis_initialized?: boolean}>}
 */
const getWalletBlockchainSyncStatus = async () => {
  // In simulator mode, return synced status
  if (USE_SIMULATOR) {
    return {
      success: true,
      synced: true,
      syncing: false,
      genesis_initialized: true,
    };
  }

  try {
    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${rpcUrl}/get_sync_status`)
      .send({})
      .key(key)
      .cert(cert)
      .timeout(timeout);

    const data = response.body || JSON.parse(response.text);
    return {
      success: data.success || false,
      synced: data.synced,
      syncing: data.syncing,
      genesis_initialized: data.genesis_initialized,
    };
  } catch (error) {
    logger.error(`Error getting wallet sync status: ${error.message}`);
    return { success: false, error: error.message };
  }
};

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

const waitForAllTransactionsToConfirm = async (startTime = null, maxWaitMs = 1800000) => {
  if (USE_SIMULATOR) {
    return true;
  }

  // Initialize start time on first call
  if (startTime === null) {
    startTime = Date.now();
  }

  // Check for timeout (default 30 minutes)
  const elapsed = Date.now() - startTime;
  if (elapsed > maxWaitMs) {
    logger.warn(`waitForAllTransactionsToConfirm timed out after ${Math.round(elapsed / 1000)}s - proceeding anyway`);
    return true;
  }

  try {
    const unconfirmedTransactions = await hasUnconfirmedTransactions();
    await new Promise((resolve) => setTimeout(() => resolve(), 15000));

    if (unconfirmedTransactions) {
      return waitForAllTransactionsToConfirm(startTime, maxWaitMs);
    }

    return true;
  } catch (error) {
    // If we can't check transactions (wallet unavailable), wait and retry
    logger.warn(`Error checking transactions: ${error.message} - retrying...`);
    await new Promise((resolve) => setTimeout(() => resolve(), 15000));
    return waitForAllTransactionsToConfirm(startTime, maxWaitMs);
  }
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
  // Check simulator mode - check both config AND env var directly
  // (env var check needed because config may be memoized before env var was set)
  const isSimulator = getWalletConfig().USE_SIMULATOR || process.env.USE_SIMULATOR === 'true';
  if (isSimulator) {
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
        push: true,  // Required to actually submit the transaction
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

/**
 * Wait for sufficient spendable coins to be available for organization creation.
 * Organization creation requires 4 stores created in parallel, each needing ~3001 mojos.
 *
 * This function checks ACTUAL coin records, not just spendable_balance, because:
 * - spendable_balance doesn't always reflect pending transactions correctly
 * - We need multiple separate coins for parallel store creation
 *
 * @param {number} requiredCoins - Number of separate coins needed (default: 4 for parallel store creation)
 * @param {number} minMojosPerCoin - Minimum mojos per coin (default: DEFAULT_COIN_AMOUNT + DEFAULT_FEE, must cover operation and fee)
 * @param {number} maxWaitMs - Maximum wait time in milliseconds (default: 5 minutes)
 * @param {number} pollIntervalMs - Polling interval in milliseconds (default: 10 seconds)
 * @returns {Promise<{success: boolean, coinCount?: number, error?: string}>}
 */
const DEFAULT_COIN_AMOUNT = CONFIG.DEFAULT_COIN_AMOUNT || 300;
const DEFAULT_COIN_FEE = CONFIG.DEFAULT_FEE || 3000;
const MIN_USABLE_COIN_SIZE = DEFAULT_COIN_AMOUNT + DEFAULT_COIN_FEE;

const waitForSpendableCoins = async (
  requiredCoins = 4,
  minMojosPerCoin = MIN_USABLE_COIN_SIZE,
  maxWaitMs = 300000,
  pollIntervalMs = 10000,
) => {
  if (USE_SIMULATOR) {
    return { success: true, coinCount: 10, balance: 999000000000000 };
  }

  const startTime = Date.now();
  let lastLogTime = 0;

  logger.info(
    `[v2]: Waiting for ${requiredCoins} coins of at least ${minMojosPerCoin} mojos each (timeout: ${maxWaitMs / 1000}s)`,
  );

  while (Date.now() - startTime < maxWaitMs) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      // Check for pending transactions first
      const hasPending = await hasUnconfirmedTransactions();

      if (hasPending) {
        // Log every 30 seconds
        if (Date.now() - lastLogTime > 30000) {
          lastLogTime = Date.now();
          logger.info(
            `[v2]: Waiting for pending transactions to confirm before org creation (${elapsed}s elapsed)`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      // Get actual coin records to count usable coins
      const coinResult = await getCoinRecords();

      if (!coinResult.success || !coinResult.coin_records) {
        logger.warn('[v2]: Could not get coin records, retrying...');
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      // Count coins that are unspent and have sufficient balance
      // Filter to coins that are unspent (spent_height === 0 or undefined)
      const usableCoins = coinResult.coin_records.filter((coin) => {
        const isUnspent = !coin.spent_height || coin.spent_height === 0;
        const hasSufficientBalance = coin.amount >= minMojosPerCoin;
        return isUnspent && hasSufficientBalance;
      });

      const totalBalance = usableCoins.reduce((sum, coin) => sum + coin.amount, 0);

      // Log status every 30 seconds or when count changes
      if (Date.now() - lastLogTime > 30000) {
        lastLogTime = Date.now();
        logger.info(
          `[v2]: Found ${usableCoins.length} usable coins (need ${requiredCoins}) with total ${totalBalance} mojos (${elapsed}s elapsed)`,
        );
        if (usableCoins.length > 0 && usableCoins.length < 10) {
          // Log individual coins for debugging
          usableCoins.forEach((coin, i) => {
            logger.debug(`[v2]:   Coin ${i + 1}: ${coin.amount} mojos, id: ${coin.id?.substring(0, 16)}...`);
          });
        }
      }

      if (usableCoins.length >= requiredCoins) {
        logger.info(
          `[v2]: Sufficient coins available: ${usableCoins.length} coins of ${minMojosPerCoin}+ mojos (need ${requiredCoins})`,
        );
        return { success: true, coinCount: usableCoins.length, balance: totalBalance };
      }

      // Not enough coins yet - check if we should warn about coin management
      if (elapsed > 60 && usableCoins.length < requiredCoins) {
        logger.warn(
          `[v2]: Only ${usableCoins.length}/${requiredCoins} usable coins available after ${elapsed}s. ` +
          `Coin management may need to split coins first.`,
        );
      }
    } catch (error) {
      logger.warn(`[v2]: Error checking coin availability: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  logger.error(
    `[v2]: Timeout waiting for spendable coins after ${elapsed}s`,
  );
  return {
    success: false,
    error: `Timeout waiting for ${requiredCoins} coins of ${minMojosPerCoin}+ mojos after ${elapsed}s`,
  };
};

export default {
  hasUnconfirmedTransactions,
  walletIsSynced,
  walletIsAvailable,
  getPublicAddress,
  getWalletBalance,
  getWalletBalanceMojos,
  waitForAllTransactionsToConfirm,
  waitForSpendableCoins,
  getActiveNetwork,
  getLastWalletSyncError,
  getWalletBlockchainSyncStatus,
  getCoinRecords,
  splitCoins,
};
