'use strict';

/**
 * Shared "is the mirror table already caught up?" gate used by both the V1
 * (`backfillMirror`) and V2 (`backfillMirrorV2`) backfill loops. The two code
 * paths previously carried verbatim copies of this logic; they now share this
 * single implementation so a fix applies to both.
 *
 * The only per-caller differences are the logger instance and the log-message
 * prefix (`''` for V1, `'[v2]: '` for V2), both passed in as parameters.
 */

// Sequelize attribute names for the auto-managed updatedAt column. V1
// models use the default 'updatedAt'; V2 models declare
// `updatedAt: 'updated_at'` with `underscored: true`, which makes
// 'updated_at' the rawAttribute key. Probe both candidates so the same
// gate works against either convention without depending on Sequelize
// internals (_timestampAttributes is undocumented).
export const UPDATED_AT_ATTR_CANDIDATES = ['updatedAt', 'updated_at'];

/**
 * Find a Sequelize attribute name for the updatedAt column that is
 * present on BOTH source and mirror models. Returns the attribute name,
 * or null when no consistent name exists (either model is missing the
 * column, or they disagree on naming).
 *
 * Disagreement is intentionally treated as "no gate" rather than picking
 * one side: a mismatched name would force one side's MAX() call to
 * reference a non-existent column and throw, which would mask a real
 * drift behind a swallowed error.
 */
export const matchingUpdatedAtAttr = (source, mirror) => {
  const sourceAttrs = source.rawAttributes || {};
  const mirrorAttrs = mirror.rawAttributes || {};
  for (const attr of UPDATED_AT_ATTR_CANDIDATES) {
    if (attr in sourceAttrs && attr in mirrorAttrs) {
      return attr;
    }
  }
  return null;
};

/**
 * Cheap "is the mirror table already caught up?" check used by
 * backfillMirror to short-circuit the bulk-upsert pass when there is
 * nothing to do. The orphan sweep runs unconditionally BEFORE this
 * helper so PK-swap drift (count and MAX preserved, row identities
 * differ) is exposed as a post-sweep count mismatch and falls through
 * to the upsert. See the call site for the full ordering rationale.
 *
 * Returns true ONLY when BOTH conditions hold:
 *   1. count(source) === count(mirror)
 *   2. Either both counts are 0 (truly empty on both sides), OR
 *      floor(max(mirror[updatedAtAttr])) >= floor(max(source[updatedAtAttr]))
 *      where floor() truncates to whole seconds (see resolution note below)
 *
 * Returns false in every other case (including any error), so the
 * caller falls through to the existing full upsert. Crucially, false
 * is the safe default: a false negative just causes the existing
 * (correct) full sync to run, while a false positive would silently
 * leave the mirror stale. We deliberately bias toward the
 * cheap-but-fully-correct fall-through.
 *
 * Timestamp resolution: the MAX(updatedAt) comparison is done at
 * whole-second resolution. SQLite retains millisecond precision on
 * updatedAt, but the mirror stores only whole seconds: Sequelize's mysql
 * DATE serialization emits "YYYY-MM-DD HH:mm:ss" with no fractional part
 * (pinned by tests/v2/integration/mirror-datetime-format.spec.js), so
 * every value is truncated down to its whole second before it reaches
 * MySQL - independent of the server's fractional-rounding SQL mode. A
 * freshly-synced mirror therefore reads back at or just behind the source
 * (e.g. source .899 vs mirror .000). Comparing at millisecond resolution
 * treated that truncation as drift and forced a full re-upsert of the
 * whole table on every restart. Flooring both sides to whole seconds
 * compares like-with-like against the resolution the mirror can hold. (A
 * fallback path can instead round a sub-second value half-up on a MariaDB
 * DATETIME(0) column - see src/config/config.js - so the mirror is not
 * guaranteed to land exactly at floor(source); the whole-second compare
 * neither introduces nor removes that edge relative to the prior
 * millisecond compare, and the count check, orphan sweep, and
 * safe-false-negative bias remain the backstop.)
 *
 * Known limitation - sub-second UPDATE drift: an update whose new
 * updatedAt lands in the same whole second as the mirror's newest row is
 * not seen by the gate. Sequelize-driven UPDATEs auto-bump updatedAt to
 * NOW(), so any change in a later whole second than the last synced write
 * is still detected; only a same-second miss (or raw-SQL writes that
 * bypass the ORM, which CADT does not do) is invisible, and the next
 * write crossing a whole-second boundary repairs it. If sub-second drift
 * detection ever becomes a hard requirement, replace this with a
 * SUM(UNIX_TIMESTAMP(updatedAt)) checksum or a per-table hash digest.
 *
 * @param {string} [logPrefix=''] - Prepended to every log line so V2 callers
 *   can keep their '[v2]: ' tag without forking the implementation.
 */
export const isMirrorInSync = async (
  source,
  mirror,
  name,
  updatedAtAttr,
  logger,
  logPrefix = '',
) => {
  try {
    const [sourceCount, mirrorCount, sourceMax, mirrorMax] = await Promise.all([
      source.count(),
      mirror.count(),
      source.max(updatedAtAttr),
      mirror.max(updatedAtAttr),
    ]);

    if (sourceCount !== mirrorCount) {
      logger.debug(
        `${logPrefix}Mirror backfill: ${name} - gate failed (count mismatch: source=${sourceCount} mirror=${mirrorCount})`,
      );
      return false;
    }

    if (sourceCount === 0) {
      logger.debug(
        `${logPrefix}Mirror backfill: ${name} - in sync, skipping (empty on both sides)`,
      );
      return true;
    }

    // Counts agree and are non-zero. A null MAX(updatedAt) at this
    // point means rows exist with null timestamps - we can't compare
    // freshness, so fall through to the full sync rather than skip.
    if (sourceMax == null || mirrorMax == null) {
      logger.debug(
        `${logPrefix}Mirror backfill: ${name} - gate failed (max(updatedAt) null with ${sourceCount} rows)`,
      );
      return false;
    }

    // Sequelize.max returns either a Date (for DATE columns) or whatever
    // raw value the dialect returned. Coerce through Date so SQLite string
    // timestamps and MySQL Date instances compare consistently.
    const sourceMs = new Date(sourceMax).getTime();
    const mirrorMs = new Date(mirrorMax).getTime();
    if (Number.isNaN(sourceMs) || Number.isNaN(mirrorMs)) {
      logger.debug(
        `${logPrefix}Mirror backfill: ${name} - gate failed (non-parseable max(updatedAt))`,
      );
      return false;
    }

    // Compare at whole-second resolution: the mirror's DATETIME column
    // cannot represent the sub-second precision SQLite keeps, so a
    // millisecond comparison reports a just-synced mirror as stale. See
    // the resolution note in this function's doc comment.
    const sourceSec = Math.floor(sourceMs / 1000);
    const mirrorSec = Math.floor(mirrorMs / 1000);

    if (mirrorSec >= sourceSec) {
      logger.debug(
        `${logPrefix}Mirror backfill: ${name} - in sync, skipping (${sourceCount} rows, max(updatedAt) second mirror=${mirrorSec} >= source=${sourceSec}; ms mirror=${mirrorMs} source=${sourceMs})`,
      );
      return true;
    }

    logger.debug(
      `${logPrefix}Mirror backfill: ${name} - gate failed (mirror max(updatedAt) second=${mirrorSec} < source=${sourceSec}; ms mirror=${mirrorMs} source=${sourceMs})`,
    );
    return false;
  } catch (error) {
    // Never block the existing sync path on a gate error - just fall
    // through to the full upsert.
    logger.debug(
      `${logPrefix}Mirror backfill: ${name} - gate check failed (${error.message}), falling through to full sync`,
    );
    return false;
  }
};
