import { expect } from 'chai';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import {
  prepareDb,
  sequelize,
  sequelizeMirror,
  checkForMigrations,
  backfillMirror,
  __setMirrorEnabledForTests,
  __setMirrorSetupSucceededForTests,
  __setMysqlConfiguredForReconnectForTests,
  __resetMirrorAuthStateForTests,
} from '../../src/database/index.js';
import { logger } from '../../src/config/logger.js';
import { Project } from '../../src/models/index.js';
import { ProjectMirror } from '../../src/models/projects/projects.model.mirror.js';

/**
 * V1 Mirror Backfill Dedupe + In-Sync Gate Tests
 *
 * Companions to mirror-reconnect.spec.js. These cover two correctness +
 * cost-control additions to backfillMirror():
 *
 *   1. In-flight memoization: concurrent backfillMirror() callers share a
 *      single in-flight promise instead of each pulling and upserting the
 *      entire dataset. Eliminates the parallel-backfill race observed in
 *      production logs where each "synced N records" line was emitted
 *      twice with matching totals on the same boot.
 *
 *   2. Cheap in-sync gate: per-table COUNT(*) + MAX(updatedAt) probe that
 *      short-circuits the orphan sweep + bulk upsert when the mirror is
 *      clearly already caught up. Falls through to the existing full
 *      sync on any mismatch so outage-recovery semantics are preserved.
 *
 *   3. Module-load hygiene: V1 model `associate()` methods no longer call
 *      sequelizeMirror.authenticate() via safeMirrorDbHandler. That call
 *      was the trigger for #1 in production (eager import via
 *      src/middleware.js loaded models/index.js, ran every associate(),
 *      authenticated against the mirror, and tripped the reconnect path
 *      concurrently with prepareDb's own backfill).
 *
 * In test mode the mirror is normally disabled (no MySQL), so each spec
 * uses __setMirrorEnabledForTests(true) to drive the real code paths
 * against the SQLite fallback mirror.
 */
describe('Mirror Backfill Dedupe + In-Sync Gate (V1)', function () {
  this.timeout(60000);

  before(async function () {
    await prepareDb();
    await checkForMigrations(sequelizeMirror);
  });

  beforeEach(function () {
    __setMirrorEnabledForTests(true);
    __setMirrorSetupSucceededForTests(true);
  });

  afterEach(async function () {
    __setMirrorEnabledForTests(null);
    __setMirrorSetupSucceededForTests(false);
    __setMysqlConfiguredForReconnectForTests(null);
    __resetMirrorAuthStateForTests();
    sinon.restore();

    for (const t of ['projects']) {
      try {
        await sequelize.query(`DELETE FROM ${t}`);
      } catch {
        /* ignore */
      }
      try {
        await sequelizeMirror.query(`DELETE FROM ${t}`);
      } catch {
        /* ignore */
      }
    }
  });

  // Helpers reused across multiple specs below. Raw-SQL inserts bypass
  // the fire-and-forget mirror writer so test setup is deterministic.
  const insertProjectInto = async (target, { id, name, orgUid, when }) => {
    const sql = `INSERT INTO projects
        (warehouseProjectId, orgUid, currentRegistry, projectId, originProjectId,
         registryOfOrigin, projectName, createdAt, updatedAt)
      VALUES (:id, :orgUid, 'Test Registry', 'PRJ-001', 'PRJ-001',
              'Test Registry', :name, :when, :when)`;
    await target.query(sql, {
      replacements: { id, name, orgUid, when },
      type: Sequelize.QueryTypes.INSERT,
    });
  };

  // Count the "Starting MySQL mirror backfill from SQLite..." entry-point
  // log line emitted by backfillMirror(). Used to assert that two
  // concurrent callers actually share a single run.
  const countStartingLogs = (loggerSpy) =>
    loggerSpy
      .getCalls()
      .filter((call) =>
        /Starting MySQL mirror backfill from SQLite/.test(
          String(call.args[0] ?? ''),
        ),
      ).length;

  describe('In-flight memoization', function () {
    it('coalesces concurrent backfillMirror() calls into a single run', async function () {
      // Seed a row that only exists in source so the backfill has real
      // work to do (gate fails -> full sync). This proves the
      // memoization isn't just trivially short-circuiting because both
      // calls hit the empty-table gate path.
      const orgUid = uuidv4();
      const id = uuidv4();
      await insertProjectInto(sequelize, {
        id,
        name: 'Dedupe Row',
        orgUid,
        when: '2026-01-01 00:00:00',
      });

      const loggerSpy = sinon.spy(logger, 'info');

      // Fire two calls without awaiting. The second must join the first
      // in-flight promise, not start a new run.
      const p1 = backfillMirror();
      const p2 = backfillMirror();
      await Promise.all([p1, p2]);

      const starts = countStartingLogs(loggerSpy);
      expect(
        starts,
        'two concurrent backfillMirror() calls must share a single run',
      ).to.equal(1);

      const mirrorRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: id },
      });
      expect(mirrorRow, 'shared run still recovers the missing row').to.not.be
        .null;
    });

    it('runs a fresh backfill on a subsequent serial call', async function () {
      const loggerSpy = sinon.spy(logger, 'info');

      await backfillMirror();
      await backfillMirror();

      const starts = countStartingLogs(loggerSpy);
      expect(
        starts,
        'sequential (non-overlapping) calls must each run a fresh backfill',
      ).to.equal(2);
    });
  });

  describe('In-sync gate', function () {
    it('skips the bulk upsert when source and mirror match', async function () {
      // Seed an identical row into both sides with the same timestamps
      // so the gate triggers: count(source) === count(mirror) AND
      // max(updatedAt) on mirror >= source.
      const id = uuidv4();
      const orgUid = uuidv4();
      const when = '2026-01-01 12:00:00';

      await insertProjectInto(sequelize, {
        id,
        name: 'Synced',
        orgUid,
        when,
      });
      await insertProjectInto(sequelizeMirror, {
        id,
        name: 'Synced',
        orgUid,
        when,
      });

      // Sequelize routes bulk upserts through Model.bulkCreate; the gate
      // only short-circuits when it doesn't reach this call.
      const bulkCreateSpy = sinon.spy(ProjectMirror, 'bulkCreate');

      await backfillMirror();

      expect(
        bulkCreateSpy.called,
        'gate must short-circuit before reaching ProjectMirror.bulkCreate when source and mirror are identical',
      ).to.equal(false);

      // Sanity: the row is still present in the mirror (we didn't break it).
      const mirrorRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: id },
      });
      expect(mirrorRow, 'gate must not delete or modify rows').to.not.be.null;
    });

    it('falls through to the full sync when counts mismatch', async function () {
      // Source has one row, mirror has none. Counts differ -> gate fails
      // -> full sync runs -> mirror gets the row.
      const id = uuidv4();
      const orgUid = uuidv4();
      await insertProjectInto(sequelize, {
        id,
        name: 'Drift',
        orgUid,
        when: '2026-01-01 00:00:00',
      });

      await backfillMirror();

      const mirrorRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: id },
      });
      expect(
        mirrorRow,
        'count mismatch must fall through to full sync and recover the row',
      ).to.not.be.null;
    });

    it('falls through to the full sync when mirror max(updatedAt) is older than source', async function () {
      // Both sides have the same row count, but source has a newer
      // updatedAt - simulates an UPDATE in source that the mirror missed.
      // The gate must NOT short-circuit; the full sync must propagate the
      // source's newer values into the mirror.
      const id = uuidv4();
      const orgUid = uuidv4();

      await insertProjectInto(sequelize, {
        id,
        name: 'Updated In Source',
        orgUid,
        when: '2026-02-01 00:00:00',
      });
      await insertProjectInto(sequelizeMirror, {
        id,
        name: 'Stale In Mirror',
        orgUid,
        when: '2026-01-01 00:00:00',
      });

      await backfillMirror();

      const mirrorRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: id },
      });
      expect(mirrorRow).to.not.be.null;
      expect(
        mirrorRow.projectName,
        'stale mirror updatedAt must trigger full sync and propagate new value',
      ).to.equal('Updated In Source');
    });

    it('recovers from PK-swap drift (delete + insert preserving count and max)', async function () {
      // Regression for PR review: an outage where one row was deleted
      // and another inserted, with the new row's updatedAt landing
      // below the table's existing global MAX, preserves both row
      // count and MAX(updatedAt). A gate that runs before the orphan
      // sweep would short-circuit on those matching aggregates and
      // leave the mirror with a stale row identity. The orphan sweep
      // must therefore run UNCONDITIONALLY before the gate so this
      // drift becomes visible via the post-sweep count mismatch and
      // falls through to the full upsert.
      const orgUid = uuidv4();
      const newestId = uuidv4(); // A: global-max updatedAt, present on both
      const orphanId = uuidv4(); // B: still in mirror only
      const replacementId = uuidv4(); // C: now in source only, older updatedAt

      // Seed A and B on both sides.
      await insertProjectInto(sequelize, {
        id: newestId,
        name: 'Newest A',
        orgUid,
        when: '2026-03-01 00:00:00',
      });
      await insertProjectInto(sequelizeMirror, {
        id: newestId,
        name: 'Newest A',
        orgUid,
        when: '2026-03-01 00:00:00',
      });
      await insertProjectInto(sequelize, {
        id: orphanId,
        name: 'Doomed B',
        orgUid,
        when: '2026-01-01 00:00:00',
      });
      await insertProjectInto(sequelizeMirror, {
        id: orphanId,
        name: 'Doomed B',
        orgUid,
        when: '2026-01-01 00:00:00',
      });

      // Outage: source deletes B and inserts C with a timestamp
      // strictly below A's. After this, both sides still have 2 rows
      // and the same MAX(updatedAt) = A's timestamp.
      await sequelize.query(
        `DELETE FROM projects WHERE warehouseProjectId = :id`,
        { replacements: { id: orphanId }, type: Sequelize.QueryTypes.DELETE },
      );
      await insertProjectInto(sequelize, {
        id: replacementId,
        name: 'Replacement C',
        orgUid,
        when: '2026-02-01 00:00:00',
      });

      await backfillMirror();

      const orphanRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: orphanId },
      });
      const replacementRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: replacementId },
      });
      expect(orphanRow, 'orphan sweep must remove the row deleted from source')
        .to.be.null;
      expect(
        replacementRow,
        'upsert must insert the replacement row that drifted in under MAX(updatedAt)',
      ).to.not.be.null;
      expect(replacementRow.projectName).to.equal('Replacement C');
    });

    // Note: there's no test here for the "both sides have rows but
    // MAX(updatedAt) is null" hazard flagged in review (where the gate
    // could misclassify a populated table as empty). The defensive
    // guard in isMirrorInSync (require sourceCount === 0 for the
    // empty-table skip) is in place, but every V1 mirror model in
    // CADT today has NOT NULL on updatedAt via Sequelize's
    // `timestamps: true` default, so SQLite rejects any attempt to
    // insert or update a row with a null updatedAt. The guard remains
    // as forward-compat protection if a future model opts out of that
    // constraint.
  });

  describe('Module-load hygiene', function () {
    it('Project.associate() does not call sequelizeMirror.authenticate()', function () {
      // Regression guard for the parallel-backfill race: associate()
      // used to wrap mirror association wiring in safeMirrorDbHandler(),
      // which authenticated against the mirror at module-load time and
      // tripped the setupNeverRan reconnect path. The fix moved those
      // associations behind a synchronous mirrorDBEnabled() check that
      // does no I/O. Calling associate() again here proves the no-I/O
      // property: Sequelize associations are additive metadata and
      // re-attaching is harmless.
      const authSpy = sinon.spy(sequelizeMirror, 'authenticate');

      Project.associate();

      expect(
        authSpy.called,
        'Project.associate() must not authenticate against the mirror at module load',
      ).to.equal(false);
    });
  });
});
