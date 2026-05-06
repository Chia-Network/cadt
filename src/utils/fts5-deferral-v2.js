'use strict';

// V2 FTS5 trigger deferral helpers. See src/utils/fts5-deferral.js for the
// rationale and design notes; the two files are mirror-images differing
// only in trigger names, table names, meta-key names, and the meta backend.

import { sequelizeV2 } from '../database/v2/index.js';
import { loggerV2 } from '../config/logger.js';

export const FTS5_DEFER_META_KEY_V2 = 'fts5TriggersDeferredV2';
export const FTS5_DEFER_TRIGGERS_META_KEY_V2 = 'fts5DeferredTriggerSnapshotV2';

const PROJECTS_FTS_TABLE = 'projects_v2_fts';
const UNITS_FTS_TABLE = 'units_v2_fts';

const isSqlite = () => sequelizeV2.getDialect() === 'sqlite';

const ftsTableExists = async (tableName, transaction) => {
  const [rows] = await sequelizeV2.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=:tableName",
    { replacements: { tableName }, transaction },
  );
  return Array.isArray(rows) && rows.length > 0;
};

const fetchFtsColumnList = async (tableName, transaction) => {
  const rows = await sequelizeV2.query(`PRAGMA table_info('${tableName}');`, {
    transaction,
    type: sequelizeV2.QueryTypes.SELECT,
  });
  return rows.map((r) => r.name);
};

const introspectV2FtsTriggers = async (transaction) => {
  const rows = await sequelizeV2.query(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'trigger'
       AND name NOT LIKE 'sqlite_%'
       AND sql IS NOT NULL
       AND (sql LIKE '%projects_v2_fts%' OR sql LIKE '%units_v2_fts%')
     ORDER BY name;`,
    { transaction, type: sequelizeV2.QueryTypes.SELECT },
  );
  return rows
    .filter((r) => typeof r.name === 'string' && typeof r.sql === 'string')
    .map((r) => ({ name: r.name, sql: r.sql }));
};

const dropTriggersByName = async (names, transaction) => {
  for (const name of names) {
    await sequelizeV2.query(`DROP TRIGGER IF EXISTS ${name};`, { transaction });
  }
};

const getMetaModel = async () => {
  // eslint-disable-next-line no-restricted-syntax -- circular dep guard
  const { MetaV2 } = await import('../models/v2/index.js');
  return MetaV2;
};

const isFtsDeferralFlagSetV2 = async (transaction) => {
  const MetaV2 = await getMetaModel();
  const row = await MetaV2.findOne({
    where: { meta_key: FTS5_DEFER_META_KEY_V2 },
    raw: true,
    transaction,
  });
  return !!row;
};

const readTriggerSnapshotV2 = async (transaction) => {
  const MetaV2 = await getMetaModel();
  const row = await MetaV2.findOne({
    where: { meta_key: FTS5_DEFER_TRIGGERS_META_KEY_V2 },
    raw: true,
    transaction,
  });
  if (!row || typeof row.meta_value !== 'string') return null;
  try {
    const parsed = JSON.parse(row.meta_value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (t) => t && typeof t.name === 'string' && typeof t.sql === 'string',
    );
  } catch (error) {
    loggerV2.warn(
      `[v2]: Failed to parse FTS5 trigger snapshot from meta: ${error.message}`,
    );
    return null;
  }
};

const writeTriggerSnapshotV2 = async (snapshot, transaction) => {
  const json = JSON.stringify(snapshot);
  await sequelizeV2.query(`DELETE FROM meta WHERE meta_key = :metaKey;`, {
    replacements: { metaKey: FTS5_DEFER_TRIGGERS_META_KEY_V2 },
    transaction,
  });
  await sequelizeV2.query(
    `INSERT INTO meta (meta_key, meta_value, created_at, updated_at)
     VALUES (:metaKey, :metaValue, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    {
      replacements: {
        metaKey: FTS5_DEFER_TRIGGERS_META_KEY_V2,
        metaValue: json,
      },
      transaction,
    },
  );
};

const setFtsDeferralFlagV2 = async (transaction) => {
  await sequelizeV2.query(
    `INSERT OR IGNORE INTO meta (meta_key, meta_value, created_at, updated_at)
     VALUES (:metaKey, '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    {
      replacements: { metaKey: FTS5_DEFER_META_KEY_V2 },
      transaction,
    },
  );
};

// Bypass MetaV2.destroy's 50ms back-pressure shim: this path runs inside
// the restore transaction and the delay would needlessly extend the
// SQLite write lock.
const clearDeferralStateRawV2 = async (transaction) => {
  await sequelizeV2.query(`DELETE FROM meta WHERE meta_key = :metaKey;`, {
    replacements: { metaKey: FTS5_DEFER_META_KEY_V2 },
    transaction,
  });
  await sequelizeV2.query(`DELETE FROM meta WHERE meta_key = :metaKey;`, {
    replacements: { metaKey: FTS5_DEFER_TRIGGERS_META_KEY_V2 },
    transaction,
  });
};

export const dropV2FtsTriggers = async (transaction) => {
  const snapshot = await introspectV2FtsTriggers(transaction);
  if (snapshot.length > 0) {
    await writeTriggerSnapshotV2(snapshot, transaction);
    await dropTriggersByName(
      snapshot.map((t) => t.name),
      transaction,
    );
  }
  return snapshot;
};

export const recreateV2FtsTriggers = async (transaction) => {
  const snapshot = await readTriggerSnapshotV2(transaction);
  if (!snapshot || snapshot.length === 0) {
    loggerV2.warn(
      '[v2]: No FTS5 trigger snapshot found while recreating; triggers will not be restored from this call',
    );
    return [];
  }
  for (const { name } of snapshot) {
    await sequelizeV2.query(`DROP TRIGGER IF EXISTS ${name};`, { transaction });
  }
  for (const { sql } of snapshot) {
    await sequelizeV2.query(sql, { transaction });
  }
  return snapshot.map((t) => t.name);
};

export const rebuildV2FtsTables = async (transaction) => {
  if (await ftsTableExists(PROJECTS_FTS_TABLE, transaction)) {
    const cols = await fetchFtsColumnList(PROJECTS_FTS_TABLE, transaction);
    if (cols.length > 0) {
      const colList = cols.join(', ');
      await sequelizeV2.query(`DELETE FROM ${PROJECTS_FTS_TABLE};`, {
        transaction,
      });
      await sequelizeV2.query(
        `INSERT INTO ${PROJECTS_FTS_TABLE} (${colList}) SELECT ${colList} FROM project;`,
        { transaction },
      );
    }
  }

  if (await ftsTableExists(UNITS_FTS_TABLE, transaction)) {
    const cols = await fetchFtsColumnList(UNITS_FTS_TABLE, transaction);
    if (cols.length > 0) {
      const colList = cols.join(', ');
      await sequelizeV2.query(`DELETE FROM ${UNITS_FTS_TABLE};`, {
        transaction,
      });
      await sequelizeV2.query(
        `INSERT INTO ${UNITS_FTS_TABLE} (${colList}) SELECT ${colList} FROM unit;`,
        { transaction },
      );
    }
  }
};

export const ensureV2FtsTriggersDeferred = async () => {
  if (!isSqlite()) return;
  if (await isFtsDeferralFlagSetV2()) return;

  const tx = await sequelizeV2.transaction();
  try {
    if (await isFtsDeferralFlagSetV2(tx)) {
      await tx.commit();
      return;
    }
    const snapshot = await dropV2FtsTriggers(tx);
    // Only mark deferral active when we actually have a snapshot to
    // restore from. See V1 for rationale: setting the flag without a
    // snapshot would let the next restore tick clear the flag without
    // recreating any triggers, permanently losing the FTS triggers.
    const restorable =
      snapshot.length > 0 ? snapshot : await readTriggerSnapshotV2(tx);
    if (!restorable || restorable.length === 0) {
      loggerV2.warn(
        '[v2]: No FTS5 triggers were installed and no snapshot is persisted; refusing to mark deferral active so the restore path cannot lose triggers',
      );
      await tx.rollback();
      return;
    }
    await setFtsDeferralFlagV2(tx);
    await tx.commit();
    loggerV2.info(
      `[v2]: FTS5 project/unit triggers deferred during sync catch-up (snapshot: ${restorable.length} trigger(s))`,
    );
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // already rolled back
    }
    loggerV2.error(
      `[v2]: Failed to defer FTS5 triggers for catch-up: ${error.message}`,
    );
  }
};

export const restoreV2FtsTriggersAndRebuildIfDeferred = async () => {
  if (!isSqlite()) return false;
  if (!(await isFtsDeferralFlagSetV2())) return false;

  const tx = await sequelizeV2.transaction();
  try {
    if (!(await isFtsDeferralFlagSetV2(tx))) {
      await tx.commit();
      return false;
    }
    await recreateV2FtsTriggers(tx);
    await rebuildV2FtsTables(tx);
    await clearDeferralStateRawV2(tx);
    await tx.commit();
    loggerV2.info(
      '[v2]: FTS5 project/unit triggers restored and projects_v2_fts / units_v2_fts rebuilt',
    );
    return true;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // already rolled back
    }
    loggerV2.error(
      `[v2]: Failed to restore FTS5 triggers / rebuild FTS tables: ${error.message}`,
    );
    throw error;
  }
};
