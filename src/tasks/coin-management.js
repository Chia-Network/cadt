import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import _ from 'lodash';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader';
import { coerceConfigNumber } from '../utils/numeric-config.js';
import { getChiaConfig } from '../datalayer/fullNode.js';
import wallet from '../datalayer/wallet.js';

const CONFIG = getConfig();
const APP_CONFIG = CONFIG.APP;

// Coin management constants
const TARGET_COIN_COUNT = 15;      // Number of coins to maintain
const SPLIT_FEE = APP_CONFIG.DEFAULT_FEE || 3000; // Fee from config, fallback to 3000 mojos
const DEFAULT_COIN_AMOUNT = APP_CONFIG.DEFAULT_COIN_AMOUNT || 300; // Coin amount for DataLayer operations from config
const MIN_USABLE_COIN_SIZE = DEFAULT_COIN_AMOUNT + SPLIT_FEE; // A coin must cover both the operation amount and the fee to be usable
// Chia's own default when wallet.xch_spam_amount is absent from its config.
const CHIA_DEFAULT_XCH_SPAM_AMOUNT = 1_000_000;

/**
 * Size of the coins we create, in mojos.
 *
 * Chia's wallet hides coins below `wallet.xch_spam_amount` once enough small
 * UTXOs accumulate, so every coin we create must clear that threshold outright
 * rather than merely equal it. When the operational minimum is smaller than the
 * threshold we create the smallest coin that still clears it, so a wallet is
 * not carved into more value per coin than an operation needs.
 *
 * @param {unknown} rawSpamAmount   wallet.xch_spam_amount from Chia's config.
 * @param {number} [minUsableCoinSize]
 * @param {{warn: (msg: string) => void}} [log]
 * @returns {number}
 */
export const resolveCoinSize = (
  rawSpamAmount,
  minUsableCoinSize = MIN_USABLE_COIN_SIZE,
  log = logger,
) => {
  const dustFilterFloor = coerceConfigNumber(
    rawSpamAmount,
    CHIA_DEFAULT_XCH_SPAM_AMOUNT,
    'chia config wallet.xch_spam_amount',
    log,
  );

  return Math.max(minUsableCoinSize, dustFilterFloor + 1);
};

// Reads lazily, and only when a split is actually being considered: reading at
// import time would make every consumer of this module depend on a readable
// Chia config. Memoize caches returns but not throws, so an unreadable config
// is retried on the next run instead of pinning the coin size for the life of
// the process.
const readCoinSize = _.memoize(() => {
  const rawSpamAmount = _.get(getChiaConfig(), 'wallet.xch_spam_amount');
  const coinSize = resolveCoinSize(rawSpamAmount);

  logger.info(
    `[COIN_MANAGEMENT] Creating coins of ${coinSize} mojos (configured wallet.xch_spam_amount: ${rawSpamAmount ?? 'unset'})`,
  );

  return coinSize;
});

export const getCoinSize = () => {
  try {
    return readCoinSize();
  } catch (error) {
    const message =
      `[COIN_MANAGEMENT] Could not read chia config for wallet.xch_spam_amount ` +
      `(${error.message}); assuming the chia default of ${CHIA_DEFAULT_XCH_SPAM_AMOUNT} mojos.`;
    // A CADT host with no local chia node is supported, so an absent config is
    // routine; one that exists but cannot be read is worth an operator's time.
    if (error.code === 'ENOENT') {
      logger.debug(message);
    } else {
      logger.warn(message);
    }

    return resolveCoinSize(undefined);
  }
};

// The same handle every other memoized reader in the codebase exposes, so tests
// can drop a cached read after repointing CHIA_ROOT.
getCoinSize.cache = readCoinSize.cache;

// Exported flag so other tasks (mirror check, etc.) can avoid operating
// while a coin split has temporarily reduced the wallet's spendable balance.
let splitInProgress = false;

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

  logger.info(`[COIN_MANAGEMENT] Waiting for split transaction to confirm (expecting ${expectedNewCoins} new coins of ${MIN_USABLE_COIN_SIZE}+ mojos)...`);

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
      const usableCoins = unspentCoins.filter((coin) => coin.amount >= MIN_USABLE_COIN_SIZE);

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
 * Execute a coin split and wait for confirmation, setting the splitInProgress
 * flag so other tasks know the wallet balance is temporarily reduced.
 */
const executeSplit = async (coinId, numberOfCoins) => {
  const coinSize = getCoinSize();
  logger.info(`[COIN_MANAGEMENT] Splitting coin ${coinId} into ${numberOfCoins} new coins of ${coinSize} mojos each (fee: ${SPLIT_FEE} mojos)`);

  splitInProgress = true;
  try {
    const splitResult = await wallet.splitCoins(coinId, numberOfCoins, coinSize, SPLIT_FEE);

    if (splitResult.success) {
      logger.info(`[COIN_MANAGEMENT] Successfully initiated coin split. Waiting for ${numberOfCoins} new coins of ${coinSize} mojos to confirm...`);
      const confirmed = await waitForSplitConfirmation(numberOfCoins, coinId);
      if (!confirmed) {
        logger.warn('[COIN_MANAGEMENT] Split transaction may still be pending. Coins will be available once confirmed.');
      }
    } else {
      logger.error(`[COIN_MANAGEMENT] Failed to split coins: ${splitResult.error}`);
    }
  } finally {
    splitInProgress = false;
  }
};

/**
 * Check wallet coin count and split if necessary.
 * Creates coins sized at DEFAULT_COIN_AMOUNT + DEFAULT_FEE so each coin can
 * independently fund one DataLayer operation (mirror, store creation, etc.).
 * Will create as many coins as the wallet can afford, up to TARGET_COIN_COUNT.
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
    const usableCoins = unspentCoins.filter((coin) => coin.amount >= MIN_USABLE_COIN_SIZE);
    const coinCount = usableCoins.length;

    logger.info(`[COIN_MANAGEMENT] Current usable coin count: ${coinCount} (of ${unspentCoins.length} total unspent)`);

    // If we have enough usable coins, no action needed
    if (coinCount >= TARGET_COIN_COUNT) {
      logger.info(`[COIN_MANAGEMENT] Wallet has ${coinCount} usable coins (${MIN_USABLE_COIN_SIZE}+ mojos each), which meets the target of ${TARGET_COIN_COUNT}. No action needed.`);
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
    const syncStatus = await wallet.getWalletBlockchainSyncStatus();
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
    const coinSize = getCoinSize();
    const coinsNeeded = TARGET_COIN_COUNT - coinCount;
    const requiredAmount = (coinsNeeded * coinSize) + SPLIT_FEE;

    // Check if we have enough mojos in the largest coin
    if (largestCoinAmount < requiredAmount) {
      const currencySymbol = await getCurrencySymbol();
      const maxPossibleCoins = Math.floor((largestCoinAmount - SPLIT_FEE) / coinSize);

      if (maxPossibleCoins < 1) {
        logger.warn(
          `[COIN_MANAGEMENT] WARNING: Largest coin (${formatMojos(largestCoinAmount, currencySymbol)}) is too small to split. ` +
          `Need at least ${formatMojos(coinSize + SPLIT_FEE, currencySymbol)} to create one ${coinSize} mojo coin.`
        );
        return;
      }

      // Verify the remainder (change) coin won't be below the coin size, which
      // would leave dust the wallet may hide.
      const totalSplitAmount = (maxPossibleCoins * coinSize) + SPLIT_FEE;
      const remainderAmount = largestCoinAmount - totalSplitAmount;
      let adjustedCoins = maxPossibleCoins;
      if (remainderAmount > 0 && remainderAmount < coinSize) {
        adjustedCoins = maxPossibleCoins - 1;
        if (adjustedCoins < 1) {
          logger.warn(
            `[COIN_MANAGEMENT] WARNING: Cannot split without creating a remainder coin below ${coinSize} mojos ` +
            `(remainder would be ${remainderAmount} mojos). Aborting split.`
          );
          return;
        }
        logger.warn(
          `[COIN_MANAGEMENT] Reducing split from ${maxPossibleCoins} to ${adjustedCoins} coins to avoid ` +
          `creating a remainder below ${coinSize} mojos.`
        );
      }

      logger.warn(
        `[COIN_MANAGEMENT] WARNING: Insufficient balance to create ${coinsNeeded} coins. ` +
        `Need ${formatMojos(requiredAmount, currencySymbol)} but largest coin only has ${formatMojos(largestCoinAmount, currencySymbol)}. ` +
        `Creating ${adjustedCoins} coins instead.`
      );

      await executeSplit(coinId, adjustedCoins);
      return;
    }

    // We have enough - check that the remainder won't be below the coin size
    const totalSplitAmount = (coinsNeeded * coinSize) + SPLIT_FEE;
    const remainderAmount = largestCoinAmount - totalSplitAmount;
    let actualCoinsToCreate = coinsNeeded;

    if (remainderAmount > 0 && remainderAmount < coinSize) {
      actualCoinsToCreate = coinsNeeded - 1;
      if (actualCoinsToCreate < 1) {
        logger.warn(
          `[COIN_MANAGEMENT] WARNING: Cannot split without creating a remainder coin below ${coinSize} mojos. Aborting split.`
        );
        return;
      }
      logger.warn(
        `[COIN_MANAGEMENT] Reducing split from ${coinsNeeded} to ${actualCoinsToCreate} coins to avoid ` +
        `creating a remainder below ${coinSize} mojos.`
      );
    }

    await executeSplit(coinId, actualCoinsToCreate);

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

// Export runCoinManagement for direct invocation during startup.
// splitInProgress is exported as a getter so consumers always read the live value.
const isSplitInProgress = () => splitInProgress;
export { runCoinManagement, isSplitInProgress };
export default job;
