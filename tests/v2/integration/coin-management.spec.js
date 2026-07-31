import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as yaml from 'js-yaml';
import coinManagementJob, {
  getCoinSize,
  resolveCoinSize,
  planCoinSplit,
  runCoinManagement,
  TARGET_COIN_COUNT,
  LOW_WATER_MARK,
  MIN_USABLE_COIN_SIZE,
} from '../../../src/tasks/coin-management.js';
import { getChiaConfig } from '../../../src/datalayer/fullNode.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';
import { getConfig } from '../../../src/utils/config-loader.js';
import wallet from '../../../src/datalayer/wallet.js';
import datalayer from '../../../src/datalayer/index.js';
import { checkWalletBalanceForMirror } from '../../../src/datalayer/persistance.js';

/**
 * Coin Management Task Tests
 *
 * Tests for the coin-management background task: a single periodic loop that
 * checks the usable coin count with one wallet RPC and, when the count falls
 * below LOW_WATER_MARK, splits the largest coin to refill toward
 * TARGET_COIN_COUNT. Splits are submit-and-forget; the wallet's own pending
 * transaction state defers subsequent cycles until the split confirms.
 */
describe('Coin Management Task Tests', function () {
  this.timeout(30000);

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(coinManagementJob).to.exist;
      expect(coinManagementJob.id).to.equal('coin-management');
    });

    it('exposes the standing pool thresholds', function () {
      expect(TARGET_COIN_COUNT).to.equal(15);
      expect(LOW_WATER_MARK).to.equal(6);
      expect(LOW_WATER_MARK).to.be.lessThan(TARGET_COIN_COUNT);
    });
  });

  describe('Coin Size Resolution', function () {
    const MIN_SIZE = 3300; // DEFAULT_COIN_AMOUNT 300 + DEFAULT_FEE 3000
    const CHIA_DEFAULT_SPAM_AMOUNT = 1_000_000;
    const silentLog = { warn: () => {} };

    const resolve = (rawSpamAmount) =>
      resolveCoinSize(rawSpamAmount, MIN_SIZE, silentLog);

    it('creates coins strictly above the dust filter floor, never equal to it', function () {
      // A coin exactly at xch_spam_amount is not reliably spendable, so the
      // floor must be cleared outright.
      expect(resolve(CHIA_DEFAULT_SPAM_AMOUNT)).to.equal(1_000_001);
      expect(resolve(CHIA_DEFAULT_SPAM_AMOUNT)).to.be.greaterThan(
        CHIA_DEFAULT_SPAM_AMOUNT,
      );
    });

    it('takes the floor from the chia config rather than a hardcoded value', function () {
      expect(resolve(5_000_000)).to.equal(5_000_001);
      expect(resolve(250)).to.be.greaterThan(250);
    });

    it('creates the smallest coin that clears the floor', function () {
      // Not merely "some coin above the floor": a wallet should not be carved
      // into more value per coin than an operation needs.
      for (const spamAmount of [1_000_000, 5_000_000, 42_000_000]) {
        expect(resolve(spamAmount), String(spamAmount)).to.equal(
          spamAmount + 1,
        );
      }
    });

    it('uses the operational minimum when it already clears the floor', function () {
      expect(resolve(100)).to.equal(MIN_SIZE);
      expect(resolve(100)).to.be.greaterThan(100);
    });

    it("falls back to chia's default when the config value is missing or unusable", function () {
      for (const unusable of [undefined, null, 'abc', -1, 1.5, true, {}]) {
        expect(resolve(unusable), String(unusable)).to.equal(1_000_001);
      }
    });

    it('accepts a quoted spam amount, as YAML can yield a string', function () {
      expect(resolve('5000000')).to.equal(5_000_001);
    });
  });

  // resolveCoinSize is pure; these cover the production path that actually
  // reaches chia's config file and decides how real coins are denominated.
  describe('Coin Size From Chia Config', function () {
    let testChiaRoot;
    let savedChiaRoot;

    // getCoinSize's own memo is left alone so a test can observe whether a
    // previous read was cached.
    const clearChiaConfigCaches = () => {
      getChiaRoot.cache?.clear();
      getChiaConfig.cache?.clear();
    };

    const writeChiaConfig = (config) => {
      const configDir = path.join(testChiaRoot, 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'config.yaml'),
        yaml.dump(config),
        'utf8',
      );
      clearChiaConfigCaches();
    };

    beforeEach(function () {
      testChiaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadt-coin-size-'));
      savedChiaRoot = process.env.CHIA_ROOT;
      process.env.CHIA_ROOT = testChiaRoot;
      clearChiaConfigCaches();
      getCoinSize.cache?.clear();
    });

    afterEach(function () {
      fs.rmSync(testChiaRoot, { recursive: true, force: true });
      // CHIA_ROOT is process-global and read by every module that resolves a
      // chia path, so restore rather than delete.
      if (savedChiaRoot === undefined) {
        delete process.env.CHIA_ROOT;
      } else {
        process.env.CHIA_ROOT = savedChiaRoot;
      }
      clearChiaConfigCaches();
      getCoinSize.cache?.clear();
    });

    it('sizes coins from wallet.xch_spam_amount in chia config', function () {
      writeChiaConfig({ wallet: { xch_spam_amount: 5_000_000 } });

      expect(getCoinSize()).to.equal(5_000_001);
    });

    it("assumes chia's default when there is no local chia config", function () {
      // The supported container deployments mount only the ssl and cadt
      // directories, so this is the common case rather than an error.
      expect(getCoinSize()).to.equal(1_000_001);
    });

    it("assumes chia's default when the config omits the wallet section", function () {
      writeChiaConfig({ full_node: { rpc_port: 8555 } });

      expect(getCoinSize()).to.equal(1_000_001);
    });

    it('picks up a config that only becomes readable later', function () {
      expect(getCoinSize()).to.equal(1_000_001);

      writeChiaConfig({ wallet: { xch_spam_amount: 5_000_000 } });

      expect(getCoinSize()).to.equal(5_000_001);
    });

    it('reads the config once', function () {
      writeChiaConfig({ wallet: { xch_spam_amount: 5_000_000 } });
      expect(getCoinSize()).to.equal(5_000_001);

      writeChiaConfig({ wallet: { xch_spam_amount: 9_000_000 } });

      expect(getCoinSize()).to.equal(5_000_001);
    });
  });

  describe('planCoinSplit', function () {
    const COIN_SIZE = 1_000_001;
    const SPLIT_FEE = 3000;

    const usableCoin = (id, amount = COIN_SIZE) => ({
      id,
      amount,
      spent_height: 0,
    });

    const plan = (overrides = {}) =>
      planCoinSplit({
        coinSize: COIN_SIZE,
        splitFee: SPLIT_FEE,
        ...overrides,
      });

    it('does nothing at or above the low-water mark (hysteresis)', function () {
      const unspentCoins = [usableCoin('0x1', 100_000_000)];

      for (const usableCount of [LOW_WATER_MARK, LOW_WATER_MARK + 1, TARGET_COIN_COUNT]) {
        const result = plan({ usableCount, unspentCoins });
        expect(result.action, String(usableCount)).to.equal('none');
        expect(result.reason, String(usableCount)).to.equal('above-threshold');
      }
    });

    it('refills to the target, not merely back to the threshold', function () {
      const result = plan({
        usableCount: LOW_WATER_MARK - 1,
        unspentCoins: [usableCoin('0xbig', 1_000_000_000)],
      });

      expect(result.action).to.equal('split');
      expect(result.coinId).to.equal('0xbig');
      expect(result.numberOfCoins).to.equal(
        TARGET_COIN_COUNT - (LOW_WATER_MARK - 1),
      );
      expect(result.cappedBy).to.equal(null);
    });

    it('splits the largest unspent coin', function () {
      const result = plan({
        usableCount: 0,
        unspentCoins: [
          usableCoin('0xsmall', 5_000_000),
          usableCoin('0xbig', 1_000_000_000),
          usableCoin('0xmid', 20_000_000),
        ],
      });

      expect(result.action).to.equal('split');
      expect(result.coinId).to.equal('0xbig');
    });

    it('reports an empty wallet', function () {
      const result = plan({ usableCount: 0, unspentCoins: [] });
      expect(result).to.deep.equal({
        action: 'none',
        reason: 'no-unspent-coins',
      });
    });

    it('caps the split to what the largest coin can afford', function () {
      // Can afford 3 coins plus fee; needs 15.
      const largest = 3 * COIN_SIZE + SPLIT_FEE;
      const result = plan({
        usableCount: 0,
        unspentCoins: [usableCoin('0xbig', largest)],
      });

      expect(result.action).to.equal('split');
      expect(result.numberOfCoins).to.equal(3);
      expect(result.coinsNeeded).to.equal(TARGET_COIN_COUNT);
      expect(result.cappedBy).to.equal('affordability');
    });

    it('declines when the largest coin cannot fund even one new coin', function () {
      const result = plan({
        usableCount: 1,
        unspentCoins: [usableCoin('0xtiny', COIN_SIZE)],
      });

      expect(result.action).to.equal('none');
      expect(result.reason).to.equal('largest-coin-too-small');
    });

    it('gives up one coin rather than leave sub-dust change', function () {
      // Affords 2 coins but the remainder would be dust the wallet may hide.
      const largest = 2 * COIN_SIZE + SPLIT_FEE + 500;
      const result = plan({
        usableCount: 0,
        unspentCoins: [usableCoin('0xbig', largest)],
      });

      expect(result.action).to.equal('split');
      expect(result.numberOfCoins).to.equal(1);
      expect(result.cappedBy).to.equal('change-coin');
    });

    it('declines a split that burns the fee for no net gain', function () {
      // Exactly one coin plus fee: consuming a usable coin to mint one coin
      // and no change leaves the count where it started.
      const result = plan({
        usableCount: 1,
        unspentCoins: [usableCoin('0xbig', COIN_SIZE + SPLIT_FEE)],
      });

      expect(result.action).to.equal('none');
      expect(result.reason).to.equal('no-net-gain');
    });

    it('honors a caller-provided threshold and target', function () {
      const result = plan({
        usableCount: 10,
        unspentCoins: [usableCoin('0xbig', 1_000_000_000)],
        threshold: 20,
        target: 20,
      });

      expect(result.action).to.equal('split');
      expect(result.numberOfCoins).to.equal(10);
    });
  });

  describe('Coin Management Cycle', function () {
    let sandbox;
    let appConfig;
    let savedUseSimulator;
    let testChiaRoot;
    let savedChiaRoot;

    const COIN_SIZE = 1_000_001;
    const SPLIT_FEE = 3000;

    const clearChiaConfigCaches = () => {
      getChiaRoot.cache?.clear();
      getChiaConfig.cache?.clear();
    };

    const settledHealth = { inMempool: [], pending: [], rejected: [] };

    const stubWallet = ({
      coins,
      health = settledHealth,
      splitResult = { success: true },
    }) => {
      const stubs = {
        getCoinRecords: sandbox
          .stub(wallet, 'getCoinRecords')
          .resolves({ success: true, coin_records: coins }),
        getTransactionHealth: sandbox
          .stub(wallet, 'getTransactionHealth')
          .resolves(health),
        getDLWalletId: sandbox.stub(wallet, 'getDLWalletId').resolves(null),
        clearRejectedTransactions: sandbox
          .stub(wallet, 'clearRejectedTransactions')
          .resolves({ cleared: true, reason: '' }),
        splitCoins: sandbox.stub(wallet, 'splitCoins').resolves(splitResult),
        getActiveNetwork: sandbox
          .stub(wallet, 'getActiveNetwork')
          .resolves({ network_name: 'testnet11' }),
        dataLayerAvailable: sandbox
          .stub(datalayer, 'dataLayerAvailable')
          .resolves(true),
      };
      return stubs;
    };

    const usableCoin = (id, amount = COIN_SIZE) => ({
      id,
      amount,
      spent_height: 0,
    });

    before(function () {
      appConfig = getConfig().APP;
    });

    beforeEach(function () {
      sandbox = sinon.createSandbox();

      // The cycle consults config at run time, so flipping the shared config
      // object exercises the non-simulator path.
      savedUseSimulator = appConfig.USE_SIMULATOR;
      appConfig.USE_SIMULATOR = false;

      // Pin the chia config so getCoinSize is deterministic.
      testChiaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadt-coin-cycle-'));
      savedChiaRoot = process.env.CHIA_ROOT;
      process.env.CHIA_ROOT = testChiaRoot;
      clearChiaConfigCaches();
      getCoinSize.cache?.clear();
    });

    afterEach(function () {
      sandbox.restore();
      appConfig.USE_SIMULATOR = savedUseSimulator;
      fs.rmSync(testChiaRoot, { recursive: true, force: true });
      if (savedChiaRoot === undefined) {
        delete process.env.CHIA_ROOT;
      } else {
        process.env.CHIA_ROOT = savedChiaRoot;
      }
      clearChiaConfigCaches();
      getCoinSize.cache?.clear();
    });

    it('skips entirely in simulator mode', async function () {
      appConfig.USE_SIMULATOR = true;
      const stubs = stubWallet({ coins: [] });

      const result = await runCoinManagement();

      expect(result).to.deep.equal({ split: false, reason: 'simulator' });
      expect(stubs.getCoinRecords.callCount).to.equal(0);
    });

    it('makes exactly one RPC when the wallet is healthy', async function () {
      const coins = Array.from({ length: LOW_WATER_MARK }, (unused, index) =>
        usableCoin(`0x${index}`),
      );
      const stubs = stubWallet({ coins });

      const result = await runCoinManagement();

      expect(result.split).to.equal(false);
      expect(result.reason).to.equal('above-threshold');
      expect(result.usableCount).to.equal(LOW_WATER_MARK);
      expect(
        stubs.getCoinRecords.calledOnceWithExactly({ unspentOnly: true }),
      ).to.equal(true);
      // The healthy path must stay a single RPC: no sync asserts, no
      // transaction queries, no split.
      expect(stubs.dataLayerAvailable.callCount).to.equal(0);
      expect(stubs.getTransactionHealth.callCount).to.equal(0);
      expect(stubs.splitCoins.callCount).to.equal(0);
    });

    it('splits the largest coin to refill toward the target and returns without waiting', async function () {
      const coins = [
        usableCoin('0xa', 2_000_000),
        usableCoin('0xb', 2_000_000),
        usableCoin('0xlargest', 100_000_000),
      ];
      const stubs = stubWallet({ coins });

      const result = await runCoinManagement();

      expect(result.split).to.equal(true);
      // usable = 3, so refill needs 12 more.
      expect(
        stubs.splitCoins.calledOnceWithExactly(
          '0xlargest',
          TARGET_COIN_COUNT - 3,
          COIN_SIZE,
          SPLIT_FEE,
        ),
      ).to.equal(true);
      // Submit-and-forget: no confirmation polling after the split.
      expect(stubs.getCoinRecords.callCount).to.equal(1);
    });

    it('defers the split while transactions are pending', async function () {
      const coins = [usableCoin('0xlargest', 100_000_000)];
      const stubs = stubWallet({
        coins,
        health: {
          inMempool: [{ name: '0xtx' }],
          pending: [],
          rejected: [],
        },
      });

      const result = await runCoinManagement();

      expect(result).to.deep.equal({
        split: false,
        reason: 'pending-transactions',
        usableCount: 1,
      });
      expect(stubs.splitCoins.callCount).to.equal(0);
    });

    it('clears rejected transactions and proceeds with the split', async function () {
      const coins = [usableCoin('0xlargest', 100_000_000)];
      const stubs = stubWallet({
        coins,
        health: {
          inMempool: [],
          pending: [],
          rejected: [{ name: '0xrejected' }],
        },
      });

      const result = await runCoinManagement();

      expect(
        stubs.clearRejectedTransactions.calledOnceWith('1', ['0xrejected']),
      ).to.equal(true);
      expect(result.split).to.equal(true);
      expect(stubs.splitCoins.callCount).to.equal(1);
    });

    it('defers when rejected transactions cannot be cleared', async function () {
      const coins = [usableCoin('0xlargest', 100_000_000)];
      const stubs = stubWallet({
        coins,
        health: {
          inMempool: [],
          pending: [],
          rejected: [{ name: '0xrejected' }],
        },
      });
      stubs.clearRejectedTransactions.resolves({
        cleared: false,
        reason: 'refused',
      });

      const result = await runCoinManagement();

      expect(result.reason).to.equal('pending-transactions');
      expect(stubs.splitCoins.callCount).to.equal(0);
    });

    it('reports a failed split submission', async function () {
      const coins = [usableCoin('0xlargest', 100_000_000)];
      stubWallet({ coins, splitResult: { success: false, error: 'boom' } });

      const result = await runCoinManagement();

      expect(result).to.deep.equal({ split: false, reason: 'split-failed' });
    });

    it('checks the DataLayer wallet for pending transactions too', async function () {
      const coins = [usableCoin('0xlargest', 100_000_000)];
      const stubs = stubWallet({ coins });
      stubs.getDLWalletId.resolves('3');

      await runCoinManagement();

      expect(stubs.getTransactionHealth.calledWith('1')).to.equal(true);
      expect(stubs.getTransactionHealth.calledWith('3')).to.equal(true);
    });

    it('contains cycle errors instead of rejecting', async function () {
      sandbox.stub(wallet, 'getCoinRecords').rejects(new Error('rpc down'));

      const result = await runCoinManagement();

      expect(result).to.deep.equal({ split: false, reason: 'error' });
    });

    it('serializes concurrent runs behind a mutex', async function () {
      let inFlight = 0;
      let maxInFlight = 0;

      sandbox.stub(wallet, 'getCoinRecords').callsFake(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((res) => setTimeout(res, 25));
        inFlight -= 1;
        return {
          success: true,
          coin_records: Array.from({ length: 10 }, (unused, index) =>
            usableCoin(`0x${index}`),
          ),
        };
      });

      const results = await Promise.all([
        runCoinManagement(),
        runCoinManagement(),
        runCoinManagement(),
      ]);

      expect(results.every((result) => result.reason === 'above-threshold')).to.equal(
        true,
      );
      expect(maxInFlight).to.equal(1);
    });
  });

  describe('Mirror Gate', function () {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.createSandbox();
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('allows mirror creation when the balance covers coin plus fee', async function () {
      sandbox.stub(wallet, 'getWalletBalance').resolves(1); // 1 XCH
      const unconfirmed = sandbox.stub(wallet, 'hasAnyUnconfirmedTransactions');

      const result = await checkWalletBalanceForMirror(2_000_000, 3000);

      expect(result.sufficient).to.equal(true);
      expect(result.fee).to.equal(3000);
      expect(unconfirmed.callCount).to.equal(0);
    });

    it('reports insufficient funds while unconfirmed transactions are settling', async function () {
      // 1_000_000 mojos on hand, 2_000_000 needed.
      sandbox.stub(wallet, 'getWalletBalance').resolves(0.000001);
      const unconfirmed = sandbox
        .stub(wallet, 'hasAnyUnconfirmedTransactions')
        .resolves(true);

      const result = await checkWalletBalanceForMirror(2_000_000, 3000);

      expect(result.sufficient).to.equal(false);
      expect(unconfirmed.callCount).to.equal(1);
    });

    it('reports insufficient funds when the wallet is simply short', async function () {
      sandbox.stub(wallet, 'getWalletBalance').resolves(0.000001);
      sandbox.stub(wallet, 'hasAnyUnconfirmedTransactions').resolves(false);

      const result = await checkWalletBalanceForMirror(2_000_000, 3000);

      expect(result.sufficient).to.equal(false);
    });
  });

  describe('Coin Records Request Shape', function () {
    it('queries only unspent coins when asked', function () {
      expect(wallet.buildCoinRecordsRequest({ unspentOnly: true })).to.deep.equal({
        wallet_id: 1,
        spent_range: { start: 0, stop: 0 },
      });
    });

    it('queries the full history by default', function () {
      expect(wallet.buildCoinRecordsRequest()).to.deep.equal({ wallet_id: 1 });
    });
  });

  describe('Usable Coin Definition', function () {
    it('requires a coin to cover one operation plus its fee', function () {
      // DEFAULT_COIN_AMOUNT 300 + DEFAULT_FEE 3000 under the test config.
      expect(MIN_USABLE_COIN_SIZE).to.equal(3300);
    });
  });
});
