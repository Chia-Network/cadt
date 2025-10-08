import { expect } from 'chai';
import sinon from 'sinon';

import datalayer from '../../src/datalayer';
import wallet from '../../src/datalayer/wallet';
import { logger } from '../../src/config/logger';

describe('Mirror Balance Check Tests', function () {
  let loggerSpy;
  let walletBalanceStub;

  beforeEach(function () {
    // Spy on logger to capture log messages
    loggerSpy = sinon.spy(logger, 'info');
    loggerSpy.warn = sinon.spy(logger, 'warn');
    loggerSpy.error = sinon.spy(logger, 'error');

    // Stub the wallet balance function
    walletBalanceStub = sinon.stub(wallet, 'getWalletBalance');
  });

  afterEach(function () {
    // Restore all stubs and spies
    sinon.restore();
  });

  describe('checkWalletBalanceForMirror', function () {
    it('should proceed with normal fee when balance is sufficient', async function () {
      // Mock sufficient balance: 1.5 XCH = 1,500,000,000,000 mojos
      walletBalanceStub.resolves(1.5);

      const coinAmount = 300000000000; // 0.3 XCH = 300 billion mojos
      const fee = 300000000000; // 0.3 XCH = 300 billion mojos
      const totalRequired = coinAmount + fee; // 0.6 XCH = 600 billion mojos

      const result = await datalayer.checkWalletBalanceForMirror(
        coinAmount,
        fee,
      );

      expect(result.sufficient).to.be.true;
      expect(result.fee).to.equal(fee);
      expect(result.balanceXCH).to.equal(1.5);

      // Verify log messages
      expect(
        loggerSpy.calledWith(`Wallet balance: 1.5 XCH (1500000000000 mojos)`),
      ).to.be.true;
      expect(
        loggerSpy.calledWith(
          `Required for mirror: ${coinAmount} mojos + ${fee} mojos = ${totalRequired} mojos`,
        ),
      ).to.be.true;
      expect(
        loggerSpy.calledWith(
          `Sufficient funds available for mirror creation with fee (balance: 1.5 XCH, 1500000000000 mojos, need: ${totalRequired} mojos)`,
        ),
      ).to.be.true;
    });

    it('should proceed with zero fee when balance covers amount but not fee', async function () {
      // Mock partial balance: 0.4 XCH = 400,000,000,000 mojos
      // This covers the coin amount (0.3 XCH = 300,000,000,000 mojos) but not the fee (0.3 XCH = 300,000,000,000 mojos)
      walletBalanceStub.resolves(0.4);

      const coinAmount = 300000000000; // 0.3 XCH = 300 billion mojos
      const fee = 300000000000; // 0.3 XCH = 300 billion mojos
      const totalRequired = coinAmount + fee; // 0.6 XCH = 600 billion mojos

      const result = await datalayer.checkWalletBalanceForMirror(
        coinAmount,
        fee,
      );

      expect(result.sufficient).to.be.true;
      expect(result.fee).to.equal(0);
      expect(result.balanceXCH).to.equal(0.4);

      // Verify log messages
      expect(
        loggerSpy.calledWith(`Wallet balance: 0.4 XCH (400000000000 mojos)`),
      ).to.be.true;
      expect(
        loggerSpy.calledWith(
          `Required for mirror: ${coinAmount} mojos + ${fee} mojos = ${totalRequired} mojos`,
        ),
      ).to.be.true;
      expect(
        loggerSpy.warn.calledWith(
          `Insufficient funds for fee, proceeding with zero fee (balance: 0.4 XCH, 400000000000 mojos, need: ${totalRequired} mojos)`,
        ),
      ).to.be.true;
    });

    it('should fail when balance is insufficient for even the coin amount', async function () {
      // Mock insufficient balance: 0.2 XCH = 200,000,000,000 mojos
      // This doesn't even cover the coin amount (0.3 XCH = 300,000,000,000 mojos)
      walletBalanceStub.resolves(0.2);

      const coinAmount = 300000000000; // 0.3 XCH = 300 billion mojos
      const fee = 300000000000; // 0.3 XCH = 300 billion mojos

      const result = await datalayer.checkWalletBalanceForMirror(
        coinAmount,
        fee,
      );

      expect(result.sufficient).to.be.false;
      expect(result.fee).to.equal(0);
      expect(result.balanceXCH).to.equal(0.2);

      // Verify log messages
      expect(
        loggerSpy.calledWith(`Wallet balance: 0.2 XCH (200000000000 mojos)`),
      ).to.be.true;
      expect(
        loggerSpy.calledWith(
          `Required for mirror: ${coinAmount} mojos + ${fee} mojos = ${coinAmount + fee} mojos`,
        ),
      ).to.be.true;
      expect(
        loggerSpy.error.calledWith(
          `Insufficient funds: need ${coinAmount} mojos, have 200000000000 mojos (balance: 0.2 XCH)`,
        ),
      ).to.be.true;
    });

    it('should handle simulator mode with string balance', async function () {
      // Mock simulator mode returning string balance
      walletBalanceStub.resolves('999.00');

      const coinAmount = 300000000000; // 0.3 XCH = 300 billion mojos
      const fee = 300000000000; // 0.3 XCH = 300 billion mojos

      const result = await datalayer.checkWalletBalanceForMirror(
        coinAmount,
        fee,
      );

      expect(result.sufficient).to.be.true;
      expect(result.fee).to.equal(fee);
      expect(result.balanceXCH).to.equal('999.00');

      // Verify log messages
      expect(
        loggerSpy.calledWith(
          `Wallet balance: 999.00 XCH (999000000000000 mojos)`,
        ),
      ).to.be.true;
      expect(
        loggerSpy.calledWith(
          `Sufficient funds available for mirror creation with fee (balance: 999.00 XCH, 999000000000000 mojos, need: ${coinAmount + fee} mojos)`,
        ),
      ).to.be.true;
    });

    it('should handle wallet balance check failure gracefully', async function () {
      // Mock wallet balance check failure
      walletBalanceStub.resolves(false);

      const coinAmount = 300000000000; // 0.3 XCH = 300 billion mojos
      const fee = 300000000000; // 0.3 XCH = 300 billion mojos

      const result = await datalayer.checkWalletBalanceForMirror(
        coinAmount,
        fee,
      );

      expect(result.sufficient).to.be.true;
      expect(result.fee).to.equal(fee);
      expect(result.balanceXCH).to.equal('unknown');

      // Verify warning log
      expect(
        loggerSpy.warn.calledWith(
          'Failed to retrieve wallet balance, proceeding with default fee',
        ),
      ).to.be.true;
    });

    it('should handle wallet balance check error gracefully', async function () {
      // Mock wallet balance check throwing an error
      walletBalanceStub.rejects(new Error('RPC connection failed'));

      const coinAmount = 300000000000; // 0.3 XCH = 300 billion mojos
      const fee = 300000000000; // 0.3 XCH = 300 billion mojos

      const result = await datalayer.checkWalletBalanceForMirror(
        coinAmount,
        fee,
      );

      expect(result.sufficient).to.be.true;
      expect(result.fee).to.equal(fee);
      expect(result.balanceXCH).to.equal('unknown');

      // Verify error handling logs
      expect(
        loggerSpy.error.calledWith(
          'Error checking wallet balance:',
          sinon.match.instanceOf(Error),
        ),
      ).to.be.true;
      expect(
        loggerSpy.warn.calledWith(
          'Proceeding with default fee due to balance check error',
        ),
      ).to.be.true;
    });
  });
});
