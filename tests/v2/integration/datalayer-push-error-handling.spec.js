import { expect } from 'chai';
import sinon from 'sinon';
import superagent from 'superagent';
import fs from 'fs';

// Import index first to resolve circular dependency in the correct order
// (persistance -> models -> datalayer/index -> persistance)
import '../../../src/datalayer/index.js';
import { pushChangeListToDataLayer } from '../../../src/datalayer/persistance.js';
import wallet from '../../../src/datalayer/wallet.js';

/**
 * Creates a chainable superagent mock that resolves with the given response body.
 * Mimics superagent's .post().key().cert().timeout().send() chain.
 */
function createSuperagentMock(responseBody) {
  const chain = {
    key: sinon.stub().returnsThis(),
    cert: sinon.stub().returnsThis(),
    timeout: sinon.stub().returnsThis(),
    send: sinon.stub().resolves({ body: responseBody }),
  };
  return chain;
}

describe('pushChangeListToDataLayer - error handling', function () {
  this.timeout(30000);

  let superagentPostStub;
  let walletWaitStub;
  let fsReadFileSyncStub;

  const testStoreId = 'abc123def456';
  const testChangelist = [
    { action: 'insert', key: '0xabc', value: '0xdef' },
  ];

  beforeEach(function () {
    // Stub wallet so it doesn't actually wait for transactions
    walletWaitStub = sinon.stub(wallet, 'waitForAllTransactionsToConfirm').resolves();

    // Stub fs.readFileSync so getBaseOptions() doesn't try to read real cert files
    fsReadFileSyncStub = sinon.stub(fs, 'readFileSync').returns(Buffer.from('fake-cert'));

    // Stub superagent.post to return our chainable mock
    superagentPostStub = sinon.stub(superagent, 'post');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should return true when datalayer responds with success', async function () {
    const mock = createSuperagentMock({ success: true });
    superagentPostStub.returns(mock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
  });

  it('should return true when datalayer responds with "Latest root is already confirmed"', async function () {
    const mock = createSuperagentMock({
      success: false,
      error: 'Latest root is already confirmed.',
      traceback: 'Traceback (most recent call last):\n  File "chia/data_layer/data_layer.py"...',
    });
    superagentPostStub.returns(mock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
  });

  it('should return true when datalayer responds with "Changelist resulted in no change to tree data"', async function () {
    const mock = createSuperagentMock({
      success: false,
      error: 'Changelist resulted in no change to tree data',
    });
    superagentPostStub.returns(mock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
  });

  it('should return false when datalayer responds with an unhandled error', async function () {
    const mock = createSuperagentMock({
      success: false,
      error: 'Some completely unknown error',
    });
    superagentPostStub.returns(mock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.false;
  });

  it('should return false when datalayer responds with "unknown key" error', async function () {
    const mock = createSuperagentMock({
      success: false,
      error: 'unknown key 0xabc',
    });
    superagentPostStub.returns(mock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.false;
  });

  it('should return false when the HTTP request throws an error', async function () {
    const mock = {
      key: sinon.stub().returnsThis(),
      cert: sinon.stub().returnsThis(),
      timeout: sinon.stub().returnsThis(),
      send: sinon.stub().rejects(new Error('ECONNREFUSED')),
    };
    superagentPostStub.returns(mock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.false;
  });

  it('should retry on "Already have a pending root" then succeed', async function () {
    this.timeout(60000);

    // First call: pending root error. Second call: success.
    const pendingMock = createSuperagentMock({
      success: false,
      error: 'Already have a pending root waiting for confirmation',
    });
    const successMock = createSuperagentMock({ success: true });

    superagentPostStub
      .onFirstCall().returns(pendingMock)
      .onSecondCall().returns(successMock);

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    // Should have called post twice (initial + retry)
    expect(superagentPostStub.callCount).to.equal(2);
  });

  const settledWallet = () => ({
    rejected: [],
    inMempool: [],
    pending: [],
    stuckCount: 0,
    oldestUnconfirmedAge: null,
  });

  const walletWithUnconfirmedTx = () => ({
    ...settledWallet(),
    inMempool: [{ name: 'tx-in-flight' }],
    oldestUnconfirmedAge: 5,
  });

  const walletWithRejectedTx = () => ({
    ...settledWallet(),
    rejected: [{ name: 'tx-rejected', rejectionReason: 'all peers failed' }],
    oldestUnconfirmedAge: 90,
  });

  /**
   * Stubs batch_update to report a pending root until `succeedOnCall`, and
   * clear_pending_roots to report `clearSucceeds`. Returns the two scoped stubs
   * so a test can assert how many times each endpoint was called.
   */
  function stubPendingRootThenSuccess({
    succeedOnCall = 3,
    clearSucceeds = true,
  } = {}) {
    const pendingRoot = {
      success: false,
      error: 'Already have a pending root waiting for confirmation',
    };

    const batchUpdate = superagentPostStub.withArgs(
      sinon.match(/batch_update/),
    );
    for (let call = 0; call < succeedOnCall - 1; call++) {
      batchUpdate.onCall(call).returns(createSuperagentMock(pendingRoot));
    }
    batchUpdate
      .onCall(succeedOnCall - 1)
      .returns(createSuperagentMock({ success: true }));

    const clearPending = superagentPostStub
      .withArgs(sinon.match(/clear_pending_roots/))
      .returns(createSuperagentMock({ success: clearSucceeds }));

    return { batchUpdate, clearPending };
  }

  it('should clear a pending root that no transaction can confirm, then succeed', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon.stub(wallet, 'getTransactionHealth').resolves(settledWallet());

    const { batchUpdate, clearPending } = stubPendingRootThenSuccess();

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(1);
    expect(batchUpdate.callCount).to.equal(3);
  });

  it('should leave a pending root alone until it has been seen twice', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon.stub(wallet, 'getTransactionHealth').resolves(settledWallet());

    // The root confirms on its own right after the first sighting, which is the
    // concurrent-push case that must not lose data.
    const { clearPending } = stubPendingRootThenSuccess({ succeedOnCall: 2 });

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(0);
  });

  it('should leave a pending root alone while a transaction is still unconfirmed', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon
      .stub(wallet, 'getTransactionHealth')
      .resolves(walletWithUnconfirmedTx());

    const { clearPending } = stubPendingRootThenSuccess();

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(0);
  });

  it('should clear a pending root when the only unconfirmed tx was rejected', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon.stub(wallet, 'getTransactionHealth').resolves(walletWithRejectedTx());

    const { clearPending } = stubPendingRootThenSuccess();

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    // A rejected transaction can never confirm the root, so it is not a reason
    // to keep it.
    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(1);
  });

  it('should not let a sibling retry consume the first-sighting grace', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon.stub(wallet, 'getTransactionHealth').resolves(settledWallet());

    // "Key already present" advances the shared attempt counter and clears
    // pending roots on its own, so the grace period has to survive it.
    const batchUpdate = superagentPostStub.withArgs(
      sinon.match(/batch_update/),
    );
    batchUpdate.onCall(0).returns(
      createSuperagentMock({
        success: false,
        error: 'Key already present',
      }),
    );
    batchUpdate.onCall(1).returns(
      createSuperagentMock({
        success: false,
        error: 'Already have a pending root waiting for confirmation',
      }),
    );
    batchUpdate.onCall(2).returns(createSuperagentMock({ success: true }));

    const clearPending = superagentPostStub
      .withArgs(sinon.match(/clear_pending_roots/))
      .returns(createSuperagentMock({ success: true }));

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    // Only the "Key already present" branch cleared; the pending root was on
    // its first sighting and must have been left alone.
    expect(clearPending.callCount).to.equal(1);
  });

  it('should leave a pending root alone when only the DataLayer wallet is unsettled', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    const health = sinon.stub(wallet, 'getTransactionHealth');
    health.withArgs('1').resolves(settledWallet());
    health.withArgs('2').resolves(walletWithUnconfirmedTx());

    const { clearPending } = stubPendingRootThenSuccess();

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(0);
  });

  it('should leave a pending root alone when the DataLayer wallet id is unknown', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves(null);
    sinon.stub(wallet, 'getTransactionHealth').resolves(settledWallet());

    const { clearPending } = stubPendingRootThenSuccess();

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(0);
  });

  it('should leave a pending root alone when wallet state cannot be determined', async function () {
    this.timeout(60000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon
      .stub(wallet, 'getTransactionHealth')
      .rejects(new Error('get_transactions failed for wallet 1'));

    const { clearPending } = stubPendingRootThenSuccess();

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    expect(clearPending.callCount).to.equal(0);
  });

  it('should discard at most one pending root per push', async function () {
    this.timeout(120000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon.stub(wallet, 'getTransactionHealth').resolves(settledWallet());

    // Never succeeds, so every remaining attempt sees a pending root.
    const { clearPending } = stubPendingRootThenSuccess({ succeedOnCall: 99 });

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.false;
    expect(clearPending.callCount).to.equal(1);
  });

  it('should retry a clear that did not take effect', async function () {
    this.timeout(120000);

    sinon.stub(wallet, 'getDLWalletId').resolves('2');
    sinon.stub(wallet, 'getTransactionHealth').resolves(settledWallet());

    const { clearPending } = stubPendingRootThenSuccess({
      succeedOnCall: 4,
      clearSucceeds: false,
    });

    const result = await pushChangeListToDataLayer(testStoreId, testChangelist);

    expect(result).to.be.true;
    // Nothing was discarded, so the one-per-push cap does not apply.
    expect(clearPending.callCount).to.equal(2);
  });

  it('should throw a permanent error for "not owned by DL Wallet"', async function () {
    const mock = createSuperagentMock({
      success: false,
      error: `Singleton with launcher ID ${testStoreId} is not owned by DL Wallet`,
      structuredError: {
        code: 'UNKNOWN',
        data: {},
        message: `Singleton with launcher ID ${testStoreId} is not owned by DL Wallet`,
      },
    });
    superagentPostStub.returns(mock);

    try {
      await pushChangeListToDataLayer(testStoreId, testChangelist);
      expect.fail('Should have thrown a permanent error');
    } catch (error) {
      expect(error.message).to.include('not owned');
      expect(error.permanent).to.be.true;
    }
  });
});
