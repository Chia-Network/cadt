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
  safeMirrorDbHandler,
  __setMirrorEnabledForTests,
  __setMirrorSetupSucceededForTests,
} from '../../src/database/index.js';
import { ProjectMirror } from '../../src/models/projects/projects.model.mirror.js';

/**
 * Mirror Reconnect + Orphan Sweep Tests (V1)
 *
 * These tests exercise the outage-recovery additions to the V1 mirror:
 *
 *   1. backfillMirror (new for V1) runs at startup and on every reconnect
 *      after an outage. It upserts missing/stale rows and sweeps orphan
 *      rows (mirror rows whose primary key no longer exists in source).
 *
 *   2. safeMirrorDbHandler detects a reconnect and runs backfillMirror
 *      before applying the current callback. Concurrent callers join the
 *      same in-flight backfill promise.
 *
 * In test mode, mirrorDBEnabled() normally returns false (no MySQL) so
 * backfill and the handler short-circuit. These tests use
 * __setMirrorEnabledForTests(true) to drive the real code paths against
 * the local SQLite fallback (sequelizeMirror / mirrorTest) without
 * requiring a live MySQL instance.
 */
describe('Mirror Reconnect and Orphan Sweep (V1)', function () {
  this.timeout(60000);

  before(async function () {
    await prepareDb();
    await checkForMigrations(sequelizeMirror);
  });

  beforeEach(function () {
    __setMirrorEnabledForTests(true);
    // Pretend the one-time MySQL setup (CREATE DATABASE + migrations) has
    // already succeeded so the reconnect path only performs the backfill.
    __setMirrorSetupSucceededForTests(true);
  });

  afterEach(async function () {
    __setMirrorEnabledForTests(null);
    __setMirrorSetupSucceededForTests(false);
    sinon.restore();

    // Clean both databases between tests. We clear a minimal set of tables
    // touched by these tests to keep the cleanup fast.
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

  // Insert a project row into both source and mirror via raw SQL so the
  // fire-and-forget mirror writer doesn't interfere with test setup.
  const insertProjectIntoBoth = async ({ id, name, orgUid }) => {
    const sql = `INSERT INTO projects
        (warehouseProjectId, orgUid, currentRegistry, projectId, originProjectId,
         registryOfOrigin, projectName, createdAt, updatedAt)
      VALUES (:id, :orgUid, 'Test Registry', 'PRJ-001', 'PRJ-001',
              'Test Registry', :name, datetime('now'), datetime('now'))`;
    const opts = {
      replacements: { id, name, orgUid },
      type: Sequelize.QueryTypes.INSERT,
    };
    await sequelize.query(sql, opts);
    await sequelizeMirror.query(sql, opts);
  };

  const deleteSourceProjectOnly = async (id) => {
    await sequelize.query(
      `DELETE FROM projects WHERE warehouseProjectId = :id`,
      { replacements: { id }, type: Sequelize.QueryTypes.DELETE },
    );
  };

  describe('Orphan sweep', function () {
    it('should delete mirror rows whose primary key is no longer in source', async function () {
      const keepId = uuidv4();
      const deleteId = uuidv4();
      const orgUid = uuidv4();

      await insertProjectIntoBoth({ id: keepId, name: 'Keep', orgUid });
      await insertProjectIntoBoth({
        id: deleteId,
        name: 'To Delete',
        orgUid,
      });

      // Simulate an outage: the row is deleted from source, but the
      // fire-and-forget mirror write was dropped, so mirror still has it.
      await deleteSourceProjectOnly(deleteId);

      const beforeMirrorCount = await ProjectMirror.count();
      expect(
        beforeMirrorCount,
        'mirror should still have both rows before backfill',
      ).to.equal(2);

      await backfillMirror();

      const keep = await ProjectMirror.findOne({
        where: { warehouseProjectId: keepId },
      });
      const removed = await ProjectMirror.findOne({
        where: { warehouseProjectId: deleteId },
      });

      expect(keep, 'row still in source should remain in mirror').to.not.be
        .null;
      expect(removed, 'row deleted from source should be removed from mirror')
        .to.be.null;
    });

    it('should also insert missing rows (upsert pass still runs)', async function () {
      const id = uuidv4();
      const orgUid = uuidv4();
      await sequelize.query(
        `INSERT INTO projects
          (warehouseProjectId, orgUid, currentRegistry, projectId, originProjectId,
           registryOfOrigin, projectName, createdAt, updatedAt)
        VALUES (:id, :orgUid, 'Test Registry', 'PRJ-002', 'PRJ-002',
                'Test Registry', 'Source-only', datetime('now'), datetime('now'))`,
        {
          replacements: { id, orgUid },
          type: Sequelize.QueryTypes.INSERT,
        },
      );

      await backfillMirror();

      const mirrorRow = await ProjectMirror.findOne({
        where: { warehouseProjectId: id },
      });
      expect(mirrorRow, 'source row must be upserted into mirror').to.not.be
        .null;
      expect(mirrorRow.projectName).to.equal('Source-only');
    });
  });

  describe('Reconnect-triggered backfill', function () {
    it('should run backfill when authenticate transitions from failure to success', async function () {
      // Source-only row simulates a write committed to SQLite during an
      // outage window while the mirror write was silently dropped.
      const id = uuidv4();
      const orgUid = uuidv4();
      await sequelize.query(
        `INSERT INTO projects
          (warehouseProjectId, orgUid, currentRegistry, projectId, originProjectId,
           registryOfOrigin, projectName, createdAt, updatedAt)
        VALUES (:id, :orgUid, 'Test Registry', 'PRJ-003', 'PRJ-003',
                'Test Registry', 'Outage Row', datetime('now'), datetime('now'))`,
        {
          replacements: { id, orgUid },
          type: Sequelize.QueryTypes.INSERT,
        },
      );

      const mirrorBefore = await ProjectMirror.findOne({
        where: { warehouseProjectId: id },
      });
      expect(mirrorBefore).to.be.null;

      const authStub = sinon.stub(sequelizeMirror, 'authenticate');
      authStub.onCall(0).rejects(new Error('ECONNREFUSED'));
      authStub.resolves();

      // Call 1: disconnects. state -> 'disconnected', callback skipped.
      let cb1Ran = false;
      await safeMirrorDbHandler(async () => {
        cb1Ran = true;
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(cb1Ran, 'callback must not run while disconnected').to.equal(
        false,
      );

      // Call 2: reconnects, triggers backfill, runs callback. Backfill
      // covers all V1 mirror tables and can take a moment with other test
      // data in the source DB - poll until both the callback fires and the
      // recovered row is visible in the mirror.
      let cb2Ran = false;
      await safeMirrorDbHandler(async () => {
        cb2Ran = true;
      });

      const deadline = Date.now() + 15000;
      let mirrorAfter = null;
      while (Date.now() < deadline) {
        mirrorAfter = await ProjectMirror.findOne({
          where: { warehouseProjectId: id },
        });
        if (cb2Ran && mirrorAfter) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(cb2Ran, 'callback must run after reconnect').to.equal(true);
      expect(mirrorAfter, 'reconnect backfill must recover missing row').to.not
        .be.null;
    });
  });
});
