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
        logger.info(`[COIN_MANAGEMENT] Successfully initiated coin split. ${maxPossibleCoins} new coins of ${COIN_SIZE} mojos will be created once the transaction confirms.`);
      } else {
        logger.error(`[COIN_MANAGEMENT] Failed to split coins: ${splitResult.error}`);
      }
      return;
    }

    // We have enough - create the coins we need
    logger.info(`[COIN_MANAGEMENT] Splitting coin ${coinId} into ${coinsNeeded} new coins of ${COIN_SIZE} mojos each (fee: ${SPLIT_FEE} mojos)`);

    const splitResult = await wallet.splitCoins(coinId, coinsNeeded, COIN_SIZE, SPLIT_FEE);

    if (splitResult.success) {
      logger.info(`[COIN_MANAGEMENT] Successfully initiated coin split. ${coinsNeeded} new coins of ${COIN_SIZE} mojos will be created once the transaction confirms.`);
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
    // Run every 6 hours, and run immediately on startup
    seconds: APP_CONFIG?.TASKS?.COIN_MANAGEMENT_TASK_INTERVAL || SIX_HOURS_IN_SECONDS,
    runImmediately: true,
  },
  task,
  { id: 'coin-management', preventOverrun: true },
);

export default job;
