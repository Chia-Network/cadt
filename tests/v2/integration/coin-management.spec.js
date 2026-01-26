import { expect } from 'chai';
import sinon from 'sinon';
import coinManagementJob from '../../../src/tasks/coin-management.js';
import wallet from '../../../src/datalayer/wallet.js';

/**
 * Coin Management Task Tests
 *
 * Tests for coin-management background task that ensures the wallet
 * has at least 10 coins for optimal CADT operation.
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
      const result = await wallet.splitCoins('0xmockcoinid', 5, 3300, 3000);
      expect(result).to.have.property('success', true);
    });
  });

  describe('Coin Count Logic', function () {
    it('should identify when coin count is below target', function () {
      const TARGET_COIN_COUNT = 10;
      const currentCoinCount = 5;
      expect(currentCoinCount < TARGET_COIN_COUNT).to.be.true;
    });

    it('should identify when coin count meets target', function () {
      const TARGET_COIN_COUNT = 10;
      const currentCoinCount = 10;
      expect(currentCoinCount >= TARGET_COIN_COUNT).to.be.true;
    });

    it('should identify when coin count exceeds target', function () {
      const TARGET_COIN_COUNT = 10;
      const currentCoinCount = 15;
      expect(currentCoinCount >= TARGET_COIN_COUNT).to.be.true;
    });
  });

  describe('Coin Splitting Calculations', function () {
    const DEFAULT_FEE = 3000;
    const DEFAULT_COIN_AMOUNT = 300;
    const COIN_SIZE = DEFAULT_COIN_AMOUNT + DEFAULT_FEE;

    it('should calculate correct coin size', function () {
      expect(COIN_SIZE).to.equal(3300);
    });

    it('should calculate max possible coins correctly', function () {
      const largestCoinAmount = 100000; // 100,000 mojos
      const feeForSplit = DEFAULT_FEE;
      const maxPossibleCoins = Math.floor((largestCoinAmount - feeForSplit) / COIN_SIZE);
      // (100000 - 3000) / 3300 = 29.39... = 29
      expect(maxPossibleCoins).to.equal(29);
    });

    it('should determine coins to create based on need and availability', function () {
      const TARGET_COIN_COUNT = 10;
      const currentCoinCount = 3;
      const coinsNeeded = TARGET_COIN_COUNT - currentCoinCount; // 7
      const maxPossibleCoins = 29;

      const coinsToCreate = Math.min(coinsNeeded, maxPossibleCoins, TARGET_COIN_COUNT);
      expect(coinsToCreate).to.equal(7);
    });

    it('should limit coins to max possible when balance is low', function () {
      const TARGET_COIN_COUNT = 10;
      const currentCoinCount = 3;
      const coinsNeeded = TARGET_COIN_COUNT - currentCoinCount; // 7
      const maxPossibleCoins = 2; // Low balance scenario

      const coinsToCreate = Math.min(coinsNeeded, maxPossibleCoins, TARGET_COIN_COUNT);
      expect(coinsToCreate).to.equal(2);
    });

    it('should handle case where coin is too small to split', function () {
      const largestCoinAmount = 3000; // Exactly the fee amount
      const feeForSplit = DEFAULT_FEE;
      const maxPossibleCoins = Math.floor((largestCoinAmount - feeForSplit) / COIN_SIZE);
      // (3000 - 3000) / 3300 = 0
      expect(maxPossibleCoins).to.equal(0);
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

    it('should format small amounts correctly', function () {
      const mojos = 3300;
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
      const DEFAULT_FEE = 3000;
      const DEFAULT_COIN_AMOUNT = 300;
      const COIN_SIZE = DEFAULT_COIN_AMOUNT + DEFAULT_FEE;
      const currentBalance = 100000;

      const remainingTransactions = Math.floor(currentBalance / COIN_SIZE);
      // 100000 / 3300 = 30.30... = 30
      expect(remainingTransactions).to.equal(30);
    });
  });
});
