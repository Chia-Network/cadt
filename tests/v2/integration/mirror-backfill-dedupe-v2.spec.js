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
  __setMirrorEnabledForTestsV2,
  __setMirrorSetupSucceededForTestsV2,
  __setMysqlConfiguredForReconnectForTestsV2,
  __resetMirrorAuthStateForTestsV2,
} from '../../../src/database/v2/index.js';
import { loggerV2 } from '../../../src/config/logger.js';
import { ProgramV2Mirror } from '../../../src/models/v2/index.js';

/**
 * V2 Mirror Backfill Dedupe + In-Sync Gate Tests
 *
 * Companion to mirror-reconnect-v2.spec.js. Covers the V2 equivalents of
 * the V1 dedupe / gate additions - see the V1 spec for full rationale.
 *
 * The "module-load hygiene" regression test that V1 carries doesn't
 * apply here: V2 model associate() methods never called
 * safeMirrorDbHandlerV2 (only their CRUD methods do), so V2 was never
 * vulnerable to the eager-import parallel-backfill race in the first
 * place. The in-flight memoization is added defensively to keep V1 and
 * V2 symmetric.
 */
describe('Mirror Backfill Dedupe + In-Sync Gate (V2)', function () {
  this.timeout(60000);

  before(async function () {
    await prepareV2Db();
    await checkForV2Migrations(sequelizeV2Mirror);
  });

  beforeEach(function () {
    __setMirrorEnabledForTestsV2(true);
    __setMirrorSetupSucceededForTestsV2(true);
  });

  afterEach(async function () {
    __setMirrorEnabledForTestsV2(null);
    __setMirrorSetupSucceededForTestsV2(false);
    __setMysqlConfiguredForReconnectForTestsV2(null);
    __resetMirrorAuthStateForTestsV2();
    sinon.restore();

    for (const t of ['program']) {
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

  // Raw-SQL inserts bypass the fire-and-forget mirror writer for
  // deterministic setup.
  const insertProgramInto = async (target, { id, name, when }) => {
    const sql = `INSERT INTO program
        (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
      VALUES (:id, :name, 'Reg', 'ACT-001', 'seed', :when, :when)`;
    await target.query(sql, {
      replacements: { id, name, when },
      type: Sequelize.QueryTypes.INSERT,
    });
  };

  const countStartingLogs = (loggerSpy) =>
    loggerSpy
      .getCalls()
      .filter((call) =>
        /\[v2\]: Starting MySQL mirror backfill from SQLite/.test(
          String(call.args[0] ?? ''),
        ),
      ).length;

  describe('In-flight memoization', function () {
    it('coalesces concurrent backfillMirrorV2() calls into a single run', async function () {
      // Seed source-only so the backfill has real work to do (gate
      // fails -> full sync), proving the memoization is not just
      // trivially short-circuiting on an empty-table gate.
      const id = uuidv4();
      await insertProgramInto(sequelizeV2, {
        id,
        name: 'Dedupe Row',
        when: '2026-01-01 00:00:00',
      });

      const loggerSpy = sinon.spy(loggerV2, 'info');

      const p1 = backfillMirrorV2();
      const p2 = backfillMirrorV2();
      await Promise.all([p1, p2]);

      const starts = countStartingLogs(loggerSpy);
      expect(
        starts,
        'two concurrent backfillMirrorV2() calls must share a single run',
      ).to.equal(1);

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(mirrorRow, 'shared run still recovers the missing row').to.not.be
        .null;
    });

    it('runs a fresh backfill on a subsequent serial call', async function () {
      const loggerSpy = sinon.spy(loggerV2, 'info');

      await backfillMirrorV2();
      await backfillMirrorV2();

      const starts = countStartingLogs(loggerSpy);
      expect(
        starts,
        'sequential (non-overlapping) calls must each run a fresh backfill',
      ).to.equal(2);
    });
  });

  describe('In-sync gate', function () {
    it('skips the bulk upsert when source and mirror match', async function () {
      const id = uuidv4();
      const when = '2026-01-01 12:00:00';

      await insertProgramInto(sequelizeV2, { id, name: 'Synced', when });
      await insertProgramInto(sequelizeV2Mirror, { id, name: 'Synced', when });

      const bulkCreateSpy = sinon.spy(ProgramV2Mirror, 'bulkCreate');

      await backfillMirrorV2();

      expect(
        bulkCreateSpy.called,
        'gate must short-circuit before reaching ProgramV2Mirror.bulkCreate when source and mirror are identical',
      ).to.equal(false);

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(mirrorRow, 'gate must not delete or modify rows').to.not.be.null;
    });

    it('skips the bulk upsert when the mirror row is the whole-second truncation of a sub-second source row', async function () {
      // Regression for the sub-second precision false-negative. SQLite
      // keeps milliseconds on updated_at while the MySQL mirror's DATETIME
      // column truncates to whole seconds, so a freshly-synced mirror reads
      // back fractionally behind the source. We reproduce that by storing
      // the sub-second timestamp in source and its whole-second truncation
      // in the mirror (identical UTC second, .899 vs .000). The gate must
      // treat the two as in sync and skip the full re-upsert.
      //
      // Both timestamps carry the explicit '+00:00' offset so new Date()
      // parses them as UTC; a bare "YYYY-MM-DD HH:mm:ss" string would be
      // read as local time and shift the two sides apart.
      const id = uuidv4();

      await insertProgramInto(sequelizeV2, {
        id,
        name: 'Synced',
        when: '2026-01-01 12:00:00.899 +00:00',
      });
      await insertProgramInto(sequelizeV2Mirror, {
        id,
        name: 'Synced',
        when: '2026-01-01 12:00:00.000 +00:00',
      });

      const bulkCreateSpy = sinon.spy(ProgramV2Mirror, 'bulkCreate');

      await backfillMirrorV2();

      expect(
        bulkCreateSpy.called,
        'a sub-second-only difference (mirror truncated to whole seconds) must not trigger a full re-upsert',
      ).to.equal(false);

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(mirrorRow, 'gate must not delete or modify the row').to.not.be.null;
    });

    it('falls through to the full sync when counts mismatch', async function () {
      // Source has one row, mirror is empty. Gate fails on count; full
      // sync runs; mirror gets the row.
      const id = uuidv4();
      await insertProgramInto(sequelizeV2, {
        id,
        name: 'Drift',
        when: '2026-01-01 00:00:00',
      });

      await backfillMirrorV2();

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(
        mirrorRow,
        'count mismatch must fall through to full sync and recover the row',
      ).to.not.be.null;
    });

    it('falls through to the full sync when mirror max(updatedAt) is older than source', async function () {
      // Identical primary key, same count, but mirror's timestamp is
      // older - simulates an UPDATE that the mirror missed. The gate
      // must NOT short-circuit; the full sync must propagate the
      // newer source value into the mirror.
      const id = uuidv4();

      await insertProgramInto(sequelizeV2, {
        id,
        name: 'Updated In Source',
        when: '2026-02-01 00:00:00',
      });
      await insertProgramInto(sequelizeV2Mirror, {
        id,
        name: 'Stale In Mirror',
        when: '2026-01-01 00:00:00',
      });

      await backfillMirrorV2();

      const mirrorRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: id },
      });
      expect(mirrorRow).to.not.be.null;
      expect(
        mirrorRow.programName,
        'stale mirror updatedAt must trigger full sync and propagate new value',
      ).to.equal('Updated In Source');
    });

    it('recovers from PK-swap drift (delete + insert preserving count and max)', async function () {
      // Regression for PR review: see V1 spec for the full rationale.
      // The orphan sweep must run unconditionally before the gate so
      // PK swaps that preserve count and MAX(updatedAt) still get
      // caught via the post-sweep count mismatch.
      const newestId = uuidv4();
      const orphanId = uuidv4();
      const replacementId = uuidv4();

      await insertProgramInto(sequelizeV2, {
        id: newestId,
        name: 'Newest A',
        when: '2026-03-01 00:00:00',
      });
      await insertProgramInto(sequelizeV2Mirror, {
        id: newestId,
        name: 'Newest A',
        when: '2026-03-01 00:00:00',
      });
      await insertProgramInto(sequelizeV2, {
        id: orphanId,
        name: 'Doomed B',
        when: '2026-01-01 00:00:00',
      });
      await insertProgramInto(sequelizeV2Mirror, {
        id: orphanId,
        name: 'Doomed B',
        when: '2026-01-01 00:00:00',
      });

      await sequelizeV2.query(
        `DELETE FROM program WHERE cad_trust_program_id = :id`,
        { replacements: { id: orphanId }, type: Sequelize.QueryTypes.DELETE },
      );
      await insertProgramInto(sequelizeV2, {
        id: replacementId,
        name: 'Replacement C',
        when: '2026-02-01 00:00:00',
      });

      await backfillMirrorV2();

      const orphanRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: orphanId },
      });
      const replacementRow = await ProgramV2Mirror.findOne({
        where: { cadTrustProgramId: replacementId },
      });
      expect(orphanRow, 'orphan sweep must remove the row deleted from source')
        .to.be.null;
      expect(
        replacementRow,
        'upsert must insert the replacement row that drifted in under MAX(updatedAt)',
      ).to.not.be.null;
      expect(replacementRow.programName).to.equal('Replacement C');
    });

    // Same null-MAX hazard as V1: handled defensively in
    // isMirrorInSyncV2 but not reproducible against CADT's V2 schema
    // because Sequelize's `timestamps: true` default makes updated_at
    // NOT NULL and SQLite rejects writes that would violate it.
  });

  // No V2 module-load hygiene test here: V2 models never wrapped
  // associate() in safeMirrorDbHandlerV2 in the first place, so V2 was
  // never vulnerable to the parallel-backfill race that V1 patched. The
  // V1 spec carries the structural regression guard for that pattern;
  // re-asserting it on V2 would require calling a V2 associate() twice,
  // which Sequelize rejects on aliased associations (e.g. ProgramV2's
  // `as: 'projects'`).
});
