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

  if (startTime === null) {
    startTime = Date.now();
  }

  const elapsed = Date.now() - startTime;
  if (elapsed > maxWaitMs) {
    // On timeout, log diagnostic details instead of a generic message
    try {
      const dlWalletId = await getDLWalletId();
      const walletIds = dlWalletId ? ['1', dlWalletId] : ['1'];
      for (const wid of walletIds) {
        const health = await getTransactionHealth(wid);
        const total = health.rejected.length + health.inMempool.length + health.pending.length;
        if (total > 0) {
          logger.warn(
            `waitForAllTransactionsToConfirm timed out after ${Math.round(elapsed / 1000)}s. ` +
            `Wallet ${wid}: ${health.rejected.length} rejected, ${health.inMempool.length} in mempool, ` +
            `${health.pending.length} pending. Oldest age: ${formatDuration(health.oldestUnconfirmedAge)}. ` +
            `Proceeding anyway.`,
          );
        }
      }
    } catch (diagError) {
      logger.warn(
        `waitForAllTransactionsToConfirm timed out after ${Math.round(elapsed / 1000)}s ` +
        `(diagnostic check also failed: ${diagError.message}) - proceeding anyway`,
      );
    }
    return true;
  }

  try {
    const anyUnconfirmed = await hasAnyUnconfirmedTransactions();
    await new Promise((resolve) => setTimeout(resolve, 15000));

    if (anyUnconfirmed) {
      const elapsedAfterSleep = Date.now() - startTime;
      if (elapsedAfterSleep > 300000 && elapsedAfterSleep % 60000 < 15000) {
        try {
          const dlWalletId = await getDLWalletId();
          const walletIds = dlWalletId ? ['1', dlWalletId] : ['1'];
          for (const wid of walletIds) {
            const health = await getTransactionHealth(wid);
            const total = health.rejected.length + health.inMempool.length + health.pending.length;
            if (total > 0) {
              logger.info(
                `waitForAllTransactionsToConfirm: wallet ${wid} still has ` +
                `${total} unconfirmed tx(s) after ${Math.round(elapsedAfterSleep / 1000)}s ` +
                `(${health.rejected.length} rejected, ${health.inMempool.length} in mempool, ` +
                `${health.pending.length} pending)`,
              );
            }
          }
        } catch {
          // best-effort diagnostics
        }
      }

      return waitForAllTransactionsToConfirm(startTime, maxWaitMs);
    }

    return true;
  } catch (error) {
    logger.warn(`Error checking transactions: ${error.message} - retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 15000));
    return waitForAllTransactionsToConfirm(startTime, maxWaitMs);
  }
};

const hasUnconfirmedTransactions = async (walletId = '1') => {
  const { cert, key, timeout } = getBaseOptions();

  const response = await superagent
    .post(`${rpcUrl}/get_transactions`)
    .send({
      wallet_id: walletId,
      sort_key: 'RELEVANCE',
    })
    .key(key)
    .cert(cert)
    .timeout(timeout);

  const data = response.body || JSON.parse(response.text);

  if (data.success) {
    const pendingCount = data.transactions.filter((transaction) => !transaction.confirmed).length;
    logger.debug(`Pending confirmations for wallet ${walletId}: ${pendingCount}`);

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

const getChiaVersion = async () => {
  const url = `${rpcUrl}/get_version`;
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
      return data.version || null;
    }
    return null;
  } catch (error) {
    logger.debug(`[diagnostics]: wallet get_version failed: ${error.message}`);
    return null;
  }
};

/**
 * Return the wallet's peer connections (used by /diagnostics to cross-reference
 * connected full-node peers against the trusted_peers map in the chia config).
 *
 * Returns an object with `success: false` on connection errors instead of
 * throwing, so the diagnostics endpoint can degrade gracefully without
 * bringing down the rest of the response.
 *
 * @returns {Promise<{success: boolean, connections?: Array, error?: string}>}
 */
const getWalletConnections = async () => {
  if (USE_SIMULATOR) {
    return { success: true, connections: [] };
  }

  const url = `${rpcUrl}/get_connections`;
  try {
    const { cert, key, timeout } = getBaseOptions();
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({});

    const data = response.body || JSON.parse(response.text);
    if (!data?.success) {
      return { success: false, error: data?.error || 'unknown error' };
    }

    const connections = (data.connections || []).map((c) => ({
      peerHost: c.peer_host,
      peerPort: c.peer_port,
      type: c.type,
      nodeId: c.node_id,
    }));
    return { success: true, connections };
  } catch (error) {
    logger.debug(`[diagnostics]: wallet get_connections failed: ${error.message}`);
    return { success: false, error: error.message };
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
 * @param {number} minTotalMojos - Minimum combined amount across usable coins (default: 0). Lets a
 *   caller relaxing requiredCoins to 1 still require the wallet can fund a whole batch of spends.
 * @returns {Promise<{success: boolean, coinCount?: number, error?: string}>}
 */
const DEFAULT_COIN_AMOUNT = CONFIG.DEFAULT_COIN_AMOUNT || 300;
const DEFAULT_COIN_FEE = CONFIG.DEFAULT_FEE || 3000;
const MIN_USABLE_COIN_SIZE = DEFAULT_COIN_AMOUNT + DEFAULT_COIN_FEE;

/**
 * Pure sufficiency check over wallet coin records: enough separate unspent
 * coins of a usable size, whose combined amount can fund the whole batch.
 * @param {Array<Object>} coinRecords - Records from get_coin_records
 * @param {number} requiredCoins - Number of separate coins needed
 * @param {number} minMojosPerCoin - Minimum mojos per coin
 * @param {number} minTotalMojos - Minimum combined mojos across usable coins
 * @returns {{sufficient: boolean, usableCoins: Array<Object>, totalBalance: number}}
 */
const evaluateSpendableCoins = (
  coinRecords,
  requiredCoins,
  minMojosPerCoin,
  minTotalMojos = 0,
) => {
  const usableCoins = coinRecords.filter((coin) => {
    const isUnspent = !coin.spent_height || coin.spent_height === 0;
    const hasSufficientBalance = coin.amount >= minMojosPerCoin;
    return isUnspent && hasSufficientBalance;
  });

  const totalBalance = usableCoins.reduce((sum, coin) => sum + coin.amount, 0);

  return {
    sufficient:
      usableCoins.length >= requiredCoins && totalBalance >= minTotalMojos,
    usableCoins,
    totalBalance,
  };
};

const waitForSpendableCoins = async (
  requiredCoins = 4,
  minMojosPerCoin = MIN_USABLE_COIN_SIZE,
  maxWaitMs = 300000,
  pollIntervalMs = 10000,
  minTotalMojos = 0,
) => {
  if (USE_SIMULATOR) {
    return { success: true, coinCount: 10, balance: 999000000000000 };
  }

  const startTime = Date.now();
  let lastLogTime = 0;

  logger.info(
    `[wallet]: Waiting for ${requiredCoins} coins of at least ${minMojosPerCoin} mojos each (timeout: ${maxWaitMs / 1000}s)`,
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
            `[wallet]: Waiting for pending transactions to confirm before org creation (${elapsed}s elapsed)`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      // Get actual coin records to count usable coins
      const coinResult = await getCoinRecords();

      if (!coinResult.success || !coinResult.coin_records) {
        logger.warn('[wallet]: Could not get coin records, retrying...');
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      const { sufficient, usableCoins, totalBalance } = evaluateSpendableCoins(
        coinResult.coin_records,
        requiredCoins,
        minMojosPerCoin,
        minTotalMojos,
      );

      // Log status every 30 seconds or when count changes
      if (Date.now() - lastLogTime > 30000) {
        lastLogTime = Date.now();
        logger.info(
          `[wallet]: Found ${usableCoins.length} usable coins (need ${requiredCoins}) with total ${totalBalance} mojos (${elapsed}s elapsed)`,
        );
        if (usableCoins.length > 0 && usableCoins.length < 10) {
          // Log individual coins for debugging
          usableCoins.forEach((coin, i) => {
            logger.debug(`[wallet]:   Coin ${i + 1}: ${coin.amount} mojos, id: ${coin.id?.substring(0, 16)}...`);
          });
        }
      }

      if (sufficient) {
        logger.info(
          `[wallet]: Sufficient coins available: ${usableCoins.length} coins of ${minMojosPerCoin}+ mojos (need ${requiredCoins})`,
        );
        return { success: true, coinCount: usableCoins.length, balance: totalBalance };
      }

      // Not enough coins yet - check if we should warn about coin management
      if (elapsed > 60) {
        if (usableCoins.length < requiredCoins) {
          logger.warn(
            `[wallet]: Only ${usableCoins.length}/${requiredCoins} usable coins available after ${elapsed}s. ` +
            `Coin management may need to split coins first.`,
          );
        } else {
          logger.warn(
            `[wallet]: Usable coins total ${totalBalance} mojos but ${minTotalMojos} are needed ` +
            `after ${elapsed}s. The wallet may need more funds.`,
          );
        }
      }
    } catch (error) {
      logger.warn(`[wallet]: Error checking coin availability: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const totalRequirement =
    minTotalMojos > 0 ? ` totalling at least ${minTotalMojos} mojos` : '';
  const msg = `Timeout waiting for ${requiredCoins} coins of ${minMojosPerCoin}+ mojos${totalRequirement} after ${elapsed}s`;
  logger.error(`[wallet]: ${msg}`);
  throw new Error(msg);
};

// Mempool inclusion status codes from Chia wallet's TransactionRecord.sent_to
const MempoolInclusionStatus = {
  SUCCESS: 1,
  PENDING: 2,
  FAILED: 3,
};

// Cached DL wallet ID (discovered once, reused thereafter)
let cachedDLWalletId = null;

// chia-blockchain WalletType enum value for DATA_LAYER (see wallet_types.py)
const CHIA_WALLET_TYPE_DATA_LAYER = 11;

/**
 * Extract the DataLayer wallet_id from a get_wallets RPC response.
 * Pure function — no I/O, no caching, no simulator awareness.
 * @param {Object} data - Parsed response body from get_wallets
 * @returns {string|null} wallet_id as a string, or null if not found
 */
const findDLWalletInResponse = (data) => {
  if (data.success && Array.isArray(data.wallets)) {
    const dlWallet = data.wallets.find((w) => w.type === CHIA_WALLET_TYPE_DATA_LAYER);
    if (dlWallet) {
      return String(dlWallet.id);
    }
  }
  return null;
};

/**
 * Discover the DataLayer wallet's wallet_id dynamically via get_wallets RPC.
 * Caches the result so subsequent calls avoid the RPC round-trip.
 * @returns {Promise<string|null>} The DL wallet's wallet_id as a string, or null if not found
 */
const getDLWalletId = async () => {
  if (cachedDLWalletId !== null) {
    return cachedDLWalletId;
  }

  if (USE_SIMULATOR) {
    cachedDLWalletId = '2';
    return cachedDLWalletId;
  }

  try {
    const { cert, key, timeout } = getBaseOptions();

    const response = await superagent
      .post(`${rpcUrl}/get_wallets`)
      .send({})
      .key(key)
      .cert(cert)
      .timeout(timeout);

    const data = response.body || JSON.parse(response.text);
    const walletId = findDLWalletInResponse(data);

    if (walletId) {
      cachedDLWalletId = walletId;
      logger.info(`Discovered DataLayer wallet_id: ${cachedDLWalletId}`);
      return cachedDLWalletId;
    }

    logger.warn('DataLayer wallet not found via get_wallets RPC');
    return null;
  } catch (error) {
    logger.error(`Error discovering DL wallet_id: ${error.message}`);
    return null;
  }
};

/**
 * Classify a single transaction's status based on its sent_to array.
 * sent_to is an array of [peer_id, status_code, error_message] tuples.
 * @param {Array} sentTo - The sent_to array from a TransactionRecord
 * @returns {'rejected'|'in_mempool'|'pending'}
 */
const classifyTransaction = (sentTo) => {
  if (!sentTo || sentTo.length === 0) {
    return 'pending';
  }

  const hasSuccess = sentTo.some(([, status]) => status === MempoolInclusionStatus.SUCCESS);
  const hasFailed = sentTo.some(([, status]) => status === MempoolInclusionStatus.FAILED);

  if (hasSuccess) {
    return 'in_mempool';
  }

  if (hasFailed && sentTo.every(([, status]) => status === MempoolInclusionStatus.FAILED)) {
    return 'rejected';
  }

  return 'pending';
};

/**
 * Format rejection reasons from sent_to for logging.
 * @param {Array} sentTo - The sent_to array from a TransactionRecord
 * @returns {string} Human-readable rejection summary
 */
const formatRejectionReasons = (sentTo) => {
  if (!sentTo || sentTo.length === 0) return 'no send attempts';
  const failedEntries = sentTo.filter(([, status]) => status === MempoolInclusionStatus.FAILED);
  if (failedEntries.length === 0) return 'no failures';
  const reasons = failedEntries.map(([peerId, , errorMsg]) =>
    `peer ${peerId?.substring(0, 8)}...: ${errorMsg || 'unknown error'}`
  );
  return `FAILED on ${failedEntries.length}/${sentTo.length} peers: ${reasons.join('; ')}`;
};

/**
 * Get the health status of unconfirmed transactions for a given wallet.
 * Classifies each unconfirmed tx as rejected, in_mempool, or pending.
 * @param {string} walletId - The wallet_id to check
 * @returns {Promise<{rejected: Array, inMempool: Array, pending: Array, stuckCount: number, oldestUnconfirmedAge: number|null}>}
 */
const getTransactionHealth = async (walletId) => {
  const { cert, key, timeout } = getBaseOptions();

  const response = await superagent
    .post(`${rpcUrl}/get_transactions`)
    .send({
      wallet_id: walletId,
      confirmed: false,
      sort_key: 'RELEVANCE',
    })
    .key(key)
    .cert(cert)
    .timeout(timeout);

  const data = response.body || JSON.parse(response.text);

  if (!data.success) {
    throw new Error(`get_transactions failed for wallet ${walletId}: ${data.error || 'unknown error'}`);
  }

  const unconfirmed = (data.transactions || []).filter((tx) => !tx.confirmed);
  const now = Date.now() / 1000; // seconds

  const result = {
    rejected: [],
    inMempool: [],
    pending: [],
    stuckCount: 0,
    oldestUnconfirmedAge: null,
  };

  for (const tx of unconfirmed) {
    const classification = classifyTransaction(tx.sent_to);
    const txAge = tx.created_at_time ? now - tx.created_at_time : null;
    const txRecord = {
      name: tx.name,
      type: tx.type,
      amount: tx.amount,
      createdAt: tx.created_at_time,
      age: txAge,
      sentTo: tx.sent_to,
      rejectionReason: classification === 'rejected' ? formatRejectionReasons(tx.sent_to) : null,
    };

    result[classification === 'in_mempool' ? 'inMempool' : classification].push(txRecord);

    if (txAge !== null) {
      if (result.oldestUnconfirmedAge === null || txAge > result.oldestUnconfirmedAge) {
        result.oldestUnconfirmedAge = txAge;
      }
    }
  }

  result.stuckCount = result.pending.filter((tx) => tx.age && tx.age > 600).length +
    result.inMempool.filter((tx) => tx.age && tx.age > 600).length;

  return result;
};

/**
 * Check for unconfirmed transactions across both the standard wallet (id 1)
 * and the DataLayer wallet.
 * @returns {Promise<boolean>} true if either wallet has unconfirmed transactions
 */
const hasAnyUnconfirmedTransactions = async () => {
  const standardHasUnconfirmed = await hasUnconfirmedTransactions('1');

  const dlWalletId = await getDLWalletId();
  if (dlWalletId && dlWalletId !== '1') {
    const dlHasUnconfirmed = await hasUnconfirmedTransactions(dlWalletId);
    return standardHasUnconfirmed || dlHasUnconfirmed;
  }

  return standardHasUnconfirmed;
};

/**
 * Format a duration in seconds as a human-readable string (e.g., "12m 34s").
 * @param {number} seconds
 * @returns {string}
 */
const formatDuration = (seconds) => {
  if (seconds == null) return 'unknown';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

/**
 * Clear rejected transactions for a wallet, with mandatory audit logging.
 *
 * SAFETY: The Chia wallet RPC delete_unconfirmed_transactions deletes ALL
 * unconfirmed txs for a wallet_id (no per-tx filter). Therefore this function
 * REFUSES to clear unless ALL unconfirmed txs for the wallet are in the
 * 'rejected' category.
 *
 * @param {string} walletId - The wallet_id to clear
 * @param {string[]} txIds - The tx_ids we expect to clear (for audit logging)
 * @param {string} context - Caller-provided context explaining why the clear is happening
 * @returns {Promise<{cleared: boolean, reason: string}>}
 */
const clearRejectedTransactions = async (walletId, txIds, context) => {
  const health = await getTransactionHealth(walletId);

  // Safety check: refuse if ANY unconfirmed tx is not rejected
  if (health.inMempool.length > 0 || health.pending.length > 0) {
    const reason =
      `Refusing to clear: wallet ${walletId} has ${health.inMempool.length} in-mempool ` +
      `and ${health.pending.length} pending tx(s) alongside ${health.rejected.length} rejected. ` +
      `delete_unconfirmed_transactions is wallet-wide and would destroy non-rejected txs.`;
    logger.warn(reason, { walletId, context, txIds });
    return { cleared: false, reason };
  }

  if (health.rejected.length === 0) {
    return { cleared: false, reason: 'No rejected transactions to clear' };
  }

  // Verify the txIds we care about are actually in the rejected set
  const rejectedNames = new Set(health.rejected.map((tx) => tx.name));
  const matchedTxIds = txIds.filter((id) => rejectedNames.has(id));
  const unmatchedTxIds = txIds.filter((id) => !rejectedNames.has(id));

  if (unmatchedTxIds.length > 0) {
    logger.warn(
      `Some requested tx_ids not found in rejected set: ${JSON.stringify(unmatchedTxIds)}`,
      { walletId, context },
    );
  }

  // All unconfirmed txs are rejected -- safe to clear
  const { cert, key, timeout } = getBaseOptions();

  try {
    await superagent
      .post(`${rpcUrl}/delete_unconfirmed_transactions`)
      .send({ wallet_id: walletId })
      .key(key)
      .cert(cert)
      .timeout(timeout);
  } catch (error) {
    const reason = `RPC delete_unconfirmed_transactions failed: ${error.message}`;
    logger.error(reason, { walletId, context });
    return { cleared: false, reason };
  }

  // Mandatory audit log entry
  const clearedTxDetails = health.rejected.map((tx) => ({
    txId: tx.name,
    age: formatDuration(tx.age),
    reason: tx.rejectionReason,
  }));

  logger.warn(
    `Cleared rejected transaction(s) for wallet ${walletId}`,
    {
      action: 'clear_rejected_transactions',
      walletId,
      txCount: health.rejected.length,
      txIds: health.rejected.map((tx) => tx.name),
      matchedRequestedTxIds: matchedTxIds,
      details: clearedTxDetails,
      context,
    },
  );

  return { cleared: true, reason: `Cleared ${health.rejected.length} rejected transaction(s)` };
};

// Errors the wallet raises when coin selection cannot fund a spend right now,
// typically because coins are tied up in unconfirmed transactions. These clear
// on their own as transactions confirm, so callers may retry on a time budget
// (see chia's coin_selection.py and data_layer_wallet.py for the sources).
const COIN_SHORTAGE_ERRORS = [
  'No spendable coins',
  "Can't select amount higher than our spendable balance",
  'greater than max spendable balance in a block',
  'Not enough coins to create new data layer singleton',
];

const isCoinShortageError = (error) =>
  COIN_SHORTAGE_ERRORS.some((msg) => error.message?.includes(msg));

const TRANSIENT_WALLET_ERRORS = [
  'Wallet needs to be fully synced',
  'DataLayerWallet not available',
  'DataLayer Wallet already exists',
  'UNIQUE constraint failed',
];

const isTransientWalletError = (error) =>
  isCoinShortageError(error) ||
  TRANSIENT_WALLET_ERRORS.some((msg) => error.message?.includes(msg));

const __test_resetDLWalletCache = () => {
  cachedDLWalletId = null;
};

export default {
  hasUnconfirmedTransactions,
  hasAnyUnconfirmedTransactions,
  walletIsSynced,
  walletIsAvailable,
  getPublicAddress,
  getWalletBalance,
  getWalletBalanceMojos,
  waitForAllTransactionsToConfirm,
  waitForSpendableCoins,
  getActiveNetwork,
  getChiaVersion,
  getWalletConnections,
  getLastWalletSyncError,
  getWalletBlockchainSyncStatus,
  getCoinRecords,
  splitCoins,
  isTransientWalletError,
  isCoinShortageError,
  getTransactionHealth,
  getDLWalletId,
  clearRejectedTransactions,
  formatDuration,
  findDLWalletInResponse,
  CHIA_WALLET_TYPE_DATA_LAYER,
  MIN_USABLE_COIN_SIZE,
  evaluateSpendableCoins,
  __test_resetDLWalletCache,
};
