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

  // Resolution guard: SQLite keeps milliseconds on updatedAt, the MySQL
  // mirror's DATETIME column truncates to whole seconds. A just-synced
  // mirror is therefore fractionally behind the source (source .899 vs
  // mirror .000). The gate compares at whole-second resolution, so this
  // must count as in sync - NOT as drift that forces a full re-upsert.
  it('skips when mirror max is the whole-second truncation of a sub-second source max', async function () {
    const source = makeModel({ count: 3, max: '2026-01-01T12:00:00.899Z' });
    const mirror = makeModel({ count: 3, max: '2026-01-01T12:00:00.000Z' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(true);
  });

  // Counterpart to the above: a genuine update advances updatedAt past the
  // next whole-second boundary, so the gate must still detect real drift
  // and fall through to the full sync. This pins the comparison at exactly
  // one-second resolution - not "ignore updatedAt entirely".
  it('falls through when source is newer by a full second (real drift, not truncation)', async function () {
    const source = makeModel({ count: 3, max: '2026-01-01T12:00:01.000Z' });
    const mirror = makeModel({ count: 3, max: '2026-01-01T12:00:00.000Z' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(false);
  });

  // Upper edge of the same-second window: a source .999 ms ahead of a
  // mirror truncated to .000 is still the same whole second, so in sync.
  it('skips at the top of the same whole second (source .999 vs mirror .000)', async function () {
    const source = makeModel({ count: 3, max: '2026-01-01T12:00:00.999Z' });
    const mirror = makeModel({ count: 3, max: '2026-01-01T12:00:00.000Z' });

    const result = await isMirrorInSync(
      source,
      mirror,
      'projects',
      ATTR,
      silentLogger,
    );

    expect(result).to.equal(true);
  });

  // Just across a whole-second boundary: the wall-clock gap is only 200 ms
  // but it straddles two whole seconds, so it counts as real drift and
  // must fall through. Pins that detection is "different whole second",
  // not "difference >= 1000 ms".
  it('falls through when source crosses into the next whole second (200ms real drift)', async function () {
    const source = makeModel({ count: 3, max: '2026-01-01T12:00:01.100Z' });
    const mirror = makeModel({ count: 3, max: '2026-01-01T12:00:00.900Z' });

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
