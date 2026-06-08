import { expect } from 'chai';

import {
  isMirrorInSync,
  matchingUpdatedAtAttr,
  UPDATED_AT_ATTR_CANDIDATES,
} from '../../src/database/mirror-sync-gate.js';

/**
 * Direct unit tests for the shared mirror in-sync gate.
 *
 * The V1/V2 backfill-dedupe integration specs drive isMirrorInSync through
 * real Sequelize models, but they cannot reach the "non-zero count with a
 * null MAX(updatedAt)" defensive branch: every CADT mirror model declares
 * `timestamps: true`, so SQLite rejects any write that would leave
 * updated_at null. That branch is therefore exercised here against
 * lightweight stub models, where we control exactly what count()/max()
 * return without fighting a NOT NULL constraint.
 *
 * Stub model: only count() and max() are used by isMirrorInSync, so a plain
 * object with those two async methods is a faithful stand-in for a Sequelize
 * model as far as the gate is concerned.
 */
const makeModel = ({ count, max }) => ({
  count: async () => count,
  max: async () => max,
});

// Silent logger - the gate only logs at debug level; we don't assert on it.
const silentLogger = { debug: () => {} };

describe('Mirror in-sync gate (isMirrorInSync) — unit', function () {
  const ATTR = 'updatedAt';

  it('skips when both sides are empty (count 0 on both)', async function () {
    const source = makeModel({ count: 0, max: null });
    const mirror = makeModel({ count: 0, max: null });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(true);
  });

  it('falls through when counts mismatch', async function () {
    const source = makeModel({ count: 5, max: '2026-01-01 00:00:00' });
    const mirror = makeModel({ count: 4, max: '2026-01-01 00:00:00' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });

  it('skips when counts match and mirror max(updatedAt) >= source', async function () {
    const source = makeModel({ count: 3, max: '2026-01-01 00:00:00' });
    const mirror = makeModel({ count: 3, max: '2026-01-02 00:00:00' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(true);
  });

  it('falls through when mirror max(updatedAt) is older than source', async function () {
    const source = makeModel({ count: 3, max: '2026-02-01 00:00:00' });
    const mirror = makeModel({ count: 3, max: '2026-01-01 00:00:00' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });

  // The documented gap: non-zero count but a null MAX(updatedAt). The gate
  // must NOT misclassify this as "empty / in sync" - it can't compare
  // freshness, so it must fall through to the full sync.
  it('falls through when source max(updatedAt) is null with rows present', async function () {
    const source = makeModel({ count: 2, max: null });
    const mirror = makeModel({ count: 2, max: '2026-01-01 00:00:00' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });

  it('falls through when mirror max(updatedAt) is null with rows present', async function () {
    const source = makeModel({ count: 2, max: '2026-01-01 00:00:00' });
    const mirror = makeModel({ count: 2, max: null });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });

  it('falls through when max(updatedAt) is non-parseable with rows present', async function () {
    const source = makeModel({ count: 1, max: 'not-a-date' });
    const mirror = makeModel({ count: 1, max: 'not-a-date' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });

  it('falls through (does not throw) when a probe query errors', async function () {
    const source = {
      count: async () => {
        throw new Error('boom');
      },
      max: async () => null,
    };
    const mirror = makeModel({ count: 0, max: null });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });
});

describe('matchingUpdatedAtAttr — unit', function () {
  const withAttrs = (...names) => ({
    rawAttributes: Object.fromEntries(names.map((n) => [n, {}])),
  });

  it('returns the shared camelCase attribute (V1 convention)', function () {
    const attr = matchingUpdatedAtAttr(
      withAttrs('updatedAt'),
      withAttrs('updatedAt'),
    );
    expect(attr).to.equal('updatedAt');
  });

  it('returns the shared snake_case attribute (V2 convention)', function () {
    const attr = matchingUpdatedAtAttr(
      withAttrs('updated_at'),
      withAttrs('updated_at'),
    );
    expect(attr).to.equal('updated_at');
  });

  it('returns null when source and mirror disagree on the attribute name', function () {
    const attr = matchingUpdatedAtAttr(
      withAttrs('updatedAt'),
      withAttrs('updated_at'),
    );
    expect(attr).to.equal(null);
  });

  it('only considers the known candidate attribute names', function () {
    expect(UPDATED_AT_ATTR_CANDIDATES).to.deep.equal(['updatedAt', 'updated_at']);
  });
});
