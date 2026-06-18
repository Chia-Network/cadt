import { expect } from 'chai';
import {
  getCachedCount,
  clearAuditCountCache,
} from '../../src/utils/audit-count-cache.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('audit count cache', function () {
  beforeEach(function () {
    clearAuditCountCache();
  });

  after(function () {
    clearAuditCountCache();
  });

  it('computes on a miss and serves the memoized value on a hit', async function () {
    let calls = 0;
    const compute = async () => {
      calls += 1;
      return 42;
    };

    const first = await getCachedCount('test:org-a', compute, 10000);
    const second = await getCachedCount('test:org-a', compute, 10000);

    expect(first).to.equal(42);
    expect(second).to.equal(42);
    expect(calls).to.equal(1);
  });

  it('recomputes once the TTL has expired', async function () {
    let calls = 0;
    const compute = async () => {
      calls += 1;
      return calls;
    };

    const first = await getCachedCount('test:org-b', compute, 20);
    expect(first).to.equal(1);

    await sleep(30);

    const second = await getCachedCount('test:org-b', compute, 20);
    expect(second).to.equal(2);
    expect(calls).to.equal(2);
  });

  it('recomputes after clearAuditCountCache invalidates the entry', async function () {
    let calls = 0;
    const compute = async () => {
      calls += 1;
      return calls;
    };

    await getCachedCount('test:org-c', compute, 10000);
    clearAuditCountCache();
    const afterClear = await getCachedCount('test:org-c', compute, 10000);

    expect(afterClear).to.equal(2);
    expect(calls).to.equal(2);
  });

  it('keys entries independently', async function () {
    const a = await getCachedCount('test:org-d', async () => 1, 10000);
    const b = await getCachedCount('test:org-e', async () => 2, 10000);

    expect(a).to.equal(1);
    expect(b).to.equal(2);
  });

  it('evicts the oldest entry once the size cap is exceeded', async function () {
    this.timeout(20000);
    const MAX_ENTRIES = 10000;

    // Fill the cache to the cap; the first key inserted is the oldest.
    for (let i = 0; i < MAX_ENTRIES; i += 1) {
      await getCachedCount(`evict:${i}`, async () => i, 60000);
    }

    // One more distinct key trips eviction of the oldest (evict:0).
    await getCachedCount('evict:overflow', async () => -1, 60000);

    let recomputed = false;
    const value = await getCachedCount(
      'evict:0',
      async () => {
        recomputed = true;
        return 999;
      },
      60000,
    );

    expect(recomputed).to.equal(true);
    expect(value).to.equal(999);
  });

  it('does not cache a value computed before a concurrent invalidation', async function () {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    let calls = 0;
    const compute = async () => {
      calls += 1;
      await gate;
      return calls;
    };

    // Start a compute, invalidate mid-flight, then let the compute finish.
    const inFlight = getCachedCount('test:race', compute, 10000);
    clearAuditCountCache();
    release();
    const racedValue = await inFlight;
    expect(racedValue).to.equal(1);

    // The raced value must not have been cached, so the next read recomputes.
    const next = await getCachedCount('test:race', compute, 10000);
    expect(next).to.equal(2);
    expect(calls).to.equal(2);
  });
});
