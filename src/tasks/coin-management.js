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

// Target number of coins to maintain in the wallet
const TARGET_COIN_COUNT = 10;

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

    // Filter to only unspent coins (spent_height === 0)
    const allCoins = coinsResult.coin_records || [];
    const unspentCoins = allCoins.filter((coin) => coin.spent_height === 0);
    const coinCount = unspentCoins.length;

    logger.info(`[COIN_MANAGEMENT] Current unspent coin count: ${coinCount}`);

    // If we have enough coins, no action needed
    if (coinCount >= TARGET_COIN_COUNT) {
      logger.info(`[COIN_MANAGEMENT] Wallet has ${coinCount} coins, which meets the target of ${TARGET_COIN_COUNT}. No action needed.`);
      return;
    }

    // Calculate the coin size needed
    const defaultFee = APP_CONFIG.DEFAULT_FEE || 3000;
    const defaultCoinAmount = APP_CONFIG.DEFAULT_COIN_AMOUNT || 300;
    const coinSize = defaultCoinAmount + defaultFee;

    // Find the largest coin to split
    if (unspentCoins.length === 0) {
      logger.warn('[COIN_MANAGEMENT] No unspent coins available in wallet');
      return;
    }

    // Sort coins by amount (descending) to find the largest
    const sortedCoins = [...unspentCoins].sort((a, b) => {
      const amountA = a.amount || 0;
      const amountB = b.amount || 0;
      return amountB - amountA;
    });

    const largestCoin = sortedCoins[0];
    const largestCoinAmount = largestCoin.amount || 0;
    const coinId = largestCoin.id;

    if (!coinId) {
      logger.error('[COIN_MANAGEMENT] Could not determine coin ID for the largest coin.');
      logger.debug('[COIN_MANAGEMENT] Coin data:', JSON.stringify(largestCoin, null, 2));
      return;
    }

    logger.info(`[COIN_MANAGEMENT] Largest coin: ${largestCoinAmount} mojos, ID: ${coinId}`);

    // Calculate how many coins we can create
    // We need: (numberOfCoins * coinSize) + fee <= largestCoinAmount
    // The split_coins RPC creates numberOfCoins new coins plus a remainder
    const coinsNeeded = TARGET_COIN_COUNT - coinCount;
    const feeForSplit = defaultFee;

    // Calculate max coins we can create
    // Total required = (numberOfCoins * coinSize) + fee
    const maxPossibleCoins = Math.floor((largestCoinAmount - feeForSplit) / coinSize);

    if (maxPossibleCoins < 1) {
      const currencySymbol = await getCurrencySymbol();
      logger.warn(
        `[COIN_MANAGEMENT] WARNING: Largest coin (${formatMojos(largestCoinAmount, currencySymbol)}) is too small to split. ` +
        `Each new coin requires ${formatMojos(coinSize, currencySymbol)} (DEFAULT_COIN_AMOUNT + DEFAULT_FEE).`
      );
      return;
    }

    // Determine actual number of coins to create
    const coinsToCreate = Math.min(coinsNeeded, maxPossibleCoins, TARGET_COIN_COUNT);

    // Check if we can create the target number of coins
    const currencySymbol = await getCurrencySymbol();

    if (coinsToCreate < coinsNeeded) {
      // Calculate remaining transactions possible
      const currentBalance = await wallet.getWalletBalanceMojos();
      const remainingTransactions = Math.floor((currentBalance || largestCoinAmount) / coinSize);

      logger.warn(
        `[COIN_MANAGEMENT] WARNING: Insufficient balance to create ${TARGET_COIN_COUNT} coins. ` +
        `Creating ${coinsToCreate} coins instead. ` +
        `There are approximately ${remainingTransactions} transactions worth of ${currencySymbol} remaining in the wallet. ` +
        `Consider adding more funds to ensure CADT can operate efficiently.`
      );
    }

    // Perform the coin split
    logger.info(`[COIN_MANAGEMENT] Splitting coin ${coinId} into ${coinsToCreate} new coins of ${coinSize} mojos each`);

    const splitResult = await wallet.splitCoins(coinId, coinsToCreate, coinSize, feeForSplit);

    if (splitResult.success) {
      logger.info(`[COIN_MANAGEMENT] Successfully initiated coin split. ${coinsToCreate} new coins will be created once the transaction confirms.`);
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
