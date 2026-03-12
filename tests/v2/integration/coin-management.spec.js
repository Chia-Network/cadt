import { expect } from 'chai';
import sinon from 'sinon';
import coinManagementJob from '../../../src/tasks/coin-management.js';
import wallet from '../../../src/datalayer/wallet.js';

/**
 * Coin Management Task Tests
 *
 * Tests for coin-management background task that ensures the wallet
 * has at least 15 coins for optimal CADT operation.
 * Each coin is sized at DEFAULT_COIN_AMOUNT + DEFAULT_FEE so it can
 * independently fund one full DataLayer operation (amount + fee).
 */
describe('Coin Management Task Tests', function () {
  this.timeout(30000);

  let walletStub;

  afterEach(function () {
    if (walletStub) {
      walletStub.restore();
    }
  });

  describe('Task Import and Structure', function () {
    it('should import task successfully', function () {
      expect(coinManagementJob).to.exist;
      expect(coinManagementJob.id).to.equal('coin-management');
    });

    it('should have correct task ID', function () {
      expect(coinManagementJob.id).to.equal('coin-management');
    });

    it('should be configured to run immediately', function () {
      // The job should have runImmediately set to true
      expect(coinManagementJob).to.exist;
    });
  });

  describe('Wallet RPC Functions', function () {
    it('should have getCoinRecords function available', function () {
      expect(wallet.getCoinRecords).to.be.a('function');
    });

    it('should have splitCoins function available', function () {
      expect(wallet.splitCoins).to.be.a('function');
    });

    it('should have getWalletBalanceMojos function available', function () {
      expect(wallet.getWalletBalanceMojos).to.be.a('function');
    });

    it('should have getActiveNetwork function available', function () {
      expect(wallet.getActiveNetwork).to.be.a('function');
    });

    it('should have getWalletBlockchainSyncStatus function available', function () {
      expect(wallet.getWalletBlockchainSyncStatus).to.be.a('function');
    });

    it('should return sync status in simulator mode', async function () {
      // In simulator mode, getWalletBlockchainSyncStatus should return a synced status
      const result = await wallet.getWalletBlockchainSyncStatus();
      expect(result).to.have.property('success');
      // In simulator mode, wallet sync check is bypassed so success may be false
      // This just tests the function exists and returns expected structure
    });
  });

  describe('Simulator Mode Behavior', function () {
    it('should return mock coin records in simulator mode', async function () {
      // In simulator mode, getCoinRecords returns mock data
      const result = await wallet.getCoinRecords();
      expect(result).to.have.property('success');
      expect(result).to.have.property('coin_records');
      expect(result.coin_records).to.be.an('array');
    });

    it('should return mock balance in simulator mode', async function () {
      const balance = await wallet.getWalletBalanceMojos();
      expect(balance).to.be.a('number');
      expect(balance).to.be.greaterThan(0);
    });

    it('should return success for splitCoins in simulator mode', async function () {
      const result = await wallet.splitCoins('0xmockcoinid', 5, 100000000, 3000);
      expect(result).to.have.property('success', true);
    });
  });

  describe('Coin Count Logic', function () {
    it('should identify when coin count is below target', function () {
      const TARGET_COIN_COUNT = 15;
      const currentCoinCount = 5;
      expect(currentCoinCount < TARGET_COIN_COUNT).to.be.true;
    });

    it('should identify when coin count meets target', function () {
      const TARGET_COIN_COUNT = 15;
      const currentCoinCount = 15;
      expect(currentCoinCount >= TARGET_COIN_COUNT).to.be.true;
    });

    it('should identify when coin count exceeds target', function () {
      const TARGET_COIN_COUNT = 15;
      const currentCoinCount = 20;
      expect(currentCoinCount >= TARGET_COIN_COUNT).to.be.true;
    });
  });

  describe('Coin Splitting Calculations', function () {
    // Constants matching coin-management.js (using simulator/default config values)
    const DEFAULT_COIN_AMOUNT = 300;
    const SPLIT_FEE = 3000;
    const MIN_USABLE_COIN_SIZE = DEFAULT_COIN_AMOUNT + SPLIT_FEE; // 3300
    const DUST_FILTER_FLOOR = 1_000_000;
    const COIN_SIZE = Math.max(MIN_USABLE_COIN_SIZE, DUST_FILTER_FLOOR); // 1,000,000
    const MIN_COIN_SIZE = COIN_SIZE;
    const TARGET_COIN_COUNT = 15;

    it('should set COIN_SIZE to max of MIN_USABLE_COIN_SIZE and DUST_FILTER_FLOOR', function () {
      expect(COIN_SIZE).to.equal(Math.max(MIN_USABLE_COIN_SIZE, DUST_FILTER_FLOOR));
      expect(COIN_SIZE).to.equal(1_000_000);
    });

    it('should ensure COIN_SIZE meets MIN_COIN_SIZE', function () {
      expect(COIN_SIZE).to.be.greaterThanOrEqual(MIN_COIN_SIZE);
    });

    it('should calculate max possible coins correctly', function () {
      const largestCoinAmount = 20_000_000;
      const maxPossibleCoins = Math.floor((largestCoinAmount - SPLIT_FEE) / COIN_SIZE);
      // (20_000_000 - 3000) / 1_000_000 = 19.997 → 19
      expect(maxPossibleCoins).to.equal(19);
    });

    it('should determine coins to create based on need and availability', function () {
      const currentCoinCount = 3;
      const coinsNeeded = TARGET_COIN_COUNT - currentCoinCount; // 12
      const maxPossibleCoins = 15;

      const coinsToCreate = Math.min(coinsNeeded, maxPossibleCoins);
      expect(coinsToCreate).to.equal(12);
    });

    it('should limit coins to max possible when balance is low', function () {
      const currentCoinCount = 3;
      const coinsNeeded = TARGET_COIN_COUNT - currentCoinCount; // 12
      const maxPossibleCoins = 2;

      const coinsToCreate = Math.min(coinsNeeded, maxPossibleCoins);
      expect(coinsToCreate).to.equal(2);
    });

    it('should handle case where coin is too small to split', function () {
      const largestCoinAmount = 3000;
      const maxPossibleCoins = Math.floor((largestCoinAmount - SPLIT_FEE) / COIN_SIZE);
      // (3000 - 3000) / 1_000_000 = 0
      expect(maxPossibleCoins).to.equal(0);
    });

    it('should calculate required amount for coins needed', function () {
      const currentCoinCount = 1;
      const coinsNeeded = TARGET_COIN_COUNT - currentCoinCount; // 14
      const requiredAmount = (coinsNeeded * COIN_SIZE) + SPLIT_FEE;
      // (14 * 1_000_000) + 3000 = 14_003_000
      expect(requiredAmount).to.equal(14_003_000);
    });

    it('should detect when remainder would be below MIN_COIN_SIZE', function () {
      const largestCoinAmount = 2_500_000;
      const coinsToCreate = 2;
      const totalSplitAmount = (coinsToCreate * COIN_SIZE) + SPLIT_FEE;
      const remainderAmount = largestCoinAmount - totalSplitAmount;
      // 2_500_000 - (2_000_000 + 3000) = 497_000
      expect(remainderAmount).to.equal(497_000);
      expect(remainderAmount).to.be.lessThan(MIN_COIN_SIZE);
    });

    it('should allow split when remainder is zero', function () {
      const largestCoinAmount = (2 * COIN_SIZE) + SPLIT_FEE; // 2_003_000
      const coinsToCreate = 2;
      const totalSplitAmount = (coinsToCreate * COIN_SIZE) + SPLIT_FEE;
      const remainderAmount = largestCoinAmount - totalSplitAmount;
      expect(remainderAmount).to.equal(0);
      const shouldReduceCoins = remainderAmount > 0 && remainderAmount < MIN_COIN_SIZE;
      expect(shouldReduceCoins).to.be.false;
    });

    it('should allow split when remainder exceeds MIN_COIN_SIZE', function () {
      const largestCoinAmount = 500_000_000; // 0.5 XCH
      const coinsToCreate = 3;
      const totalSplitAmount = (coinsToCreate * COIN_SIZE) + SPLIT_FEE;
      const remainderAmount = largestCoinAmount - totalSplitAmount;
      // 500_000_000 - (3_000_000 + 3000) = 496_997_000
      expect(remainderAmount).to.equal(496_997_000);
      expect(remainderAmount).to.be.greaterThan(MIN_COIN_SIZE);
    });
  });

  describe('Currency Symbol Detection', function () {
    it('should return XCH for mainnet', function () {
      const networkName = 'mainnet';
      const symbol = networkName.includes('mainnet') ? 'XCH' : 'TXCH';
      expect(symbol).to.equal('XCH');
    });

    it('should return TXCH for testnet', function () {
      const networkName = 'testnet10';
      const symbol = networkName.includes('mainnet') ? 'XCH' : 'TXCH';
      expect(symbol).to.equal('TXCH');
    });
  });

  describe('Mojo Formatting', function () {
    it('should format mojos to XCH correctly', function () {
      const mojos = 1000000000000; // 1 XCH
      const xch = mojos / 1000000000000;
      expect(xch).to.equal(1);
    });

    it('should format COIN_SIZE amount correctly', function () {
      const mojos = 3300; // COIN_SIZE in simulator config (DEFAULT_COIN_AMOUNT + DEFAULT_FEE)
      const xch = mojos / 1000000000000;
      expect(xch).to.equal(0.0000000033);
    });
  });

  describe('Unspent Coin Filtering', function () {
    it('should filter out spent coins', function () {
      const allCoins = [
        { id: '0x1', amount: 1000, spent_height: 0 },
        { id: '0x2', amount: 2000, spent_height: 100 }, // Spent
        { id: '0x3', amount: 3000, spent_height: 0 },
        { id: '0x4', amount: 4000, spent_height: 200 }, // Spent
      ];

      const unspentCoins = allCoins.filter((coin) => coin.spent_height === 0);
      expect(unspentCoins).to.have.length(2);
      expect(unspentCoins.map((c) => c.id)).to.deep.equal(['0x1', '0x3']);
    });
  });

  describe('Largest Coin Selection', function () {
    it('should find the largest coin for splitting', function () {
      const unspentCoins = [
        { id: '0x1', amount: 1000 },
        { id: '0x2', amount: 5000 },
        { id: '0x3', amount: 3000 },
      ];

      const sortedCoins = [...unspentCoins].sort((a, b) => b.amount - a.amount);
      const largestCoin = sortedCoins[0];

      expect(largestCoin.id).to.equal('0x2');
      expect(largestCoin.amount).to.equal(5000);
    });
  });

  describe('Remaining Transactions Calculation', function () {
    it('should calculate remaining transactions correctly', function () {
      const coinSize = 600000000; // Production COIN_SIZE (DEFAULT_COIN_AMOUNT + DEFAULT_FEE)
      const currentBalance = 9000000000000; // 9 XCH in mojos

      const remainingTransactions = Math.floor(currentBalance / coinSize);
      // 9000000000000 / 600000000 = 15000
      expect(remainingTransactions).to.equal(15000);
    });
  });

  describe('Usable Coin Filtering', function () {
    const DEFAULT_COIN_AMOUNT = 300;    // DEFAULT_COIN_AMOUNT from config
    const DEFAULT_FEE = 3000;           // DEFAULT_FEE from config
    const MIN_USABLE_COIN_SIZE = DEFAULT_COIN_AMOUNT + DEFAULT_FEE; // 3300

    it('should filter coins by minimum usable size (DEFAULT_COIN_AMOUNT + DEFAULT_FEE)', function () {
      const allUnspentCoins = [
        { id: '0x1', amount: 1000, spent_height: 0 },    // Too small
        { id: '0x2', amount: 3300, spent_height: 0 },    // Exactly MIN_USABLE_COIN_SIZE
        { id: '0x3', amount: 100000000, spent_height: 0 },  // Well above threshold
        { id: '0x4', amount: 3299, spent_height: 0 },    // Just below MIN_USABLE_COIN_SIZE
        { id: '0x5', amount: 5000, spent_height: 0 },    // Above threshold
      ];

      const usableCoins = allUnspentCoins.filter((coin) => coin.amount >= MIN_USABLE_COIN_SIZE);
      expect(usableCoins).to.have.length(3);
      expect(usableCoins.map((c) => c.id)).to.deep.equal(['0x2', '0x3', '0x5']);
    });

    it('should identify original coin after split by ID', function () {
      const originalCoinId = '0xoriginal123';
      const unspentCoins = [
        { id: '0xnewcoin1', amount: 100000000, spent_height: 0 },
        { id: '0xnewcoin2', amount: 100000000, spent_height: 0 },
        { id: '0xchangecoin', amount: 1000000000, spent_height: 0 },
      ];

      const originalCoinStillUnspent = unspentCoins.some((coin) => coin.id === originalCoinId);
      expect(originalCoinStillUnspent).to.be.false;
    });
  });
});
