import { expect } from 'chai';
import sinon from 'sinon';
import superagent from 'superagent';
import fs from 'fs';

import '../../../src/datalayer/index.js';
import wallet from '../../../src/datalayer/wallet.js';
import { getWalletHealthResponse } from '../../../src/routes/wallet-health.js';

function createSuperagentMock(responseBody) {
  const responseObj = { body: responseBody, text: JSON.stringify(responseBody) };
  const chain = {
    key: sinon.stub().callsFake(function () { return this; }),
    cert: sinon.stub().callsFake(function () { return this; }),
    timeout: sinon.stub().callsFake(function () { return this; }),
    send: sinon.stub().callsFake(function () { return this; }),
    then: function (resolve) { return Promise.resolve(responseObj).then(resolve); },
  };
  return chain;
}

describe('Transaction Health Monitoring', function () {
  this.timeout(30000);

  let superagentPostStub;
  let fsReadFileSyncStub;

  beforeEach(function () {
    wallet.__test_resetDLWalletCache();
    fsReadFileSyncStub = sinon.stub(fs, 'readFileSync').returns(Buffer.from('fake-cert'));
    superagentPostStub = sinon.stub(superagent, 'post');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('getTransactionHealth', function () {
    it('should classify transactions as rejected when all peers FAILED', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_rejected_1',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 600,
            sent_to: [
              ['peer1', 3, 'INVALID_SPEND_BUNDLE'],
              ['peer2', 3, 'INVALID_SPEND_BUNDLE'],
            ],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('2');

      expect(health.rejected).to.have.lengthOf(1);
      expect(health.rejected[0].name).to.equal('0xtx_rejected_1');
      expect(health.rejected[0].rejectionReason).to.include('FAILED');
      expect(health.inMempool).to.have.lengthOf(0);
      expect(health.pending).to.have.lengthOf(0);
    });

    it('should classify transactions as in_mempool when any peer returned SUCCESS', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_mempool_1',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 30,
            sent_to: [
              ['peer1', 1, null],
              ['peer2', 2, null],
            ],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('2');

      expect(health.inMempool).to.have.lengthOf(1);
      expect(health.inMempool[0].name).to.equal('0xtx_mempool_1');
      expect(health.rejected).to.have.lengthOf(0);
    });

    it('should classify transactions as pending when only PENDING status', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_pending_1',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 10,
            sent_to: [
              ['peer1', 2, null],
            ],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('2');

      expect(health.pending).to.have.lengthOf(1);
      expect(health.pending[0].name).to.equal('0xtx_pending_1');
    });

    it('should classify transactions as pending when sent_to is empty', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_new',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000),
            sent_to: [],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('2');

      expect(health.pending).to.have.lengthOf(1);
    });

    it('should filter out confirmed transactions', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: true,
            name: '0xtx_confirmed',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 3600,
            sent_to: [['peer1', 1, null]],
          },
          {
            confirmed: false,
            name: '0xtx_unconfirmed',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 60,
            sent_to: [['peer1', 1, null]],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('1');

      const totalUnconfirmed = health.rejected.length + health.inMempool.length + health.pending.length;
      expect(totalUnconfirmed).to.equal(1);
      expect(health.inMempool[0].name).to.equal('0xtx_unconfirmed');
    });

    it('should calculate stuckCount for txs older than 10 minutes', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_stuck',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 900,
            sent_to: [['peer1', 2, null]],
          },
          {
            confirmed: false,
            name: '0xtx_fresh',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 30,
            sent_to: [['peer1', 2, null]],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('1');

      expect(health.stuckCount).to.equal(1);
    });

    it('should track oldestUnconfirmedAge', async function () {
      const now = Math.floor(Date.now() / 1000);
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_old',
            type: 1,
            amount: 3000,
            created_at_time: now - 1200,
            sent_to: [['peer1', 1, null]],
          },
          {
            confirmed: false,
            name: '0xtx_new',
            type: 1,
            amount: 3000,
            created_at_time: now - 60,
            sent_to: [['peer1', 1, null]],
          },
        ],
      }));

      const health = await wallet.getTransactionHealth('1');

      expect(health.oldestUnconfirmedAge).to.be.at.least(1190);
      expect(health.oldestUnconfirmedAge).to.be.at.most(1210);
    });
  });

  describe('clearRejectedTransactions', function () {
    it('should refuse to clear when non-rejected txs exist', async function () {
      // First call: getTransactionHealth (inside clearRejectedTransactions)
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_rejected',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 300,
            sent_to: [['peer1', 3, 'INVALID']],
          },
          {
            confirmed: false,
            name: '0xtx_in_mempool',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 60,
            sent_to: [['peer1', 1, null]],
          },
        ],
      }));

      const result = await wallet.clearRejectedTransactions(
        '2',
        ['0xtx_rejected'],
        'test context',
      );

      expect(result.cleared).to.be.false;
      expect(result.reason).to.include('Refusing to clear');
      expect(result.reason).to.include('in-mempool');
    });

    it('should clear when ALL unconfirmed txs are rejected', async function () {
      const healthResponse = {
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_rejected_1',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 600,
            sent_to: [['peer1', 3, 'INVALID_SPEND_BUNDLE']],
          },
          {
            confirmed: false,
            name: '0xtx_rejected_2',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 500,
            sent_to: [['peer1', 3, 'DOUBLE_SPEND']],
          },
        ],
      };
      const deleteResponse = { success: true };

      // First call is get_transactions, second is delete_unconfirmed_transactions
      superagentPostStub.onFirstCall().returns(createSuperagentMock(healthResponse));
      superagentPostStub.onSecondCall().returns(createSuperagentMock(deleteResponse));

      const result = await wallet.clearRejectedTransactions(
        '2',
        ['0xtx_rejected_1'],
        'test: clearing rejected for retry',
      );

      expect(result.cleared).to.be.true;
      expect(result.reason).to.include('Cleared 2 rejected');
    });

    it('should return not-cleared when no rejected transactions exist', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [],
      }));

      const result = await wallet.clearRejectedTransactions(
        '2',
        ['0xtx_nonexistent'],
        'test context',
      );

      expect(result.cleared).to.be.false;
      expect(result.reason).to.include('No rejected transactions');
    });

    it('should produce a warn-level audit log when clearing', async function () {
      const healthResponse = {
        success: true,
        transactions: [
          {
            confirmed: false,
            name: '0xtx_rejected',
            type: 1,
            amount: 3000,
            created_at_time: Math.floor(Date.now() / 1000) - 300,
            sent_to: [['peer1', 3, 'INVALID_SPEND_BUNDLE']],
          },
        ],
      };

      superagentPostStub.onFirstCall().returns(createSuperagentMock(healthResponse));
      superagentPostStub.onSecondCall().returns(createSuperagentMock({ success: true }));

      const result = await wallet.clearRejectedTransactions(
        '2',
        ['0xtx_rejected'],
        'audit log test context',
      );

      // Verify the clear succeeded (the audit log is produced by logger.warn internally)
      expect(result.cleared).to.be.true;
      expect(result.reason).to.include('Cleared 1 rejected');
    });
  });

  describe('getDLWalletId', function () {
    it('should return "2" in simulator mode', async function () {
      const walletId = await wallet.getDLWalletId();
      expect(walletId).to.equal('2');
    });
  });

  describe('findDLWalletInResponse', function () {
    it('should match type 11 (WalletType.DATA_LAYER from chia-blockchain)', function () {
      const result = wallet.findDLWalletInResponse({
        success: true,
        wallets: [
          { id: 1, type: 0, name: 'Chia Wallet' },
          { id: 2, type: 11, name: 'DataLayer Wallet' },
        ],
      });
      expect(result).to.equal('2');
    });

    it('should use the CHIA_WALLET_TYPE_DATA_LAYER constant equal to 11', function () {
      expect(wallet.CHIA_WALLET_TYPE_DATA_LAYER).to.equal(11);
    });

    it('should return null when no wallet has DATA_LAYER type', function () {
      const result = wallet.findDLWalletInResponse({
        success: true,
        wallets: [
          { id: 1, type: 0, name: 'Chia Wallet' },
          { id: 3, type: 6, name: 'CAT Wallet' },
          { id: 4, type: 10, name: 'NFT Wallet' },
        ],
      });
      expect(result).to.be.null;
    });

    it('should not match adjacent WalletType values (type 10, 12, 13)', function () {
      const result = wallet.findDLWalletInResponse({
        success: true,
        wallets: [
          { id: 1, type: 0, name: 'Chia Wallet' },
          { id: 2, type: 10, name: 'NFT Wallet' },
          { id: 3, type: 12, name: 'DataLayer Offer Wallet' },
          { id: 4, type: 13, name: 'VC Wallet' },
        ],
      });
      expect(result).to.be.null;
    });

    it('should return null on unsuccessful response', function () {
      const result = wallet.findDLWalletInResponse({
        success: false,
        wallets: [{ id: 2, type: 11, name: 'DataLayer Wallet' }],
      });
      expect(result).to.be.null;
    });

    it('should return null when wallets array is missing', function () {
      const result = wallet.findDLWalletInResponse({ success: true });
      expect(result).to.be.null;
    });
  });

  describe('hasUnconfirmedTransactions', function () {
    it('should accept optional walletId parameter', async function () {
      superagentPostStub.returns(createSuperagentMock({
        success: true,
        transactions: [
          { confirmed: false, name: 'tx1' },
        ],
      }));

      const result = await wallet.hasUnconfirmedTransactions('2');
      expect(result).to.be.true;

      // Verify the wallet_id was sent in the request
      const sendCall = superagentPostStub.returnValues[0].send;
      expect(sendCall.calledOnce).to.be.true;
      const sentData = sendCall.firstCall.args[0];
      expect(sentData.wallet_id).to.equal('2');
    });
  });

  describe('formatDuration', function () {
    it('should format seconds correctly', function () {
      expect(wallet.formatDuration(0)).to.equal('0s');
      expect(wallet.formatDuration(45)).to.equal('45s');
      expect(wallet.formatDuration(60)).to.equal('1m 0s');
      expect(wallet.formatDuration(754)).to.equal('12m 34s');
      expect(wallet.formatDuration(null)).to.equal('unknown');
      expect(wallet.formatDuration(undefined)).to.equal('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // Wallet health endpoint response shaping (getWalletHealthResponse)
  //
  // SECURITY INTENT: Public observer nodes (READ_ONLY=true, no API key) must
  // never expose transaction IDs, wallet IDs, peer details, or rejection
  // reasons through the /health/wallet endpoint. These tests exist to prevent
  // accidental exposure if the response format is changed in the future.
  // ---------------------------------------------------------------------------
  describe('getWalletHealthResponse', function () {
    const FULL_TX_ID = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    function createMockWallet({ synced = true, hasTransactions = true } = {}) {
      return {
        walletIsSynced: sinon.stub().resolves(synced),
        getDLWalletId: sinon.stub().resolves('2'),
        formatDuration: wallet.formatDuration,
        getTransactionHealth: sinon.stub().resolves(
          hasTransactions
            ? {
              rejected: [
                {
                  name: FULL_TX_ID,
                  age: 600,
                  rejectionReason: 'FAILED on 1/1 peers: peer abc123...: INVALID_SPEND_BUNDLE',
                },
              ],
              inMempool: [
                { name: '0x1111111111222222222233333333334444444444555555555566666666667777', age: 30 },
              ],
              pending: [],
              stuckCount: 0,
              oldestUnconfirmedAge: 600,
            }
            : { rejected: [], inMempool: [], pending: [], stuckCount: 0, oldestUnconfirmedAge: 0 },
        ),
      };
    }

    describe('read-only mode (public observer node protection)', function () {
      it('should return ONLY synced status and timestamp when readOnly=true', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet, { readOnly: true });

        expect(result).to.have.property('synced', true);
        expect(result).to.have.property('timestamp').that.is.a('string');
        expect(result).to.have.property('readOnly', true);
        expect(result).to.have.property('message').that.includes('not available');
      });

      it('should NOT contain standardWallet in read-only mode', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet, { readOnly: true });

        expect(result).to.not.have.property('standardWallet');
      });

      it('should NOT contain dataLayerWallet in read-only mode', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet, { readOnly: true });

        expect(result).to.not.have.property('dataLayerWallet');
      });

      it('should NOT contain any transaction IDs in read-only mode', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet, { readOnly: true });

        const serialized = JSON.stringify(result);
        expect(serialized).to.not.include('0x');
        expect(serialized).to.not.include('txId');
        expect(serialized).to.not.include('walletId');
        expect(serialized).to.not.include('rejected');
        expect(serialized).to.not.include('stuck');
        expect(serialized).to.not.include('unconfirmedCount');
      });

      it('should NOT call getTransactionHealth in read-only mode', async function () {
        const mockWallet = createMockWallet();
        await getWalletHealthResponse(mockWallet, { readOnly: true });

        expect(mockWallet.getTransactionHealth.called).to.be.false;
        expect(mockWallet.getDLWalletId.called).to.be.false;
      });

      it('should still report synced=false when wallet is unreachable in read-only mode', async function () {
        const mockWallet = createMockWallet();
        mockWallet.walletIsSynced.rejects(new Error('connection refused'));

        const result = await getWalletHealthResponse(mockWallet, { readOnly: true });

        expect(result).to.have.property('synced', false);
        expect(result).to.have.property('readOnly', true);
        expect(result).to.not.have.property('standardWallet');
      });
    });

    describe('non-read-only mode (write node with API key)', function () {
      it('should return full wallet health details', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet);

        expect(result).to.have.property('synced', true);
        expect(result).to.have.property('timestamp');
        expect(result).to.not.have.property('readOnly');
        expect(result).to.have.property('standardWallet');
        expect(result).to.have.property('dataLayerWallet');
      });

      it('should include transaction counts and rejected/stuck arrays', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet);

        expect(result.standardWallet).to.have.property('unconfirmedCount').that.is.a('number');
        expect(result.standardWallet).to.have.property('rejected').that.is.an('array');
        expect(result.standardWallet).to.have.property('stuck').that.is.an('array');
        expect(result.dataLayerWallet).to.have.property('unconfirmedCount').that.is.a('number');
      });

      it('should truncate transaction IDs to prevent full hash exposure', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet);

        const serialized = JSON.stringify(result);

        expect(serialized).to.not.include(FULL_TX_ID);

        const rejectedTx = result.standardWallet.rejected[0];
        expect(rejectedTx.txId).to.have.lengthOf.at.most(17);
        expect(rejectedTx.txId).to.include('...');
        expect(rejectedTx.txId).to.match(/^0x.{8}\.\.\..{4}$/);
      });

      it('should include rejection reason and age for debugging', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet);

        const rejectedTx = result.standardWallet.rejected[0];
        expect(rejectedTx).to.have.property('error').that.includes('INVALID_SPEND_BUNDLE');
        expect(rejectedTx).to.have.property('age').that.is.a('string');
      });

      it('should default to readOnly=false when no options provided', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet);

        expect(result).to.have.property('standardWallet');
        expect(result).to.not.have.property('readOnly');
      });

      it('should report DataLayer wallet availability', async function () {
        const mockWallet = createMockWallet();
        const result = await getWalletHealthResponse(mockWallet);

        expect(result.dataLayerWallet).to.have.property('available', true);
        expect(result.dataLayerWallet).to.have.property('walletId', 2);
      });

      it('should gracefully handle wallet RPC failure for standard wallet', async function () {
        const mockWallet = createMockWallet();
        mockWallet.getTransactionHealth.rejects(new Error('RPC timeout'));

        const result = await getWalletHealthResponse(mockWallet);

        expect(result.standardWallet).to.have.property('error').that.is.a('string');
      });

      it('should gracefully handle DL wallet discovery failure', async function () {
        const mockWallet = createMockWallet();
        mockWallet.getDLWalletId.rejects(new Error('connection refused'));

        const result = await getWalletHealthResponse(mockWallet);

        expect(result.dataLayerWallet).to.have.property('error').that.is.a('string');
        expect(result.dataLayerWallet).to.have.property('available', false);
      });
    });
  });
});
