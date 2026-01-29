import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader';
import wallet from '../datalayer/wallet.js';

const CONFIG = getConfig();
const APP_CONFIG = CONFIG.APP;

// Coin management constants
const TARGET_COIN_COUNT = 12;      // Number of coins to maintain
const COIN_SIZE = 10000;           // Size of each coin in mojos (enough for DataLayer operations)
const SPLIT_FEE = 3000;            // Fee for the split transaction

// 6 hours in seconds
const SIX_HOURS_IN_SECONDS = 6 * 60 * 60;

// Wait for split confirmation settings
const SPLIT_CONFIRMATION_TIMEOUT_MS = 600000; // 10 minutes
const SPLIT_CONFIRMATION_POLL_INTERVAL_MS = 15000; // 15 seconds

/**
 * Get the currency symbol based on network (XCH for mainnet, TXCH for testnet)
 * @returns {Promise<string>} Currency symbol
 */
const getCurrencySymbol = async () => {
  try {
    const networkInfo = await wallet.getActiveNetwork();
    if (networkInfo && networkInfo.network_name) {
      return networkInfo.network_name.includes('mainnet') ? 'XCH' : 'TXCH';
    }
  } catch (error) {
    logger.debug('Could not determine network, defaulting to XCH');
  }
  return APP_CONFIG.CHIA_NETWORK === 'mainnet' ? 'XCH' : 'TXCH';
};

/**
 * Format mojos to human-readable currency string
 * @param {number} mojos - Amount in mojos
 * @param {string} symbol - Currency symbol (XCH/TXCH)
 * @returns {string} Formatted string
 */
const formatMojos = (mojos, symbol) => {
  const xch = mojos / 1000000000000;
  return `${xch.toFixed(12)} ${symbol} (${mojos} mojos)`;
};

/**
 * Wait for a coin split transaction to confirm by checking for new coins
 * @param {number} expectedNewCoins - Number of new coins expected from the split
 * @param {string} originalCoinId - The ID of the coin that was split (to verify it's spent)
 * @returns {Promise<boolean>} True if split confirmed, false if timeout
 */
const waitForSplitConfirmation = async (expectedNewCoins, originalCoinId) => {
  const startTime = Date.now();
  
  logger.info(`[COIN_MANAGEMENT] Waiting for split transaction to confirm (expecting ${expectedNewCoins} new coins of ${COIN_SIZE}+ mojos)...`);
  
  while (Date.now() - startTime < SPLIT_CONFIRMATION_TIMEOUT_MS) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const coinsResult = await wallet.getCoinRecords();
      
      if (!coinsResult.success || !coinsResult.coin_records) {
        logger.warn('[COIN_MANAGEMENT] Could not get coin records while waiting for confirmation, retrying...');
        await new Promise((resolve) => setTimeout(resolve, SPLIT_CONFIRMATION_POLL_INTERVAL_MS));
        continue;
      }
      
      const allCoins = coinsResult.coin_records || [];
      const unspentCoins = allCoins.filter((coin) => coin.spent_height === 0);
      const usableCoins = unspentCoins.filter((coin) => coin.amount >= COIN_SIZE);
      
      // Check if the original coin has been spent (no longer in unspent list)
      const originalCoinStillUnspent = unspentCoins.some((coin) => coin.id === originalCoinId);
      
      if (!originalCoinStillUnspent && usableCoins.length >= expectedNewCoins) {
        logger.info(`[COIN_MANAGEMENT] Split confirmed! Found ${usableCoins.length} usable coins (${elapsed}s elapsed)`);
        return true;
      }
      
      // Log progress every poll
      if (originalCoinStillUnspent) {
        logger.info(`[COIN_MANAGEMENT] Waiting for split to confirm... original coin still unspent (${elapsed}s elapsed)`);
      } else {
        logger.info(`[COIN_MANAGEMENT] Split in progress... found ${usableCoins.length}/${expectedNewCoins} expected coins (${elapsed}s elapsed)`);
      }
      
    } catch (error) {
      logger.warn(`[COIN_MANAGEMENT] Error checking split confirmation: ${error.message}`);
    }
    
    await new Promise((resolve) => setTimeout(resolve, SPLIT_CONFIRMATION_POLL_INTERVAL_MS));
  }
  
  logger.warn(`[COIN_MANAGEMENT] Timeout waiting for split confirmation after ${SPLIT_CONFIRMATION_TIMEOUT_MS / 1000}s`);
  return false;
};

/**
 * Check wallet coin count and split if necessary
 * Creates 12 coins of 10000 mojos each for DataLayer operations
 */
const runCoinManagement = async () => {
  logger.info('[COIN_MANAGEMENT] Starting coin management check');

  try {
    // Skip in simulator mode
    if (APP_CONFIG.USE_SIMULATOR) {
      logger.debug('[COIN_MANAGEMENT] Simulator mode - skipping coin management');
      return;
    }

    // Ensure wallet is synced
    await assertWalletIsSynced();
    await assertDataLayerAvailable();

    // Get coin records (includes coin IDs needed for splitting)
    const coinsResult = await wallet.getCoinRecords();

    if (!coinsResult.success) {
      logger.error('[COIN_MANAGEMENT] Failed to get coin records');
      return;
    }

    // Filter to only unspent coins with sufficient size (spent_height === 0)
    const allCoins = coinsResult.coin_records || [];
    const unspentCoins = allCoins.filter((coin) => coin.spent_height === 0);
    const usableCoins = unspentCoins.filter((coin) => coin.amount >= COIN_SIZE);
    const coinCount = usableCoins.length;

    logger.info(`[COIN_MANAGEMENT] Current usable coin count: ${coinCount} (of ${unspentCoins.length} total unspent)`);

    // If we have enough usable coins, no action needed
    if (coinCount >= TARGET_COIN_COUNT) {
      logger.info(`[COIN_MANAGEMENT] Wallet has ${coinCount} usable coins (${COIN_SIZE}+ mojos each), which meets the target of ${TARGET_COIN_COUNT}. No action needed.`);
      return;
    }

    // Find the largest coin to split
    if (unspentCoins.length === 0) {
      logger.warn('[COIN_MANAGEMENT] No unspent coins available in wallet');
      return;
    }

    // Sort coins by amount (descending) to find the largest
    const sortedCoins = [...unspentCoins].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const largestCoin = sortedCoins[0];
    const largestCoinAmount = largestCoin.amount || 0;
    const coinId = largestCoin.id;

    if (!coinId) {
      logger.error('[COIN_MANAGEMENT] Could not determine coin ID for the largest coin.');
      logger.debug('[COIN_MANAGEMENT] Coin data:', JSON.stringify(largestCoin, null, 2));
      return;
    }

    logger.info(`[COIN_MANAGEMENT] Largest coin: ${largestCoinAmount} mojos, ID: ${coinId}`);

    // Double-check wallet sync status before attempting split
    // Only require synced=true (syncing flag may stay true indefinitely on testnets)
    logger.info('[COIN_MANAGEMENT] Verifying wallet sync status before split...');
    const syncStatus = await wallet.getSyncStatus();
    if (!syncStatus.success) {
      logger.error('[COIN_MANAGEMENT] Could not get wallet sync status. Aborting split attempt.');
      return;
    }
    
    // Only check synced=true, ignore syncing flag
    if (syncStatus.synced !== true) {
      logger.warn(
        `[COIN_MANAGEMENT] Wallet is not synced (synced=${syncStatus.synced}, syncing=${syncStatus.syncing}). ` +
        `Aborting coin split - will retry on next interval when wallet is synced.`
      );
      return;
    }
    logger.info(`[COIN_MANAGEMENT] Wallet synced=${syncStatus.synced} (syncing=${syncStatus.syncing}). Proceeding with coin split.`);

    // Calculate how many coins we need and can create
    const coinsNeeded = TARGET_COIN_COUNT - coinCount;
    const requiredAmount = (coinsNeeded * COIN_SIZE) + SPLIT_FEE;

    // Check if we have enough mojos in the largest coin
    if (largestCoinAmount < requiredAmount) {
      const currencySymbol = await getCurrencySymbol();
      const maxPossibleCoins = Math.floor((largestCoinAmount - SPLIT_FEE) / COIN_SIZE);
      
      if (maxPossibleCoins < 1) {
        logger.warn(
          `[COIN_MANAGEMENT] WARNING: Largest coin (${formatMojos(largestCoinAmount, currencySymbol)}) is too small to split. ` +
          `Need at least ${formatMojos(COIN_SIZE + SPLIT_FEE, currencySymbol)} to create one ${COIN_SIZE} mojo coin.`
        );
        return;
      }

      logger.warn(
        `[COIN_MANAGEMENT] WARNING: Insufficient balance to create ${coinsNeeded} coins. ` +
        `Need ${formatMojos(requiredAmount, currencySymbol)} but largest coin only has ${formatMojos(largestCoinAmount, currencySymbol)}. ` +
        `Creating ${maxPossibleCoins} coins instead.`
      );
      
      // Create as many as we can
      const splitResult = await wallet.splitCoins(coinId, maxPossibleCoins, COIN_SIZE, SPLIT_FEE);
      if (splitResult.success) {
        logger.info(`[COIN_MANAGEMENT] Successfully initiated coin split. Waiting for ${maxPossibleCoins} new coins of ${COIN_SIZE} mojos to confirm...`);
        // Wait for the split to confirm before returning
        const confirmed = await waitForSplitConfirmation(maxPossibleCoins, coinId);
        if (!confirmed) {
          logger.warn('[COIN_MANAGEMENT] Split transaction may still be pending. Coins will be available once confirmed.');
        }
      } else {
        logger.error(`[COIN_MANAGEMENT] Failed to split coins: ${splitResult.error}`);
      }
      return;
    }

    // We have enough - create the coins we need
    logger.info(`[COIN_MANAGEMENT] Splitting coin ${coinId} into ${coinsNeeded} new coins of ${COIN_SIZE} mojos each (fee: ${SPLIT_FEE} mojos)`);

    const splitResult = await wallet.splitCoins(coinId, coinsNeeded, COIN_SIZE, SPLIT_FEE);

    if (splitResult.success) {
      logger.info(`[COIN_MANAGEMENT] Successfully initiated coin split. Waiting for ${coinsNeeded} new coins of ${COIN_SIZE} mojos to confirm...`);
      // Wait for the split to confirm before returning
      const confirmed = await waitForSplitConfirmation(coinsNeeded, coinId);
      if (!confirmed) {
        logger.warn('[COIN_MANAGEMENT] Split transaction may still be pending. Coins will be available once confirmed.');
      }
    } else {
      logger.error(`[COIN_MANAGEMENT] Failed to split coins: ${splitResult.error}`);
    }

  } catch (error) {
    logger.error(`[COIN_MANAGEMENT] Error during coin management: ${error.message}`);
    logger.debug('[COIN_MANAGEMENT] Full error:', error);
  }
};

const task = new Task('coin-management', async () => {
  await runCoinManagement();
});

const job = new SimpleIntervalJob(
  {
    // Run every 6 hours - NOT immediately on startup (we call runCoinManagement manually first)
    seconds: APP_CONFIG?.TASKS?.COIN_MANAGEMENT_TASK_INTERVAL || SIX_HOURS_IN_SECONDS,
    runImmediately: false,
  },
  task,
  { id: 'coin-management', preventOverrun: true },
);

// Export runCoinManagement for direct invocation during startup
export { runCoinManagement };
export default job;
