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
});
