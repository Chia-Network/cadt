import { expect } from 'chai';
import { createStoreWithRetryBudget } from '../../../src/utils/store-creation-retry.js';
import {
  ORG_CREATION_CONFIG,
  getStoreCreationMinTotalMojos,
} from '../../../src/utils/organization-creation-state.js';
import wallet from '../../../src/datalayer/wallet.js';

const { isCoinShortageError, isTransientWalletError } = wallet;

// Real messages chia raises when coin selection cannot fund a spend
// (coin_selection.py and data_layer_wallet.py).
const SELECT_AMOUNT_ERROR =
  "Can't select amount higher than our spendable balance.  Amount: 3001, spendable: 0";
const MAX_BLOCK_BALANCE_ERROR =
  'Transaction for 3001 is greater than max spendable balance in a block of 0. ' +
  'There may be other transactions pending or our minimum coin amount is too high.';
const DL_SINGLETON_ERROR = 'Not enough coins to create new data layer singleton';

describe('Store creation retry budget', function () {
  this.timeout(30000);

  const savedConfig = {};

  before(function () {
    Object.assign(savedConfig, ORG_CREATION_CONFIG);
  });

  beforeEach(function () {
    // Fast budgets so boundary behavior is observable in test time.
    ORG_CREATION_CONFIG.STORE_CREATE_RETRY_DELAY_MS = 10;
    ORG_CREATION_CONFIG.STORE_CREATE_MAX_ATTEMPTS = 10;
    ORG_CREATION_CONFIG.COIN_SHORTAGE_RETRY_DEADLINE_MS = 5000;
  });

  afterEach(function () {
    Object.assign(ORG_CREATION_CONFIG, savedConfig);
  });

  const noopLog = () => {};
  const okPersist = async () => {};

  describe('coin shortage classification', function () {
    it('classifies the wallet coin-selection errors as coin shortages', function () {
      for (const message of [
        SELECT_AMOUNT_ERROR,
        MAX_BLOCK_BALANCE_ERROR,
        DL_SINGLETON_ERROR,
        'No spendable coins',
      ]) {
        expect(isCoinShortageError(new Error(message))).to.equal(true);
        expect(isTransientWalletError(new Error(message))).to.equal(true);
      }
    });

    it('does not classify unrelated errors as coin shortages', function () {
      for (const message of [
        'Wallet needs to be fully synced',
        'store creation was rejected by the network',
        'boom',
      ]) {
        expect(isCoinShortageError(new Error(message))).to.equal(false);
      }
    });
  });

  describe('sequential fallback', function () {
    it('serializes four parallel creations sharing a single coin', async function () {
      // One-coin wallet: a successful creation consumes the coin; its change
      // becomes spendable again after a simulated confirmation delay.
      let availableCoins = 1;
      let mintedCount = 0;
      let inFlight = 0;
      let maxInFlight = 0;
      const confirmationDelayMs = 50;

      const createStore = async () => {
        if (availableCoins < 1) {
          throw new Error(SELECT_AMOUNT_ERROR);
        }
        availableCoins -= 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        setTimeout(() => {
          availableCoins += 1;
          inFlight -= 1;
        }, confirmationDelayMs);
        mintedCount += 1;
        return `store-${mintedCount}`;
      };

      const storeTypes = ['orgUid', 'registry', 'dataModelVersion', 'fileStore'];
      const results = await Promise.all(
        storeTypes.map((storeType) =>
          createStoreWithRetryBudget(storeType, {
            createStore,
            persistStoreCreated: okPersist,
            log: noopLog,
          }),
        ),
      );

      expect(results.every((result) => result.success)).to.equal(true);
      const storeIds = results.map((result) => result.storeId);
      expect(new Set(storeIds).size).to.equal(4);
      expect(maxInFlight).to.equal(1);
    });

    it('retries coin shortages beyond the fixed attempt budget', async function () {
      let calls = 0;
      const failuresBeforeSuccess =
        ORG_CREATION_CONFIG.STORE_CREATE_MAX_ATTEMPTS + 5;

      const createStore = async () => {
        calls += 1;
        if (calls <= failuresBeforeSuccess) {
          throw new Error(MAX_BLOCK_BALANCE_ERROR);
        }
        return 'store-after-shortage';
      };

      const result = await createStoreWithRetryBudget('registry', {
        createStore,
        persistStoreCreated: okPersist,
        log: noopLog,
      });

      expect(result.success).to.equal(true);
      expect(result.storeId).to.equal('store-after-shortage');
      expect(calls).to.equal(failuresBeforeSuccess + 1);
    });

    it('fails once the coin-shortage deadline is exhausted', async function () {
      // Wide deadline/delay ratio so event-loop lag on a loaded runner
      // cannot flake the lower bound.
      ORG_CREATION_CONFIG.COIN_SHORTAGE_RETRY_DEADLINE_MS = 200;
      ORG_CREATION_CONFIG.STORE_CREATE_RETRY_DELAY_MS = 50;

      let calls = 0;
      const createStore = async () => {
        calls += 1;
        throw new Error(SELECT_AMOUNT_ERROR);
      };

      const result = await createStoreWithRetryBudget('registry', {
        createStore,
        persistStoreCreated: okPersist,
        log: noopLog,
      });

      expect(result.success).to.equal(false);
      expect(result.error).to.include("Can't select amount");
      // Slow confirmation past the deadline stops retrying instead of
      // spinning forever.
      expect(calls).to.be.at.least(2);
      expect(calls).to.be.at.most(5);
    });
  });

  describe('other error classes', function () {
    it('keeps the attempt budget for non-coin transient errors', async function () {
      ORG_CREATION_CONFIG.STORE_CREATE_MAX_ATTEMPTS = 3;

      let calls = 0;
      const createStore = async () => {
        calls += 1;
        throw new Error('Wallet needs to be fully synced');
      };

      const result = await createStoreWithRetryBudget('registry', {
        createStore,
        persistStoreCreated: okPersist,
        log: noopLog,
      });

      expect(result.success).to.equal(false);
      expect(calls).to.equal(3);
    });

    it('fails immediately when a rejection follows a shortage', async function () {
      let calls = 0;
      const createStore = async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error(SELECT_AMOUNT_ERROR);
        }
        throw new Error(
          'Store creation was rejected by the network: minting singleton failed',
        );
      };

      const result = await createStoreWithRetryBudget('registry', {
        createStore,
        persistStoreCreated: okPersist,
        log: noopLog,
      });

      expect(result.success).to.equal(false);
      expect(result.error).to.include('rejected by the network');
      expect(calls).to.equal(2);
    });

    it('fails immediately on non-transient errors', async function () {
      let calls = 0;
      const createStore = async () => {
        calls += 1;
        throw new Error('boom');
      };

      const result = await createStoreWithRetryBudget('registry', {
        createStore,
        persistStoreCreated: okPersist,
        log: noopLog,
      });

      expect(result.success).to.equal(false);
      expect(result.error).to.equal('boom');
      expect(calls).to.equal(1);
    });
  });

  describe('spendable coin sufficiency', function () {
    const { evaluateSpendableCoins, MIN_USABLE_COIN_SIZE } = wallet;
    const coin = (amount, spentHeight = 0) => ({
      amount,
      spent_height: spentHeight,
    });

    it('accepts a single large coin that can fund the whole batch', function () {
      const result = evaluateSpendableCoins(
        [coin(10 * MIN_USABLE_COIN_SIZE)],
        1,
        MIN_USABLE_COIN_SIZE,
        4 * MIN_USABLE_COIN_SIZE,
      );

      expect(result.sufficient).to.equal(true);
      expect(result.usableCoins).to.have.length(1);
    });

    it('rejects a single coin that passes the per-coin gate but cannot fund the batch', function () {
      const result = evaluateSpendableCoins(
        [coin(MIN_USABLE_COIN_SIZE + 100)],
        1,
        MIN_USABLE_COIN_SIZE,
        4 * MIN_USABLE_COIN_SIZE,
      );

      expect(result.sufficient).to.equal(false);
      expect(result.usableCoins).to.have.length(1);
      expect(result.totalBalance).to.equal(MIN_USABLE_COIN_SIZE + 100);
    });

    it('accepts several small coins whose combined balance funds the batch', function () {
      const coins = Array.from({ length: 4 }, () =>
        coin(MIN_USABLE_COIN_SIZE),
      );
      const result = evaluateSpendableCoins(
        coins,
        1,
        MIN_USABLE_COIN_SIZE,
        4 * MIN_USABLE_COIN_SIZE,
      );

      expect(result.sufficient).to.equal(true);
      expect(result.totalBalance).to.equal(4 * MIN_USABLE_COIN_SIZE);
    });

    it('ignores spent and undersized coins for both gates', function () {
      const result = evaluateSpendableCoins(
        [
          coin(10 * MIN_USABLE_COIN_SIZE, 12345), // spent
          coin(MIN_USABLE_COIN_SIZE - 1), // below per-coin minimum
          coin(MIN_USABLE_COIN_SIZE),
        ],
        1,
        MIN_USABLE_COIN_SIZE,
        0,
      );

      expect(result.sufficient).to.equal(true);
      expect(result.usableCoins).to.have.length(1);
      expect(result.totalBalance).to.equal(MIN_USABLE_COIN_SIZE);
    });

    it('defaults to no total requirement', function () {
      const result = evaluateSpendableCoins(
        [coin(MIN_USABLE_COIN_SIZE)],
        1,
        MIN_USABLE_COIN_SIZE,
      );

      expect(result.sufficient).to.equal(true);
    });

    it('budgets one spend per store when mirrors are not configured', function () {
      const result = getStoreCreationMinTotalMojos(
        ['orgUid', 'registry', 'dataModelVersion', 'fileStore'],
        MIN_USABLE_COIN_SIZE,
        { DATALAYER_FILE_SERVER_URL: null },
      );

      expect(result).to.equal(4 * MIN_USABLE_COIN_SIZE);
    });

    it('budgets store and mirror spends when mirror creation uses the wallet', function () {
      const result = getStoreCreationMinTotalMojos(
        ['orgUid', 'registry', 'dataModelVersion', 'fileStore'],
        MIN_USABLE_COIN_SIZE,
        { DATALAYER_FILE_SERVER_URL: 'https://mirror.example.com' },
      );

      expect(result).to.equal(8 * MIN_USABLE_COIN_SIZE);
    });

    it('does not reserve mirror spends in simulator or development mode', function () {
      for (const appConfig of [
        {
          DATALAYER_FILE_SERVER_URL: 'https://mirror.example.com',
          USE_SIMULATOR: true,
        },
        {
          DATALAYER_FILE_SERVER_URL: 'https://mirror.example.com',
          USE_DEVELOPMENT_MODE: true,
        },
      ]) {
        const result = getStoreCreationMinTotalMojos(
          ['orgUid', 'registry'],
          MIN_USABLE_COIN_SIZE,
          appConfig,
        );

        expect(result).to.equal(2 * MIN_USABLE_COIN_SIZE);
      }
    });
  });

  describe('persistence', function () {
    it('reports success with the store id even when the incremental persist fails', async function () {
      const warnings = [];

      const result = await createStoreWithRetryBudget('registry', {
        createStore: async () => 'store-persist-fail',
        persistStoreCreated: async () => {
          throw new Error('SQLITE_BUSY');
        },
        log: (message, level) => {
          if (level === 'warn') {
            warnings.push(message);
          }
        },
      });

      expect(result.success).to.equal(true);
      expect(result.storeId).to.equal('store-persist-fail');
      expect(warnings.some((msg) => msg.includes('final save will reconcile'))).to.equal(
        true,
      );
    });
  });
});
