import { expect } from 'chai';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import {
  prepareV2Db,
  sequelizeV2,
  sequelizeV2Mirror,
  checkForV2Migrations,
  backfillMirrorV2,
  safeMirrorDbHandlerV2,
  __setMirrorEnabledForTestsV2,
  __setMirrorSetupSucceededForTestsV2,
  __setMysqlConfiguredForReconnectForTestsV2,
  __resetMirrorAuthStateForTestsV2,
} from '../../../src/database/v2/index.js';
import { loggerV2 } from '../../../src/config/logger.js';
import {
  ProgramV2,
  ProgramV2Mirror,
  OrganizationsV2Mirror,
} from '../../../src/models/v2/index.js';

/**
 * Mirror Reconnect + Orphan Sweep Tests (V2)
 *
 * These tests exercise the outage-recovery additions to the V2 mirror:
 *
 *   1. backfillMirrorV2 now sweeps orphan rows - mirror rows whose primary
 *      key no longer exists in source are deleted, so DELETEs issued during
 *      an outage eventually propagate to the mirror.
 *
 *   2. safeMirrorDbHandlerV2 detects a reconnect (authenticate() success
 *      following a prior failure) and runs backfillMirrorV2 before applying
 *      the current callback. Subsequent concurrent callers wait on the same
 *      backfill promise so all writes land on a caught-up mirror.
 *
 * In test mode, mirrorDBEnabledV2() normally returns false (no MySQL) so
 * backfill and the handler short-circuit. These tests use
 * __setMirrorEnabledForTestsV2(true) to drive the real code paths against
 * the local SQLite fallback (sequelizeV2Mirror / v2MirrorTest) without
 * requiring a live MySQL instance.
 *
 * Data setup uses raw SQL against sequelizeV2 / sequelizeV2Mirror directly
 * so we avoid the fire-and-forget mirror write on the source models (which
 * would race with our test setup and cause unique-constraint failures).
 */
describe('Mirror Reconnect and Orphan Sweep (V2)', function () {
  this.timeout(60000);

  before(async function () {
    await prepareV2Db();
    await checkForV2Migrations(sequelizeV2Mirror);
  });

  beforeEach(function () {
    __setMirrorEnabledForTestsV2(true);
    // Pretend the one-time MySQL setup (CREATE DATABASE + migrations) has
    // already succeeded so the reconnect path only performs the backfill.
    // In production this is set by prepareMysqlMirrorV2 itself; in tests
    // we use the SQLite fallback mirror whose schema was created by the
    // before() hook's checkForV2Migrations call.
    __setMirrorSetupSucceededForTestsV2(true);
  });

  afterEach(async function () {
    __setMirrorEnabledForTestsV2(null);
    __setMirrorSetupSucceededForTestsV2(false);
    __setMysqlConfiguredForReconnectForTestsV2(null);
    // Reset auth-state machine so downstream specs running in the same
    // mocha session don't observe a leaked 'disconnected' state and enter
    // the reconnect path on their first mirror write.
    __resetMirrorAuthStateForTestsV2();
    sinon.restore();

    for (const t of ['program', 'organizations']) {
      try {
        await sequelizeV2.query(`DELETE FROM ${t}`);
      } catch {
        /* ignore */
      }
      try {
        await sequelizeV2Mirror.query(`DELETE FROM ${t}`);
      } catch {
        /* ignore */
      }
    }
  });

  // Insert a program row into both source and mirror via raw SQL so the
  // fire-and-forget mirror writer doesn't interfere with test setup.
  const insertProgramIntoBoth = async ({ id, name }) => {
    const sql = `INSERT INTO program
        (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
      VALUES (:id, :name, 'Reg', 'ACT-001', 'seed', datetime('now'), datetime('now'))`;
    const opts = {
      replacements: { id, name },
      type: Sequelize.QueryTypes.INSERT,
    };
    await sequelizeV2.query(sql, opts);
    await sequelizeV2Mirror.query(sql, opts);
  };

  // Delete from source only, leaving mirror untouched - simulates the
  // MySQL outage window where SQLite was updated but the mirror write was
  // silently dropped by safeMirrorDbHandlerV2.
  const deleteSourceRowOnly = async (id) => {
    await sequelizeV2.query(
      `DELETE FROM program WHERE cad_trust_program_id = :id`,
      { replacements: { id }, type: Sequelize.QueryTypes.DELETE },
    );
  };

  describe('Orphan sweep', function () {
    it('should delete mirror rows whose primary key is no longer in source', async function () {
      const keepId = uuidv4();
      const deleteId = uuidv4();

      await insertProgramIntoBoth({ id: keepId, name: 'Keep' });
      await insertProgramIntoBoth({ id: deleteId, name: 'To Delete' });

      await deleteSourceRowOnly(deleteId);

      const beforeMirrorCount = await ProgramV2Mirror.count();
      expect(
        beforeMirrorCount,
        'mirror should still have both rows before backfill',
      ).to.equal(2);

      await backfillMirrorV2();

      const keep = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: keepId },
      });
      const removed = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: deleteId },
      });

      expect(keep, 'row still in source should remain in mirror').to.not.be
        .null;
      expect(removed, 'row deleted from source should be removed from mirror')
        .to.be.null;
    });

    it('should not delete rows when source and mirror are identical', async function () {
      const id = uuidv4();
      await insertProgramIntoBoth({ id, name: 'Identical' });

      await backfillMirrorV2();

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(mirrorRow, 'identical row must not be swept').to.not.be.null;
    });

    it('should also insert missing rows (upsert pass still runs)', async function () {
      const id = uuidv4();
      await sequelizeV2.query(
        `INSERT INTO program
          (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
        VALUES (:id, 'Source-only', 'Reg', 'ACT-002', 'Must backfill', datetime('now'), datetime('now'))`,
        { replacements: { id }, type: Sequelize.QueryTypes.INSERT },
      );

      await backfillMirrorV2();

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(mirrorRow, 'source row must be upserted into mirror').to.not.be
        .null;
      expect(mirrorRow.programName).to.equal('Source-only');
    });
  });

  describe('Reconnect-triggered backfill', function () {
    it('should run backfill when authenticate transitions from failure to success', async function () {
      // Row exists in source only (simulates a write during outage that was
      // committed to SQLite but whose mirror write was silently dropped).
      const orgUid = uuidv4();
      await sequelizeV2.query(
        `INSERT INTO organizations
          (org_uid, name, synced, is_home, created_at, updated_at)
        VALUES (:orgUid, 'Outage Org', 0, 0, datetime('now'), datetime('now'))`,
        {
          replacements: { orgUid },
          type: Sequelize.QueryTypes.INSERT,
        },
      );

      const mirrorBefore = await OrganizationsV2Mirror.findOne({
        where: { org_uid: orgUid },
      });
      expect(mirrorBefore).to.be.null;

      // Stub: first authenticate rejects (disconnected), subsequent succeed.
      const authStub = sinon.stub(sequelizeV2Mirror, 'authenticate');
      authStub.onCall(0).rejects(new Error('ECONNREFUSED'));
      authStub.resolves();

      // Call 1: authenticate rejects -> state becomes 'disconnected',
      // callback is silently skipped.
      let cb1Ran = false;
      await safeMirrorDbHandlerV2(async () => {
        cb1Ran = true;
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(cb1Ran, 'callback must not run while disconnected').to.equal(
        false,
      );

      // Call 2: authenticate succeeds -> detects reconnect, runs backfill,
      // then runs callback on a caught-up mirror. Backfill covers all 23
      // mirror tables and can take a couple of seconds when other tests
      // have left data in source tables, so poll until both the callback
      // runs and the backfill-restored row is visible in the mirror.
      let cb2Ran = false;
      await safeMirrorDbHandlerV2(async () => {
        cb2Ran = true;
      });

      const deadline = Date.now() + 15000;
      let mirrorAfter = null;
      while (Date.now() < deadline) {
        mirrorAfter = await OrganizationsV2Mirror.findOne({
          where: { org_uid: orgUid },
        });
        if (cb2Ran && mirrorAfter) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(cb2Ran, 'callback must run after reconnect').to.equal(true);
      expect(mirrorAfter, 'reconnect backfill must recover missing row').to.not
        .be.null;
    });

    it('should not trigger backfill on a successful authenticate with no prior failure', async function () {
      // Steady-state: authenticate succeeds first try, no reconnect detected.
      sinon.stub(sequelizeV2Mirror, 'authenticate').resolves();

      // Spy on the exact info-log line emitted at the entry point of the
      // reconnect backfill. This is how we assert the reconnect path was
      // NOT taken - without this, a regression that made backfill run on
      // every call (not just on reconnect) would still leave cbRan=true
      // and pass the test silently.
      const loggerSpy = sinon.spy(loggerV2, 'info');
      const backfillSpy = sinon.spy(loggerV2, 'error');

      let cbRan = false;
      await safeMirrorDbHandlerV2(async () => {
        cbRan = true;
      });
      // Give any mis-triggered reconnect backfill time to log
      await new Promise((r) => setTimeout(r, 100));

      expect(cbRan, 'callback must run on steady-state connected handler').to
        .equal(true);

      const reconnectLogged = loggerSpy
        .getCalls()
        .some((call) =>
          /Mirror DB reconnected, running catch-up recovery/.test(
            String(call.args[0] ?? ''),
          ),
        );
      expect(
        reconnectLogged,
        'backfill must not run on a steady-state authenticate success',
      ).to.equal(false);

      loggerSpy.restore();
      backfillSpy.restore();
    });

    // Placed last in this block because it intentionally leaves
    // v2MirrorAuthState in the 'disconnected' state (startV2ReconnectBackfill
    // does so on setup failure). Running another reconnect-related test
    // after this one would observe that stale state and behave differently.
    it('should skip the callback when MySQL is configured but setup has not completed yet', async function () {
      // Regression guard for the post-reconnect skip-callback branch in
      // safeMirrorDbHandlerV2. When the mirror is "enabled" and
      // authenticate() succeeds but the one-time setup (CREATE DATABASE +
      // migrations) has not yet completed, running the callback would hit
      // tables that don't exist and produce a confusing swallowed error.
      // The handler must skip the callback silently in that window.
      //
      // Forces both prongs of the guard true:
      //   - isMysqlMirrorConfiguredForReconnectV2() -> true
      //   - v2MirrorSetupSucceeded                  -> false
      __setMysqlConfiguredForReconnectForTestsV2(true);
      __setMirrorSetupSucceededForTestsV2(false);

      // Happy-path authenticate so the handler reaches the guard without
      // going through the disconnected-catch branch. The handler will first
      // call startV2ReconnectBackfill (because setupNeverRan is true), which
      // in turn calls prepareMysqlMirrorV2. prepareMysqlMirrorV2 reads
      // config.yaml directly (not via the override above) and, with no real
      // MIRROR_DB in the test config, returns false. That leaves
      // v2MirrorSetupSucceeded still false, so the new guard trips.
      sinon.stub(sequelizeV2Mirror, 'authenticate').resolves();

      let cbRan = false;
      await safeMirrorDbHandlerV2(async () => {
        cbRan = true;
      });
      await new Promise((r) => setTimeout(r, 100));

      expect(
        cbRan,
        'callback must not run while MySQL setup is still pending',
      ).to.equal(false);
    });
  });
});
