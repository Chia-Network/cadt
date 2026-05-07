'use strict';

// V1 FTS5 trigger deferral helpers.
//
// On Pi-class hardware, the largest single contributor to per-row write cost
// during catch-up is the FTS5 maintenance triggers: every project/unit
// upsert re-tokenises ~22 columns into projects_fts / units_fts. Across a
// 1000-row generation that runs many times during a fresh sync, this is a
// dominant cost.
//
// Approach (V1):
//   - When the sync loop notices that any subscribed org has not yet caught
//     up, snapshot the currently-installed project/unit FTS triggers into
//     `meta`, drop the triggers, and set a deferral flag in `meta`.
//   - When all subscribed orgs are caught up AND the flag is set, recreate
//     the triggers from the snapshot, rebuild projects_fts / units_fts from
//     the source tables in a single transaction, then clear both meta keys.
//   - On boot (prepareDb), if the flag is set, perform the recreate +
//     rebuild + clear sequence before any FTS reads. This is the
//     crash-recovery path: a crash mid-catch-up leaves the flag set, the
//     triggers still dropped, and the FTS tables stale. The boot recovery
//     restores the invariant before any reads can observe stale data.
//
// Why introspect-and-snapshot instead of hardcoding the DDL?
//   - The trigger column lists in this file would otherwise have to be kept
//     manually in sync with whatever the latest migration installs. A
//     mismatch silently changes runtime trigger behaviour the first time a
//     deferral cycle fires. Reading the live `sqlite_master.sql` at defer
//     time guarantees we recreate exactly what was installed, no matter
//     how many migrations have layered on top.
//
// All operations are SQLite-only (FTS5 is SQLite-specific). Callers that
// might run on MySQL must check the dialect before invoking these helpers.

import { sequelize } from '../database';
import { logger } from '../config/logger.js';

export const FTS5_DEFER_META_KEY = 'fts5TriggersDeferredV1';
export const FTS5_DEFER_TRIGGERS_META_KEY = 'fts5DeferredTriggerSnapshotV1';

const PROJECTS_FTS_TABLE = 'projects_fts';
const UNITS_FTS_TABLE = 'units_fts';

const isSqlite = () => sequelize.getDialect() === 'sqlite';

const ftsTableExists = async (tableName, transaction) => {
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=:tableName",
    { replacements: { tableName }, transaction },
  );
  return Array.isArray(rows) && rows.length > 0;
};

const fetchFtsColumnList = async (tableName, transaction) => {
  // PRAGMA table_info works on FTS5 virtual tables and returns the user-
  // visible columns in declaration order. We use the live introspection
  // result rather than a hardcoded list so future column additions don't
  // silently desync the rebuild SELECT from the FTS schema.
  const rows = await sequelize.query(`PRAGMA table_info('${tableName}');`, {
    transaction,
    type: sequelize.QueryTypes.SELECT,
  });
  return rows.map((r) => r.name);
};

// Discover all triggers whose definition mentions either V1 FTS table.
// Returns [{ name, sql }] in a stable order. Filters out internal
// `sqlite_*` triggers defensively.
const introspectV1FtsTriggers = async (transaction) => {
  const rows = await sequelize.query(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'trigger'
       AND name NOT LIKE 'sqlite_%'
       AND sql IS NOT NULL
       AND (sql LIKE '%projects_fts%' OR sql LIKE '%units_fts%')
     ORDER BY name;`,
    { transaction, type: sequelize.QueryTypes.SELECT },
  );
  return rows
    .filter((r) => typeof r.name === 'string' && typeof r.sql === 'string')
    .map((r) => ({ name: r.name, sql: r.sql }));
};

const dropTriggersByName = async (names, transaction) => {
  for (const name of names) {
    await sequelize.query(`DROP TRIGGER IF EXISTS ${name};`, { transaction });
  }
};

const getMetaModel = async () => {
  // eslint-disable-next-line no-restricted-syntax -- circular dep guard
  const { Meta } = await import('../models/index.js');
  return Meta;
};

const isFtsDeferralFlagSet = async (transaction) => {
  const Meta = await getMetaModel();
  const row = await Meta.findOne({
    where: { metaKey: FTS5_DEFER_META_KEY },
    raw: true,
    transaction,
  });
  return !!row;
};

const readTriggerSnapshot = async (transaction) => {
  const Meta = await getMetaModel();
  const row = await Meta.findOne({
    where: { metaKey: FTS5_DEFER_TRIGGERS_META_KEY },
    raw: true,
    transaction,
  });
  if (!row || typeof row.metaValue !== 'string') return null;
  try {
    const parsed = JSON.parse(row.metaValue);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (t) => t && typeof t.name === 'string' && typeof t.sql === 'string',
    );
  } catch (error) {
    logger.warn(
      `[v1]: Failed to parse FTS5 trigger snapshot from meta: ${error.message}`,
    );
    return null;
  }
};

const writeTriggerSnapshot = async (snapshot, transaction) => {
  const json = JSON.stringify(snapshot);
  await sequelize.query(`DELETE FROM meta WHERE metaKey = :metaKey;`, {
    replacements: { metaKey: FTS5_DEFER_TRIGGERS_META_KEY },
    transaction,
  });
  await sequelize.query(
    `INSERT INTO meta (metaKey, metaValue) VALUES (:metaKey, :metaValue);`,
    {
      replacements: {
        metaKey: FTS5_DEFER_TRIGGERS_META_KEY,
        metaValue: json,
      },
      transaction,
    },
  );
};

const setFtsDeferralFlag = async (transaction) => {
  await sequelize.query(
    `INSERT OR IGNORE INTO meta (metaKey, metaValue)
     VALUES (:metaKey, '1');`,
    {
      replacements: { metaKey: FTS5_DEFER_META_KEY },
      transaction,
    },
  );
};

// Bypass Meta.destroy's 50ms back-pressure shim: this path runs inside the
// restore transaction and that delay would needlessly extend the SQLite
// write lock.
const clearDeferralStateRaw = async (transaction) => {
  await sequelize.query(`DELETE FROM meta WHERE metaKey = :metaKey;`, {
    replacements: { metaKey: FTS5_DEFER_META_KEY },
    transaction,
  });
  await sequelize.query(`DELETE FROM meta WHERE metaKey = :metaKey;`, {
    replacements: { metaKey: FTS5_DEFER_TRIGGERS_META_KEY },
    transaction,
  });
};

/**
 * Snapshot the currently-installed V1 FTS triggers into `meta` then drop
 * them. Idempotent: if no triggers are currently installed, the existing
 * snapshot (if any) is preserved so a subsequent recreate can still work.
 *
 * Exported so unit tests can drive the helper directly.
 */
export const dropV1FtsTriggers = async (transaction) => {
  const snapshot = await introspectV1FtsTriggers(transaction);
  if (snapshot.length > 0) {
    await writeTriggerSnapshot(snapshot, transaction);
    await dropTriggersByName(
      snapshot.map((t) => t.name),
      transaction,
    );
  }
  return snapshot;
};

/**
 * Recreate the V1 FTS triggers from the persisted snapshot. Idempotent:
 * any trigger of the same name is dropped first. Returns the names of
 * the triggers that were recreated (empty array if no snapshot exists).
 */
export const recreateV1FtsTriggers = async (transaction) => {
  const snapshot = await readTriggerSnapshot(transaction);
  if (!snapshot || snapshot.length === 0) {
    logger.warn(
      '[v1]: No FTS5 trigger snapshot found while recreating; triggers will not be restored from this call',
    );
    return [];
  }
  for (const { name } of snapshot) {
    await sequelize.query(`DROP TRIGGER IF EXISTS ${name};`, { transaction });
  }
  for (const { sql } of snapshot) {
    await sequelize.query(sql, { transaction });
  }
  return snapshot.map((t) => t.name);
};

/**
 * Rebuild projects_fts / units_fts from projects / units. Uses runtime
 * column introspection so the SELECT list stays in sync with whatever
 * columns the current FTS tables have.
 *
 * For each FTS table, we DELETE everything then INSERT (col1, ...)
 * SELECT col1, ... FROM <source>. We deliberately don't use the FTS5
 * 'rebuild' command here because these FTS tables are NOT external-
 * content tables (they have no `content=projects` clause), so 'rebuild'
 * would only re-index data already inside the FTS table - it would not
 * pull rows from the projects/units source tables that were upserted
 * while triggers were dropped.
 */
export const rebuildV1FtsTables = async (transaction) => {
  if (await ftsTableExists(PROJECTS_FTS_TABLE, transaction)) {
    const cols = await fetchFtsColumnList(PROJECTS_FTS_TABLE, transaction);
    if (cols.length > 0) {
      const colList = cols.join(', ');
      await sequelize.query(`DELETE FROM ${PROJECTS_FTS_TABLE};`, {
        transaction,
      });
      await sequelize.query(
        `INSERT INTO ${PROJECTS_FTS_TABLE} (${colList}) SELECT ${colList} FROM projects;`,
        { transaction },
      );
    }
  }

  if (await ftsTableExists(UNITS_FTS_TABLE, transaction)) {
    const cols = await fetchFtsColumnList(UNITS_FTS_TABLE, transaction);
    if (cols.length > 0) {
      const colList = cols.join(', ');
      await sequelize.query(`DELETE FROM ${UNITS_FTS_TABLE};`, { transaction });
      await sequelize.query(
        `INSERT INTO ${UNITS_FTS_TABLE} (${colList}) SELECT ${colList} FROM units;`,
        { transaction },
      );
    }
  }
};

/**
 * Idempotent: snapshot + drop FTS triggers and set the deferral flag.
 * Called at the top of each sync tick when at least one subscribed org
 * still needs catch-up.
 */
export const ensureV1FtsTriggersDeferred = async () => {
  if (!isSqlite()) return;
  if (await isFtsDeferralFlagSet()) return;

  // Snapshot + drop triggers + set flag in one transaction so a crash
  // here either leaves all three effects (recovered on next boot) or
  // none.
  const tx = await sequelize.transaction();
  try {
    // Re-check inside the transaction to close the race window where two
    // callers both saw the flag unset before either committed.
    if (await isFtsDeferralFlagSet(tx)) {
      await tx.commit();
      return;
    }
    const snapshot = await dropV1FtsTriggers(tx);
    // Only mark deferral active when we actually have a snapshot to
    // restore from. If introspection found no triggers AND no prior
    // snapshot is persisted, setting the flag would convince the next
    // restore tick that it has work to do; the restore would then clear
    // the flag without recreating any triggers, permanently losing the
    // FTS triggers from this install.
    const restorable =
      snapshot.length > 0 ? snapshot : await readTriggerSnapshot(tx);
    if (!restorable || restorable.length === 0) {
      logger.warn(
        '[v1]: No FTS5 triggers were installed and no snapshot is persisted; refusing to mark deferral active so the restore path cannot lose triggers',
      );
      await tx.rollback();
      return;
    }
    await setFtsDeferralFlag(tx);
    await tx.commit();
    logger.info(
      `[v1]: FTS5 project/unit triggers deferred during sync catch-up (snapshot: ${restorable.length} trigger(s))`,
    );
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // already rolled back
    }
    logger.error(
      `[v1]: Failed to defer FTS5 triggers for catch-up: ${error.message}`,
    );
  }
};

/**
 * If the deferral flag is set, recreate triggers from the snapshot +
 * rebuild projects_fts / units_fts from projects / units, then clear
 * both the flag and the snapshot. All in a single transaction so a crash
 * mid-rebuild leaves the flag set and the next boot recovery re-runs the
 * work.
 */
export const restoreV1FtsTriggersAndRebuildIfDeferred = async () => {
  if (!isSqlite()) return false;
  if (!(await isFtsDeferralFlagSet())) return false;

  const tx = await sequelize.transaction();
  try {
    // Re-check inside the transaction in case a parallel caller already
    // cleared the flag between the outer check and tx open.
    if (!(await isFtsDeferralFlagSet(tx))) {
      await tx.commit();
      return false;
    }
    await recreateV1FtsTriggers(tx);
    await rebuildV1FtsTables(tx);
    await clearDeferralStateRaw(tx);
    await tx.commit();
    logger.info(
      '[v1]: FTS5 project/unit triggers restored and projects_fts / units_fts rebuilt',
    );
    return true;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // already rolled back
    }
    logger.error(
      `[v1]: Failed to restore FTS5 triggers / rebuild FTS tables: ${error.message}`,
    );
    throw error;
  }
};
