import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { Sequelize, QueryTypes } from 'sequelize';
import os from 'os';
import config from '../config/config.js';
import { logger } from '../config/logger.js';
import mysql from 'mysql2/promise';
import { getConfig } from '../utils/config-loader';

import { migrations } from './migrations';
import { seeders } from './seeders';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// possible values: local, test
const nodeEnv = process.env.NODE_ENV || 'local';
const dbConfigKey = nodeEnv;

// Safety check: In test mode, ensure we're using test database configuration
if (nodeEnv === 'test') {
  const testConfig = config[dbConfigKey];
  if (!testConfig || !testConfig.storage || !testConfig.storage.includes('test')) {
    const errorMsg = `SAFETY CHECK FAILED: Test mode detected but database config '${dbConfigKey}' does not appear to be a test database. Storage: ${testConfig?.storage || 'undefined'}. This prevents accidental production database access.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Additional check: test database should be under tests/test-dbs/, not in home directory
  if (testConfig.storage.includes('~') || testConfig.storage.includes(os.homedir())) {
    const errorMsg = `SAFETY CHECK FAILED: Test database path appears to be in home directory: ${testConfig.storage}. Test databases must be under tests/test-dbs/.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Ensure test database directory exists
  const dbDir = path.dirname(testConfig.storage);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export const sequelize = new Sequelize(config[dbConfigKey]);

const mirrorConfig =
  (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';
export const sequelizeMirror = new Sequelize(config[mirrorConfig]);

const logDebounce = _.debounce(() => {
  console.log('Mirror DB not connected');
  logger.info('Mirror DB not connected');
}, 120000);

// Test-only override. Tests set this to force mirror-enabled behaviour
// against the SQLite fallback sequelizeMirror so backfill / reconnect code
// paths can be exercised without a live MySQL instance. null means "use the
// real config value".
let mirrorEnabledTestOverride = null;

// Track the last observed auth outcome so we can detect a transition from
// "disconnected" back to "connected" and trigger a catch-up backfill. This
// recovers writes (INSERT/UPDATE) and deletes that were dropped during an
// outage because safeMirrorDbHandler is fire-and-forget and silently drops
// its callback when authenticate() fails.
let mirrorAuthState = 'unknown'; // 'unknown' | 'connected' | 'disconnected'

// Tracks whether the MySQL-side setup (CREATE DATABASE + migrations)
// succeeded. Set by prepareMysqlMirror. If it failed at startup (e.g. MySQL
// not yet reachable), we treat the first successful runtime authenticate
// as a reconnect so the setup is retried and the initial backfill runs.
let mirrorSetupSucceeded = false;

// Concurrency guard for prepareMysqlMirror - only one attempt at a time.
let mirrorSetupPromise = null;

// Single in-flight reconnect backfill. Concurrent callers share the same
// promise so we don't run multiple backfills in parallel, and writes issued
// after the reconnect are serialized behind it so the mirror is caught up
// before new operations are applied.
let reconnectBackfillPromise = null;

export const mirrorDBEnabled = () => {
  if (mirrorEnabledTestOverride !== null) {
    return mirrorEnabledTestOverride;
  }
  const CONFIG = getConfig();
  // In production-like mode ('local' env), require full MySQL config.
  // In SQLite-fallback test mode ('mirrorTest' env), leave the mirror
  // enabled unconditionally so integration tests that rely on the
  // SQLite fallback mirror continue to see their writes land.
  //
  // Asymmetry note: V2's mirrorDBEnabledV2() is stricter - it returns
  // false in SQLite-fallback test mode, and V2 tests opt in via
  // __setMirrorEnabledForTestsV2. V1 integration tests predate that
  // pattern and rely on the implicit test-mode enablement here.
  //
  // The cost of the on-startup backfill iterating all 11 table pairs
  // is gated separately in prepareDb() via
  // isMysqlMirrorConfiguredForReconnect(), not via mirrorDBEnabled(),
  // so the backfill only fires when MySQL is actually configured.
  if (
    mirrorConfig === 'mirror' &&
    (!CONFIG?.MIRROR_DB?.DB_HOST ||
      !CONFIG?.MIRROR_DB?.DB_NAME ||
      !CONFIG?.MIRROR_DB?.DB_USERNAME ||
      !CONFIG?.MIRROR_DB?.DB_PASSWORD)
  ) {
    return false;
  }
  return true;
};

// Test-only. DO NOT call from production code. Passing `null` restores the
// real config-driven behaviour. See mirrorEnabledTestOverride above.
export const __setMirrorEnabledForTests = (value) => {
  mirrorEnabledTestOverride = value;
};

// Test-only. DO NOT call from production code. Signals to the reconnect
// path whether the one-time MySQL setup (CREATE DATABASE + migrations) has
// succeeded. In production this is set to true by prepareMysqlMirror.
export const __setMirrorSetupSucceededForTests = (value) => {
  mirrorSetupSucceeded = value;
};

/**
 * Ensure the V1 MySQL mirror database exists and has up-to-date migrations.
 * Idempotent: safe to call from startup and again on every reconnect.
 *
 * Returns true on success, false on failure. Never throws so it won't take
 * down the main database path.
 */
export const prepareMysqlMirror = async () => {
  if (mirrorSetupPromise) {
    return mirrorSetupPromise;
  }

  mirrorSetupPromise = (async () => {
    const CONFIG = getConfig();
    const mirrorDbConfig = CONFIG?.MIRROR_DB;
    if (
      !mirrorDbConfig?.DB_HOST ||
      mirrorDbConfig.DB_HOST === '' ||
      !mirrorDbConfig.DB_NAME ||
      !mirrorDbConfig.DB_USERNAME ||
      !mirrorDbConfig.DB_PASSWORD
    ) {
      return false;
    }

    try {
      const connection = await mysql.createConnection({
        host: mirrorDbConfig.DB_HOST,
        port: 3306,
        user: mirrorDbConfig.DB_USERNAME,
        password: mirrorDbConfig.DB_PASSWORD,
      });

      try {
        await connection.query(
          `CREATE DATABASE IF NOT EXISTS \`${mirrorDbConfig.DB_NAME}\`;`,
        );
      } finally {
        await connection.end();
      }

      // checkForMigrations is idempotent (it checks SequelizeMeta), so it's
      // safe to re-run on every reconnect.
      await checkForMigrations(sequelizeMirror);
      mirrorSetupSucceeded = true;
      return true;
    } catch (error) {
      logger.error(
        `Error setting up MySQL mirror database: ${error.message}`,
      );
      return false;
    }
  })().finally(() => {
    mirrorSetupPromise = null;
  });

  return mirrorSetupPromise;
};

// Returns true if V1.MIRROR_DB is fully configured with MySQL credentials.
// Used to gate reconnect-setup retries - only MySQL configs need the setup
// retry path; SQLite test fallbacks never need it.
const isMysqlMirrorConfiguredForReconnect = () => {
  const CONFIG = getConfig();
  return !!(
    CONFIG?.MIRROR_DB?.DB_HOST &&
    CONFIG.MIRROR_DB.DB_HOST !== '' &&
    CONFIG.MIRROR_DB.DB_NAME &&
    CONFIG.MIRROR_DB.DB_USERNAME &&
    CONFIG.MIRROR_DB.DB_PASSWORD
  );
};

const startReconnectBackfill = () => {
  if (reconnectBackfillPromise) {
    return reconnectBackfillPromise;
  }
  reconnectBackfillPromise = (async () => {
    try {
      logger.info('Mirror DB reconnected, running catch-up recovery...');

      // If setup (CREATE DATABASE + migrations) never succeeded (e.g. MySQL
      // was down at CADT startup), retry it before backfill. Only applies
      // to MySQL configurations - SQLite test fallbacks don't need setup
      // retries and don't have config to retry against.
      if (!mirrorSetupSucceeded && isMysqlMirrorConfiguredForReconnect()) {
        const ok = await prepareMysqlMirror();
        if (!ok) {
          logger.error(
            'Reconnect recovery: mirror setup still failing, backfill skipped',
          );
          // Keep auth state as 'disconnected' so the next successful
          // authenticate re-enters this path and retries setup+backfill.
          mirrorAuthState = 'disconnected';
          return;
        }
      }

      if (!mirrorSetupSucceeded) {
        // SQLite test fallback path never marked setup complete and has no
        // MySQL to retry against. Skip the backfill quietly - there's
        // nothing to reconnect to.
        return;
      }

      await backfillMirror();
    } catch (error) {
      logger.error(`Reconnect backfill failed: ${error.message}`);
      // Mark disconnected so the next authenticate success retries the
      // catch-up. Without this reset, a transient backfill failure would
      // leave the mirror permanently behind until the NEXT real outage.
      mirrorAuthState = 'disconnected';
    } finally {
      reconnectBackfillPromise = null;
    }
  })();
  return reconnectBackfillPromise;
};

export const safeMirrorDbHandler = (callback) => {
  if (!mirrorDBEnabled()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      sequelizeMirror
        .authenticate()
        .then(async () => {
          const wasDisconnected = mirrorAuthState === 'disconnected';
          // If MySQL setup never succeeded at startup (e.g. MySQL was down
          // when prepareDb ran), the first successful authenticate needs
          // to re-run setup + backfill even though we were never in an
          // explicit 'disconnected' state. Only applies when MySQL is
          // actually configured - the SQLite test fallback doesn't need a
          // reconnect path and would otherwise spam recovery logs on every
          // model write during tests.
          const setupNeverRan =
            !mirrorSetupSucceeded && isMysqlMirrorConfiguredForReconnect();
          mirrorAuthState = 'connected';

          if (wasDisconnected || setupNeverRan) {
            await startReconnectBackfill();
          } else if (reconnectBackfillPromise) {
            // Another concurrent caller already triggered the backfill;
            // wait for it so our write lands on a caught-up mirror.
            await reconnectBackfillPromise;
          }

          try {
            await callback();
          } catch (e) {
            logger.error(`mirror_error:${e.message}`);
          }
        })
        .catch(() => {
          mirrorAuthState = 'disconnected';
          logDebounce();
        });
    } catch (error) {
      logger.error(
        'MirrorDB tried to update before it was initialize, will try again later',
        error,
      );
    } finally {
      resolve();
    }
  });
};

// Initialize a V1 mirror Sequelize Model synchronously at module-load time.
//
// Model.init() only registers schema metadata on the Sequelize instance; it
// does not require a live database connection. Gating init on a successful
// authenticate() (as safeMirrorDbHandler does for runtime operations) causes
// a silent, permanent failure when the MySQL sidecar is not yet reachable at
// CADT startup: the .then() callback never runs, the model is never
// initialized, and every subsequent mirror write throws
// "Cannot read properties of undefined (reading 'constructor')" from within
// Sequelize (this.sequelize is undefined on an uninitialized Model).
//
// Runtime writes continue to be gated through safeMirrorDbHandler, which
// authenticates on each call and short-circuits cleanly when MySQL is down
// and transparently resumes when the connection pool recovers.
export const initMirrorModel = (initFn) => {
  try {
    initFn();
  } catch (error) {
    logger.error(`Failed to initialize mirror model: ${error.message}`);
  }
};

/**
 * Backfill MySQL mirror database from SQLite source data.
 *
 * Runs on startup and on every reconnect after a connection outage. For each
 * source/mirror pair this performs two passes:
 *   1. Upsert pass: bulkCreate(updateOnDuplicate) inserts missing rows and
 *      updates stale rows. This recovers inserts and updates that happened
 *      while the mirror was unreachable.
 *   2. Orphan sweep: rows present in mirror but no longer in source are
 *      deleted. This recovers deletes that happened while the mirror was
 *      unreachable (deletes are otherwise lost because the fire-and-forget
 *      safeMirrorDbHandler silently drops operations during an outage).
 *
 * Ordering matters for the orphan sweep: mirror PKs are snapshotted BEFORE
 * source PKs so rows inserted concurrently are not misclassified as orphans.
 *
 * Uses dynamic imports to avoid circular dependency (model files import from
 * this file).
 */
const BACKFILL_BATCH_SIZE = 1000;

const sweepMirrorOrphans = async (source, mirror, name) => {
  const pkAttrs = mirror.primaryKeyAttributes;
  if (!pkAttrs || pkAttrs.length !== 1) {
    logger.debug(
      `Mirror backfill: ${name} - skipping orphan sweep (composite or missing primary key)`,
    );
    return 0;
  }
  const pkAttr = pkAttrs[0];

  // Concurrency invariant: mirror is scanned BEFORE source. A row
  // inserted concurrently (after the mirror page fetch, before or
  // during the source page fetch) will be absent from orphanCandidates
  // and thus cannot be misclassified as an orphan. A row inserted
  // before the mirror scan and deleted from source during the scan is
  // a true orphan and will be correctly removed. Reversing the order
  // would allow false-positive orphan deletes for rows inserted into
  // both tables during the sweep.
  //
  // Both scans are keyset-paginated. An earlier revision loaded every
  // PK from both tables in a single unbounded findAll; this is fine
  // for today's row counts but spikes memory on long-running
  // deployments with large tables. Peak memory here is O(|mirror|) for
  // the candidate set; the source side is streamed.
  //
  // `raw: true` is safe here - the projection is PK-only, so there are
  // no DATE or custom-getter columns whose raw SQLite representation
  // could leak into a bulk write (the hazard backfillMirror avoids).
  const orphanCandidates = new Set();
  let lastMirrorPk = null;
  while (true) {
    const where =
      lastMirrorPk === null
        ? undefined
        : { [pkAttr]: { [Sequelize.Op.gt]: lastMirrorPk } };
    const page = await mirror.findAll({
      attributes: [pkAttr],
      where,
      limit: BACKFILL_BATCH_SIZE,
      order: [[pkAttr, 'ASC']],
      raw: true,
    });
    if (page.length === 0) break;
    for (const r of page) orphanCandidates.add(r[pkAttr]);
    lastMirrorPk = page[page.length - 1][pkAttr];
    if (lastMirrorPk == null) break;
    if (page.length < BACKFILL_BATCH_SIZE) break;
  }

  if (orphanCandidates.size === 0) return 0;

  let lastSrcPk = null;
  while (true) {
    const where =
      lastSrcPk === null
        ? undefined
        : { [pkAttr]: { [Sequelize.Op.gt]: lastSrcPk } };
    const page = await source.findAll({
      attributes: [pkAttr],
      where,
      limit: BACKFILL_BATCH_SIZE,
      order: [[pkAttr, 'ASC']],
      raw: true,
    });
    if (page.length === 0) break;
    for (const r of page) orphanCandidates.delete(r[pkAttr]);
    lastSrcPk = page[page.length - 1][pkAttr];
    if (lastSrcPk == null) break;
    if (page.length < BACKFILL_BATCH_SIZE) break;
  }

  if (orphanCandidates.size === 0) return 0;

  const orphans = [...orphanCandidates];
  let removed = 0;
  for (let i = 0; i < orphans.length; i += BACKFILL_BATCH_SIZE) {
    const batch = orphans.slice(i, i + BACKFILL_BATCH_SIZE);
    removed += await mirror.destroy({ where: { [pkAttr]: batch } });
  }

  logger.info(`Mirror backfill: ${name} - removed ${removed} orphan rows`);
  return removed;
};

export const backfillMirror = async () => {
  if (!mirrorDBEnabled()) {
    return;
  }

  logger.info('Starting MySQL mirror backfill from SQLite...');

  try {
    // Dynamic import of the models barrel to avoid circular dependency:
    // V1 model files statically import { sequelizeMirror, safeMirrorDbHandler }
    // from this file, so a static import of the models here would introduce
    // a module cycle. Dynamic import lets Node fully resolve the V1 model
    // graph (including cross-model associations in src/models/index.js)
    // before we reference any model class.
    // eslint-disable-next-line no-restricted-syntax -- see comment above
    const models = await import('../models/index.js');

    // Mirrors are not all re-exported through the barrel today, so import
    // each mirror file directly. Same circular-dep rationale applies.
    /* eslint-disable no-restricted-syntax -- dynamic imports intentional; see comment above */
    const [
      { ProjectMirror },
      { CoBenefitMirror },
      { ProjectLocationMirror },
      { LabelMirror },
      { RatingMirror },
      { RelatedProjectMirror },
      { UnitMirror },
      { IssuanceMirror },
      { EstimationMirror },
      { LabelUnitMirror },
      { AuditMirror },
    ] = await Promise.all([
      import('../models/projects/projects.model.mirror.js'),
      import('../models/co-benefits/co-benefits.model.mirror.js'),
      import('../models/locations/locations.model.mirror.js'),
      import('../models/labels/labels.model.mirror.js'),
      import('../models/ratings/ratings.model.mirror.js'),
      import('../models/related-projects/related-projects.model.mirror.js'),
      import('../models/units/units.model.mirror.js'),
      import('../models/issuances/issuances.model.mirror.js'),
      import('../models/estimations/estimations.model.mirror.js'),
      import('../models/labelUnits/labelUnits.model.mirror.js'),
      import('../models/audit/audit.model.mirror.js'),
    ]);
    /* eslint-enable no-restricted-syntax */

    const mirrorPairs = [
      { source: models.Project, mirror: ProjectMirror, name: 'project' },
      { source: models.CoBenefit, mirror: CoBenefitMirror, name: 'co_benefit' },
      { source: models.ProjectLocation, mirror: ProjectLocationMirror, name: 'location' },
      { source: models.Label, mirror: LabelMirror, name: 'label' },
      { source: models.Rating, mirror: RatingMirror, name: 'rating' },
      { source: models.RelatedProject, mirror: RelatedProjectMirror, name: 'related_project' },
      { source: models.Unit, mirror: UnitMirror, name: 'unit' },
      { source: models.Issuance, mirror: IssuanceMirror, name: 'issuance' },
      { source: models.Estimation, mirror: EstimationMirror, name: 'estimation' },
      { source: models.LabelUnit, mirror: LabelUnitMirror, name: 'label_unit' },
      { source: models.Audit, mirror: AuditMirror, name: 'audit' },
    ];

    let totalSynced = 0;
    let totalOrphansRemoved = 0;

    for (const { source, mirror, name } of mirrorPairs) {
      try {
        if (!mirror.rawAttributes || Object.keys(mirror.rawAttributes).length === 0) {
          logger.warn(`Mirror backfill: ${name} - mirror model not initialized, skipping`);
          continue;
        }

        // Orphan sweep first (mirror snapshot before source snapshot) so
        // concurrent inserts aren't wrongly classified as orphans.
        const orphansRemoved = await sweepMirrorOrphans(source, mirror, name);
        totalOrphansRemoved += orphansRemoved;

        const updateFields = Object.keys(mirror.rawAttributes).filter(
          (attr) => !mirror.primaryKeyAttributes.includes(attr),
        );

        // Keyset pagination (WHERE pk > :lastSeenPk ORDER BY pk ASC LIMIT N)
        // instead of offset-based. Offset pagination under concurrent
        // writes can silently skip rows: a delete at position N shifts
        // later rows down, so the next page's OFFSET lands one row later
        // than intended. Keyset pagination avoids that page-shift-on-delete
        // hazard by using a lower-bound predicate instead of a position
        // count.
        //
        // Note: keyset pagination is NOT immune to concurrent INSERTs with
        // a PK less than `lastPk`. Such rows will be missed in the current
        // pass but picked up by the next reconnect backfill. A subsequent
        // steady-state safeMirrorDbHandler write also directly upserts
        // them, so the miss window is bounded.
        //
        // Requires a single-column comparable PK. Composite-PK models fall
        // back to a single unordered bulk read - safer than a wrong-order
        // keyset walk. No V1 models currently use composite PKs, and the
        // single-PK invariant is asserted at load time by
        // mirror-model-init.spec.js.
        const pkAttrs = mirror.primaryKeyAttributes || [];

        let synced = 0;
        if (pkAttrs.length === 1) {
          const pk = pkAttrs[0];
          let lastPk = null;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const where =
              lastPk === null ? undefined : { [pk]: { [Sequelize.Op.gt]: lastPk } };
            // NOTE: Do NOT pass `raw: true` to findAll. With raw:true
            // Sequelize returns SQLite values as-stored (strings),
            // including DATE columns as "YYYY-MM-DD HH:mm:ss.SSS +00:00".
            // Forwarding those strings verbatim to MariaDB's bulkCreate
            // triggers strict-mode "Incorrect datetime value" rejections.
            // Building model instances runs sqlite.DATE.parse so DATE
            // columns become real Date objects; mysql.DATE then serialises
            // them in the MariaDB-safe "YYYY-MM-DD HH:mm:ss" format.
            //
            // `.get({ plain: true, raw: true })` extracts dataValues
            // directly (bypassing any attribute-level `get()` accessors
            // a source model may define). Dates remain Date objects on
            // dataValues because the sqlite parser runs during instance
            // construction, not at get() time.
            const instances = await source.findAll({
              where,
              limit: BACKFILL_BATCH_SIZE,
              order: [[pk, 'ASC']],
            });
            if (instances.length === 0) break;
            const rows = instances.map((r) =>
              r.get({ plain: true, raw: true }),
            );
            await mirror.bulkCreate(rows, { updateOnDuplicate: updateFields });
            synced += rows.length;
            lastPk = rows[rows.length - 1][pk];
            // Defensive: a null/undefined terminal PK means we can't
            // continue the keyset walk safely (Op.gt: undefined is
            // ill-defined and would loop on the same page). Stop the
            // walk; subsequent reconnects will retry from scratch.
            if (lastPk == null) {
              logger.warn(
                `Mirror backfill: ${name} - terminal row had null PK; ` +
                  `stopping keyset walk early (${synced} rows synced).`,
              );
              break;
            }
            if (rows.length < BACKFILL_BATCH_SIZE) break;
          }
        } else {
          // Composite-PK mirrors are not supported by keyset-paginated
          // backfill. mirror-model-init.spec.js asserts every current
          // mirror has a single-column PK; if someone introduces a
          // composite-PK mirror without extending this function, fail
          // loudly (caught by the per-table try/catch) rather than
          // silently loading the whole table into memory.
          throw new Error(
            `Mirror backfill: ${name} has a composite primary key ` +
              `(${pkAttrs.join(', ')}). Keyset pagination needs a ` +
              `single-column comparable PK. Either reduce to a single-column ` +
              `PK, or extend backfillMirror to handle composite keys.`,
          );
        }

        if (synced === 0) {
          logger.debug(`Mirror backfill: ${name} - no records to sync`);
        } else {
          logger.info(`Mirror backfill: ${name} - synced ${synced} records`);
        }
        totalSynced += synced;
      } catch (error) {
        logger.error(`Mirror backfill error for ${name}: ${error.message}`);
        // Continue with next table - don't let one failure stop the entire backfill
      }
    }

    logger.info(
      `MySQL mirror backfill completed - ${totalSynced} records upserted, ${totalOrphansRemoved} orphan rows removed`,
    );
  } catch (error) {
    logger.error(
      `MySQL mirror backfill failed: ${error?.message || error?.name || 'unknown error'}`,
    );
    logger.debug(error?.stack || error);
    // Don't throw - allow main database to continue operating
  }
};

export const sanitizeSqliteFtsQuery = (query) => {
  query = query.replace(/[-](?=.*[-])/g, '+'); // Replace all but the final dash
  query = query.replace('-', ''); //Replace the final dash with nothing
  query = query.replace(/([.?*+^$[\]\\(){}|-])/g, '"$1"');
  query += '*'; // Query should end with asterisk for partial matching
  return query;
};

export const seedDb = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    for (let i = 0; i < seeders.length; i++) {
      const seeder = seeders[i];
      logger.info(`SEEDING: ${seeder.name}`, seeder);
      await seeder.seed.up(queryInterface, Sequelize);
    }
  } catch (error) {
    logger.error('Error seeding data', error);
  }
};

export const checkForMigrations = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    await queryInterface.createTable('SequelizeMeta', {
      name: Sequelize.STRING,
    });

    const completedMigrations = await db.query(
      'SELECT * FROM `SequelizeMeta`',
      {
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const notCompletedMigrations = migrations.filter((migration) => {
      return !completedMigrations
        .map((complete) => complete.name)
        .includes(migration.name);
    });

    for (let i = 0; i < notCompletedMigrations.length; i++) {
      try {
        const notCompleted = notCompletedMigrations[i];
        logger.info(`MIGRATING: ${notCompleted.name}`);
        await notCompleted.migration.up(db.queryInterface, Sequelize);
        await db.query('INSERT INTO `SequelizeMeta` VALUES(:name)', {
          type: Sequelize.QueryTypes.INSERT,
          replacements: { name: notCompleted.name },
        });
      } catch (e) {
        logger.error('Migration not completed', e);
      }
    }
  } catch (error) {
    logger.error('Error checking for migrations', error);
  }
};

export const prepareDb = async () => {
  const envMirrorConfig =
    (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';

  if (
    envMirrorConfig == 'mirror' &&
    getConfig().MIRROR_DB?.DB_HOST &&
    getConfig().MIRROR_DB.DB_HOST !== ''
  ) {
    // Non-fatal: mirror DB failure should not block main database startup.
    // When the mirror becomes reachable later, safeMirrorDbHandler will
    // detect the reconnect and trigger a catch-up backfill automatically.
    await prepareMysqlMirror();
  } else if (envMirrorConfig == 'mirrorTest') {
    // SQLite fallback used in unit/integration tests (NODE_ENV=test). The
    // DB is always reachable so migrations run directly. Marking setup as
    // succeeded prevents safeMirrorDbHandler from treating the first
    // authenticate as a reconnect and spamming the "reconnect recovery"
    // log for every model write during tests.
    await checkForMigrations(sequelizeMirror);
    mirrorSetupSucceeded = true;
  }

  await checkForMigrations(sequelize);

  // Run the mirror backfill after main migrations so all source and
  // mirror tables exist. This catches up rows that were inserted/
  // updated/deleted while the mirror was unavailable on a previous run.
  //
  // Gate on isMysqlMirrorConfiguredForReconnect() (MySQL mode only) so
  // SQLite-fallback test startups don't iterate all 11 source/mirror
  // table pairs on every run. Tests that need the backfill code path
  // exercised call backfillMirror() directly with
  // __setMirrorSetupSucceededForTests and __setMirrorEnabledForTests
  // to opt in.
  if (mirrorSetupSucceeded && isMysqlMirrorConfiguredForReconnect()) {
    await backfillMirror();
  }
};

// Function to set WAL mode
async function setWALMode() {
  try {
    await sequelize.authenticate();
    await sequelize.query('PRAGMA journal_mode=WAL;', { type: QueryTypes.RAW });
    console.log('WAL mode set successfully.');
  } catch (error) {
    console.error('Unable to set WAL mode:', error);
  }
}

setWALMode();
