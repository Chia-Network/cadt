// In-memory cache for audit row counts. The audit list endpoint paginates with
// findAll + a separate count; deep pagination would otherwise re-run an
// identical COUNT(*) on every page even though the total only changes when an
// audit write happens. The count is freshened two ways: the audit models call
// clearAuditCountCache() on every write (so single-process counts stay
// accurate), and the TTL bounds worst-case staleness if a write path is ever
// missed or the process is one of several sharing the DB. pageCount may
// therefore lag by at most the TTL, which is acceptable for pagination
// metadata.

const DEFAULT_TTL_MS = 15_000;

// Bound the number of distinct keys; eviction is oldest-first (Map insertion
// order). Set far above the realistic number of subscribed orgs, so this only
// trips on pathological key churn rather than normal operation.
const MAX_ENTRIES = 10_000;

const cache = new Map(); // key -> { value, expires }

// Bumped on every clearAuditCountCache(). A compute that started before a clear
// must not repopulate the cache with its now-stale result, so getCachedCount
// only writes back when the generation is unchanged across the await.
let generation = 0;

export async function getCachedCount(key, computeFn, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    return hit.value;
  }
  if (hit) {
    cache.delete(key); // drop the expired entry before recomputing
  }

  const startGeneration = generation;
  const value = await computeFn();
  // A write invalidated the cache while COUNT(*) was in flight; the computed
  // value may predate that write, so return it without caching.
  if (generation !== startGeneration) {
    return value;
  }

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function clearAuditCountCache() {
  generation += 1;
  cache.clear();
}
