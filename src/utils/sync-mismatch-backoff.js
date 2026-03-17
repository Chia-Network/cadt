const INITIAL_DELAY_MS = 30_000;
const MAX_DELAY_MS = 600_000;
const BACKOFF_MULTIPLIER = 2;
const PERIODIC_LOG_INTERVAL_MS = 300_000;

/**
 * Per-organization exponential backoff tracker for datalayer sync mismatches.
 *
 * When a non-home org's rootHistory length doesn't match sync_status generation
 * or target_generation, the org is "stuck syncing" in datalayer. Rather than
 * re-checking every 5s (producing ~17k warn logs/day), this backs off from 30s
 * to a 10-minute cap, with periodic info-level summaries every 5 minutes.
 */
export class SyncMismatchBackoff {
  #tracker = new Map();
  #logger;
  #label;

  constructor(logger, label) {
    this.#logger = logger;
    this.#label = label;
  }

  /**
   * Evaluates whether the org should skip this sync cycle due to a mismatch
   * that is still within its backoff window.
   *
   * @param {object} opts
   * @param {string} opts.orgId
   * @param {string} opts.orgName
   * @param {number} opts.rootHistoryLength  - rootHistory.length (not length-1)
   * @param {number|undefined} opts.generation      - sync_status.generation
   * @param {number|undefined} opts.targetGeneration - sync_status.target_generation
   * @returns {boolean} true if the caller should `return` (skip this cycle)
   */
  shouldSkip({ orgId, orgName, rootHistoryLength, generation, targetGeneration }) {
    const highestIndex = rootHistoryLength - 1;
    const isGenerationMismatch = highestIndex !== generation;
    const isTargetMismatch = highestIndex !== targetGeneration;

    if (!isGenerationMismatch && !isTargetMismatch) {
      return false;
    }

    const now = Date.now();
    const existing = this.#tracker.get(orgId);

    if (existing) {
      if (now < existing.skipUntil) {
        if (now - existing.lastLoggedAt >= PERIODIC_LOG_INTERVAL_MS) {
          const stuckFor = Math.round((now - existing.firstSeen) / 1000);
          this.#logger.info(
            `${this.#label}: ${orgName} still waiting for datalayer sync ` +
              `(gen ${generation}/${highestIndex}, ` +
              `stuck for ${stuckFor}s, next retry in ${Math.round((existing.skipUntil - now) / 1000)}s)`,
          );
          existing.lastLoggedAt = now;
        }
        return true;
      }
      existing.delay = Math.min(
        existing.delay * BACKOFF_MULTIPLIER,
        MAX_DELAY_MS,
      );
      existing.skipUntil = now + existing.delay;
      existing.lastLoggedAt = now;
      this.#logger.debug(
        `${this.#label}: Root history mismatch for ${orgName} persists ` +
          `(gen ${generation}/${highestIndex}). ` +
          `Next retry in ${existing.delay / 1000}s.`,
      );
    } else {
      if (isGenerationMismatch) {
        this.#logger.warn(
          `${this.#label}: Root history mismatch for ${orgName}: ` +
            `rootHistory.length-1=${highestIndex} vs ` +
            `sync_status.generation=${generation}. ` +
            `Waiting for datalayer to sync. Will back off if this persists.`,
        );
      } else {
        this.#logger.debug(
          `${this.#label}: Target generation mismatch for ${orgName}: ` +
            `rootHistory.length-1=${highestIndex} vs ` +
            `target_generation=${targetGeneration}. ` +
            `Waiting for datalayer to sync.`,
        );
      }
      this.#tracker.set(orgId, {
        firstSeen: now,
        delay: INITIAL_DELAY_MS,
        skipUntil: now + INITIAL_DELAY_MS,
        lastLoggedAt: now,
      });
    }

    return true;
  }

  /**
   * Call after confirming an org is no longer mismatched. If the org had been
   * tracked, logs that it caught up and removes it.
   *
   * @param {string} orgId
   * @param {string} orgName
   */
  clearIfResolved(orgId, orgName) {
    const existing = this.#tracker.get(orgId);
    if (existing) {
      const stuckFor = Math.round((Date.now() - existing.firstSeen) / 1000);
      this.#logger.info(
        `${this.#label}: ${orgName} datalayer sync caught up after ${stuckFor}s. Resuming normal sync.`,
      );
      this.#tracker.delete(orgId);
    }
  }
}
