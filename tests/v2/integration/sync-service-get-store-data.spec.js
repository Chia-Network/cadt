/**
 * Unit tests for syncService.getStoreData callback semantics.
 *
 * Pins the contract that the success callback is awaited before
 * getStoreData() resolves, and that a rejecting callback is routed
 * through the onFail handler rather than becoming an unhandled
 * promise rejection. Stubs Simulator.findAll to bypass the test
 * database and keep these tests in the millisecond range.
 */

import { expect } from 'chai';
import sinon from 'sinon';

// Import datalayer index first to resolve circular dependency in the
// correct order, matching the pattern used by other unit-style specs.
import '../../../src/datalayer/index.js';
import { Simulator } from '../../../src/models/index.js';
import syncService from '../../../src/datalayer/syncService.js';

describe('syncService.getStoreData - callback semantics', function () {
  this.timeout(10000);

  const TEST_STORE_ID = 'abc123';
  // hex-encoded 'k' / 'v' so decodeDataLayerResponse produces predictable output
  const HEX_K = Buffer.from('k').toString('hex');
  const HEX_V = Buffer.from('v').toString('hex');

  beforeEach(function () {
    sinon.stub(Simulator, 'findAll').resolves([
      { key: `${TEST_STORE_ID}_${HEX_K}`, value: HEX_V },
    ]);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('awaits an async success callback before resolving', async function () {
    const events = [];

    const callback = async () => {
      events.push('callback-start');
      await new Promise((resolve) => setTimeout(resolve, 25));
      events.push('callback-end');
    };

    const onFail = sinon.spy();

    await syncService.getStoreData(TEST_STORE_ID, callback, onFail);
    events.push('getStoreData-returned');

    // Without `await callback(...)`, the order would be
    // ['callback-start', 'getStoreData-returned', 'callback-end'].
    expect(events).to.deep.equal([
      'callback-start',
      'callback-end',
      'getStoreData-returned',
    ]);
    expect(onFail.called).to.be.false;
  });

  it('routes a rejecting async callback through onFail', async function () {
    const onFail = sinon.spy();

    const callback = async () => {
      throw new Error('callback failed');
    };

    await syncService.getStoreData(TEST_STORE_ID, callback, onFail);

    expect(onFail.calledOnce).to.be.true;
    expect(onFail.firstCall.args[0]).to.equal('callback failed');
  });

  it('still works with a synchronous callback', async function () {
    const callback = sinon.spy();
    const onFail = sinon.spy();

    await syncService.getStoreData(TEST_STORE_ID, callback, onFail);

    expect(callback.calledOnce).to.be.true;
    expect(callback.firstCall.args[0]).to.deep.equal([{ key: 'k', value: 'v' }]);
    expect(onFail.called).to.be.false;
  });
});
