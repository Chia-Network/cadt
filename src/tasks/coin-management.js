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
export const TARGET_COIN_COUNT = 15; // Refill to this many usable coins
export const LOW_WATER_MARK = 6; // Split only once usable coins fall below this
const SPLIT_FEE = APP_CONFIG.DEFAULT_FEE || 3000; // Fee from config, fallback to 3000 mojos
const DEFAULT_COIN_AMOUNT = APP_CONFIG.DEFAULT_COIN_AMOUNT || 300; // Coin amount for DataLayer operations from config
export const MIN_USABLE_COIN_SIZE = DEFAULT_COIN_AMOUNT + SPLIT_FEE; // A coin must cover both the operation amount and the fee to be usable
// Chia's own default when wallet.xch_spam_amount is absent from its config.
const CHIA_DEFAULT_XCH_SPAM_AMOUNT = 1_000_000;

const FIVE_MINUTES_IN_SECONDS = 5 * 60;
// After deferring to pending transactions for this long, escalate to a
// warning: something is probably stuck.
const PENDING_DEFERRAL_WARN_AFTER_MS = 30 * 60 * 1000;

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
  } catch {
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
 * Decide whether to split and how, given the wallet's current UTXO set.
 * Pure: all wallet I/O happens in the caller.
 *
 * @param {Object} args
 * @param {number} args.usableCount - Coins already large enough to fund an operation
 * @param {Array} args.unspentCoins - Every unspent coin, largest is the split source
 * @param {number} args.coinSize - Size of the coins to create, in mojos
 * @param {number} [args.threshold] - Split only once usable coins fall below this
 * @param {number} [args.target] - Refill to this many usable coins
 * @param {number} [args.splitFee] - Fee for the split transaction, in mojos
 * @returns {{action: 'none'|'split', reason?: string, coinId?: string, numberOfCoins?: number, coinsNeeded?: number, cappedBy?: 'affordability'|'change-coin'|null, largestAmount?: number}}
 */
export const planCoinSplit = ({
  usableCount,
  unspentCoins,
  coinSize,
  threshold = LOW_WATER_MARK,
  target = TARGET_COIN_COUNT,
  splitFee = SPLIT_FEE,
}) => {
  // Hysteresis: split only below the threshold, never merely below target.
  if (usableCount >= threshold) {
    return { action: 'none', reason: 'above-threshold' };
  }

  if (!unspentCoins.length) {
    return { action: 'none', reason: 'no-unspent-coins' };
  }

  const largestCoin = [...unspentCoins].sort(
    (a, b) => (b.amount || 0) - (a.amount || 0),
  )[0];
  const largestAmount = largestCoin.amount || 0;

  if (!largestCoin.id) {
    return { action: 'none', reason: 'no-coin-id', coin: largestCoin };
  }

  const coinsNeeded = Math.max(target, threshold) - usableCount;
  const affordableCoins = Math.floor((largestAmount - splitFee) / coinSize);
  let numberOfCoins = Math.min(coinsNeeded, affordableCoins);

  if (numberOfCoins < 1) {
    return { action: 'none', reason: 'largest-coin-too-small', largestAmount };
  }

  let cappedBy = numberOfCoins < coinsNeeded ? 'affordability' : null;

  // A change coin below the dust floor risks being swept up by the wallet's
  // spam filter, so give up one new coin to keep the remainder spendable.
  const remainder = largestAmount - (numberOfCoins * coinSize + splitFee);
  if (remainder > 0 && remainder < coinSize) {
    numberOfCoins -= 1;
    if (numberOfCoins < 1) {
      return { action: 'none', reason: 'remainder-too-small', largestAmount };
    }
    cappedBy = 'change-coin';
  } else if (numberOfCoins === 1 && remainder === 0) {
    // The source coin is already usable, so consuming it to mint one coin and
    // no change leaves the count where it started and burns the fee.
    return { action: 'none', reason: 'no-net-gain', largestAmount };
  }

  return {
    action: 'split',
    coinId: largestCoin.id,
    numberOfCoins,
    coinsNeeded,
    largestAmount,
    cappedBy,
  };
};

/**
 * Report the wallet ids coin management must find settled before splitting.
 * Store and mirror creation spend from the DataLayer wallet, so checking
 * wallet 1 alone would miss the transactions most likely to collide.
 * @returns {Promise<string[]>}
 */
const walletIdsToCheck = async () => {
  const dlWalletId = await wallet.getDLWalletId();

  return dlWalletId && dlWalletId !== '1' ? ['1', dlWalletId] : ['1'];
};

/**
 * Report whether either wallet holds transactions that still might confirm.
 * Coins committed to such a transaction still read as unspent in the coin
 * store, so splitting during that window targets a coin that is already spoken
 * for and the split is rejected as a double spend.
 *
 * Rejected transactions are excluded: the full node has refused them and they
 * will never confirm, so treating them as pending would stall splitting for
 * good. They are cleared first so they stop masking the wallet's real state.
 * @returns {Promise<boolean|null>} true/false, or null when the check failed
 */
const hasPendingTransactions = async () => {
  try {
    let settled = true;

    for (const walletId of await walletIdsToCheck()) {
      const health = await wallet.getTransactionHealth(walletId);

      if (health.inMempool.length > 0 || health.pending.length > 0) {
        settled = false;
        continue;
      }

      if (health.rejected.length > 0) {
        const txIds = health.rejected.map((transaction) => transaction.name);
        logger.warn(
          `[COIN_MANAGEMENT] Wallet ${walletId} holds ${txIds.length} rejected transaction(s) that will never confirm; clearing them so coin splitting can proceed.`,
        );
        const { cleared, reason } = await wallet.clearRejectedTransactions(
          walletId,
          txIds,
          'coin management: rejected transactions block coin splitting',
        );
        if (!cleared) {
          logger.warn(
            `[COIN_MANAGEMENT] Could not clear rejected transactions on wallet ${walletId}: ${reason}`,
          );
          settled = false;
        }
      }
    }

    return !settled;
  } catch (error) {
    logger.warn(
      `[COIN_MANAGEMENT] Could not check for unconfirmed transactions: ${error.message}`,
    );
    return null;
  }
};

/**
 * Submit a coin split and return. Confirmation is not awaited: the wallet is
 * the source of truth for the pending transaction, subsequent cycles defer to
 * it (via hasPendingTransactions), and consumers already poll for spendable
 * coins via wallet.waitForSpendableCoins.
 */
const executeSplit = async (coinId, numberOfCoins) => {
  const coinSize = getCoinSize();
  logger.info(
    `[COIN_MANAGEMENT] Splitting coin ${coinId} into ${numberOfCoins} new coins of ${coinSize} mojos each (fee: ${SPLIT_FEE} mojos)`,
  );

  const splitResult = await wallet.splitCoins(coinId, numberOfCoins, coinSize, SPLIT_FEE);

  if (!splitResult.success) {
    logger.error(`[COIN_MANAGEMENT] Failed to split coins: ${splitResult.error}`);
    return { split: false, reason: 'split-failed' };
  }

  logger.info(
    `[COIN_MANAGEMENT] Coin split submitted; the new coins become spendable once the transaction confirms.`,
  );
  return { split: true, numberOfCoins };
};

// Set while cycles are deferring to pending transactions, so a wallet that
// never settles escalates from routine info logs to a warning.
let pendingDeferralsSince = null;

/**
 * One coin management cycle. The healthy-wallet path is intentionally a single
 * RPC (get_coin_records over the live UTXO set); every other check runs only
 * when the usable coin count has fallen below LOW_WATER_MARK and a split is
 * actually on the table.
 */
const runCycle = async () => {
  // Skip in simulator mode
  if (APP_CONFIG.USE_SIMULATOR) {
    logger.debug('[COIN_MANAGEMENT] Simulator mode - skipping coin management');
    return { split: false, reason: 'simulator' };
  }

  const coinsResult = await wallet.getCoinRecords({ unspentOnly: true });

  if (!coinsResult.success) {
    logger.warn('[COIN_MANAGEMENT] Failed to get coin records');
    return { split: false, reason: 'coin-records-unavailable' };
  }

  // unspentOnly narrows the query server-side; the filter also guards against
  // older wallets that ignore the spent_range parameter.
  const unspentCoins = (coinsResult.coin_records || []).filter(
    (coin) => coin.spent_height === 0,
  );
  const usableCoins = unspentCoins.filter(
    (coin) => coin.amount >= MIN_USABLE_COIN_SIZE,
  );
  const usableCount = usableCoins.length;

  if (usableCount >= LOW_WATER_MARK) {
    pendingDeferralsSince = null;
    logger.debug(
      `[COIN_MANAGEMENT] ${usableCount} usable coins (${MIN_USABLE_COIN_SIZE}+ mojos each), at or above the low-water mark of ${LOW_WATER_MARK}. No action needed.`,
    );
    return { split: false, reason: 'above-threshold', usableCount };
  }

  logger.info(
    `[COIN_MANAGEMENT] Usable coin count ${usableCount} (of ${unspentCoins.length} unspent) is below the low-water mark of ${LOW_WATER_MARK}; evaluating split toward ${TARGET_COIN_COUNT}.`,
  );

  // Preconditions for actually submitting a transaction.
  await assertWalletIsSynced();
  await assertDataLayerAvailable();

  const plan = planCoinSplit({
    usableCount,
    unspentCoins,
    coinSize: getCoinSize(),
  });

  if (plan.action === 'none') {
    pendingDeferralsSince = null;
    const currencySymbol =
      plan.largestAmount === undefined ? null : await getCurrencySymbol();

    switch (plan.reason) {
      case 'no-unspent-coins':
        logger.warn('[COIN_MANAGEMENT] No unspent coins available in wallet');
        break;
      case 'no-coin-id':
        logger.error('[COIN_MANAGEMENT] Could not determine coin ID for the largest coin.');
        logger.debug(`[COIN_MANAGEMENT] Largest coin record: ${JSON.stringify(plan.coin)}`);
        break;
      case 'largest-coin-too-small':
        logger.warn(
          `[COIN_MANAGEMENT] Largest coin (${formatMojos(plan.largestAmount, currencySymbol)}) is too small to split. ` +
            `Need at least ${formatMojos(getCoinSize() + SPLIT_FEE, currencySymbol)} to create one ${getCoinSize()} mojo coin.`,
        );
        break;
      case 'remainder-too-small':
        logger.warn(
          `[COIN_MANAGEMENT] Cannot split ${formatMojos(plan.largestAmount, currencySymbol)} without leaving a ` +
            `remainder below ${getCoinSize()} mojos. Aborting split.`,
        );
        break;
      case 'no-net-gain':
        logger.debug(
          `[COIN_MANAGEMENT] Splitting the largest coin (${plan.largestAmount} mojos) would not add usable coins. No action taken.`,
        );
        break;
    }

    return { split: false, reason: plan.reason, usableCount };
  }

  // Defer while transactions might still confirm: their coins read as unspent,
  // so a split submitted now could double-spend them.
  const pending = await hasPendingTransactions();
  if (pending !== false) {
    if (pendingDeferralsSince === null) {
      pendingDeferralsSince = Date.now();
    }
    const blockedForMs = Date.now() - pendingDeferralsSince;
    const deferral =
      pending === null
        ? '[COIN_MANAGEMENT] Could not confirm the wallet is settled. Deferring split.'
        : '[COIN_MANAGEMENT] Wallet has unconfirmed transactions. Deferring split until they settle.';

    if (blockedForMs >= PENDING_DEFERRAL_WARN_AFTER_MS) {
      logger.warn(
        `${deferral} Blocked for ${Math.round(blockedForMs / 60000)}m; ` +
          `the wallet may have a stuck transaction blocking coin splits.`,
      );
    } else {
      logger.info(deferral);
    }

    return { split: false, reason: 'pending-transactions', usableCount };
  }

  pendingDeferralsSince = null;

  if (plan.cappedBy) {
    const currencySymbol = await getCurrencySymbol();
    const largest = formatMojos(plan.largestAmount, currencySymbol);
    logger.warn(
      plan.cappedBy === 'change-coin'
        ? `[COIN_MANAGEMENT] Largest coin (${largest}) cannot fund ${plan.coinsNeeded} coins while ` +
            `leaving a change coin of at least ${getCoinSize()} mojos. Creating ${plan.numberOfCoins} coins instead.`
        : `[COIN_MANAGEMENT] Largest coin (${largest}) can only fund ${plan.numberOfCoins} of the ` +
            `${plan.coinsNeeded} coins needed. Fund the wallet to reach the target of ${TARGET_COIN_COUNT} coins.`,
    );
  }

  return executeSplit(plan.coinId, plan.numberOfCoins);
};

// Serializes cycles across the scheduler, the startup run, and tests. Errors
// are contained inside each link, so the chain itself never rejects.
let runChain = Promise.resolve();

/**
 * Run one coin management cycle, serialized behind any cycle already running.
 * @returns {Promise<{split: boolean, reason?: string, usableCount?: number}>}
 */
const runCoinManagement = () => {
  const run = runChain.then(async () => {
    try {
      return await runCycle();
    } catch (error) {
      logger.error(`[COIN_MANAGEMENT] Error during coin management: ${error.message}`);
      logger.debug('[COIN_MANAGEMENT] Full error:', error);
      return { split: false, reason: 'error' };
    }
  });
  runChain = run;
  return run;
};

const task = new Task('coin-management', async () => {
  await runCoinManagement();
});

const job = new SimpleIntervalJob(
  {
    // Every 5 minutes by default - NOT immediately on startup (tasks/index.js
    // awaits runCoinManagement manually before starting other tasks)
    seconds: APP_CONFIG?.TASKS?.COIN_MANAGEMENT_TASK_INTERVAL || FIVE_MINUTES_IN_SECONDS,
    runImmediately: false,
  },
  task,
  { id: 'coin-management', preventOverrun: true },
);

// Export runCoinManagement for direct invocation during startup.
export { runCoinManagement };
export default job;
