import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import {
  prepareDb,
  sequelize,
  sequelizeMirror,
  checkForMigrations,
} from '../../src/database/index.js';
import { Audit, Meta, Project, Unit } from '../../src/models/index.js';
import { AuditMirror } from '../../src/models/audit/audit.model.mirror.js';
import {
  FTS5_DEFER_META_KEY,
  dropV1FtsTriggers,
  recreateV1FtsTriggers,
  rebuildV1FtsTables,
  ensureV1FtsTriggersDeferred,
  restoreV1FtsTriggersAndRebuildIfDeferred,
} from '../../src/utils/fts5-deferral.js';
import TaskManager from '../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../src/utils/config-loader.js';

const ALL_FTS_TRIGGER_NAMES = [
  'project_insert_fts',
  'project_update_fts',
  'project_delete_fts',
  'unit_insert_fts',
  'unit_update_fts',
  'unit_delete_fts',
];

async function listFtsTriggers() {
  const rows = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN (:names)",
    {
      replacements: { names: ALL_FTS_TRIGGER_NAMES },
      type: sequelize.QueryTypes.SELECT,
    },
  );
  return rows.map((r) => r.name).sort();
}

async function listAuditIndexes() {
  const rows = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit'",
    { type: sequelize.QueryTypes.SELECT },
  );
  return rows.map((r) => r.name);
}

async function projectsFtsCount() {
  const [[row]] = await sequelize.query(
    'SELECT COUNT(*) AS c FROM projects_fts;',
  );
  return Number(row.c);
}

async function unitsFtsCount() {
  const [[row]] = await sequelize.query('SELECT COUNT(*) AS c FROM units_fts;');
  return Number(row.c);
}

describe('Sync Write Perf (V1) — recommended PR', function () {
  this.timeout(60000);

  before(async function () {
    await prepareDb();
    // Stop background sync tasks so they don't drop / restore FTS triggers
    // out from under us mid-test.
    TaskManager.stopAll();
  });

  after(async function () {
    // Restart the task manager so tests that follow this file in the same
    // mocha run (e.g. unit.spec.js) still get a live V1 sync interval.
    // Without this restart the V1 sync task stays stopped for the rest of
    // the run and subsequent end-to-end staging tests time out waiting
    // for the sync to apply staged units. Restart BOTH V1 and V2 sides
    // (regardless of mocha file ordering with the V2 perf spec) so this
    // file is never the reason a side stays down.
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    await TaskManager.start(
      configV1?.ENABLE !== false,
      configV2?.ENABLE !== false,
    );
  });

  beforeEach(async function () {
    // Make sure triggers are present at the start of each test (a previous
    // test that asserted "triggers dropped" or threw mid-cleanup may have
    // left them missing; FTS DELETEs further down depend on the delete
    // trigger to keep projects_fts/units_fts in sync).
    const triggers = await listFtsTriggers();
    if (triggers.length !== ALL_FTS_TRIGGER_NAMES.length) {
      const tx = await sequelize.transaction();
      try {
        await recreateV1FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    }

    await Audit.destroy({ where: {} });
    await Meta.destroy({ where: { metaKey: FTS5_DEFER_META_KEY } });
    // Clear projects/units AND the FTS tables. The destroy on projects/
    // units will fire AFTER DELETE triggers but only for rows visible to
    // them at this moment; the explicit FTS truncates handle any rows
    // left over from a test that ran with triggers dropped.
    await Project.destroy({ where: {}, truncate: true });
    await Unit.destroy({ where: {}, truncate: true });
    await sequelize.query('DELETE FROM projects_fts;');
    await sequelize.query('DELETE FROM units_fts;');
  });

  describe('audit composite indexes', function () {
    it('creates a composite index on (registryId, generation)', async function () {
      const indexes = await listAuditIndexes();
      expect(indexes).to.include('audit_registry_id_generation');
    });

    it('creates a composite index on (orgUid, generation)', async function () {
      const indexes = await listAuditIndexes();
      expect(indexes).to.include('audit_org_uid_generation');
    });

    it('uses the orgUid composite index for the processJob mostRecentOrgAuditRecord lookup', async function () {
      // EXPLAIN QUERY PLAN must show SQLite using audit_org_uid_generation
      // for the per-tick `Audit.findOne where orgUid order by generation
      // DESC limit 1` lookup in src/tasks/sync-registries.js. Without
      // the composite index this degenerates to SCAN + sort once the
      // audit table is large.
      const plan = await sequelize.query(
        `EXPLAIN QUERY PLAN
         SELECT * FROM audit
         WHERE orgUid = :orgUid
         ORDER BY generation DESC
         LIMIT 1`,
        {
          replacements: { orgUid: 'fake-org-uid' },
          type: sequelize.QueryTypes.SELECT,
        },
      );
      const description = plan.map((row) => row.detail).join(' ');
      expect(description).to.match(/audit_org_uid_generation/);
    });

    it('uses the registryId composite index for the per-tick last-generation lookup', async function () {
      // EXPLAIN QUERY PLAN should show SQLite using the composite index for
      // the hot-path query in syncOrganizationAudit. Without the index this
      // degenerates to a SCAN once the audit table is large.
      const plan = await sequelize.query(
        `EXPLAIN QUERY PLAN SELECT * FROM audit
         WHERE registryId = :registryId
         ORDER BY generation DESC
         LIMIT 1`,
        {
          replacements: { registryId: 'fake-registry-id' },
          type: sequelize.QueryTypes.SELECT,
        },
      );
      const description = plan.map((row) => row.detail).join(' ');
      expect(description).to.match(/audit_registry_id_generation/);
    });
  });

  describe('Audit.bulkCreate', function () {
    it('exposes a static bulkCreate that persists all rows', async function () {
      const orgUid = uuidv4();
      const registryId = uuidv4();
      const rootHash = `0x${'a'.repeat(64)}`;
      const rows = Array.from({ length: 10 }, (_, idx) => ({
        orgUid,
        registryId,
        rootHash,
        type: 'INSERT',
        table: 'project',
        change: JSON.stringify({ idx }),
        onchainConfirmationTimeStamp: '1700000000',
        generation: 5,
        comment: 'bulk-test-comment',
        author: 'bulk-test-author',
      }));

      await Audit.bulkCreate(rows);

      const persisted = await Audit.findAll({
        where: { registryId, generation: 5 },
        raw: true,
      });
      expect(persisted).to.have.length(10);
      // Every row should have inherited the per-generation comment / author
      // (proves the hoist-out-of-loop refactor preserved the old per-row
      // behaviour where every row got the same shared values).
      for (const row of persisted) {
        expect(row.comment).to.equal('bulk-test-comment');
        expect(row.author).to.equal('bulk-test-author');
        expect(row.orgUid).to.equal(orgUid);
        expect(row.registryId).to.equal(registryId);
      }
    });

    describe('mirror code path', function () {
      // These tests verify the mirror branch of Audit.bulkCreate's static
      // against the real V1 SQLite-fallback mirror DB (mirrorTest). The
      // V1 mirror is enabled by default in test mode, so we just have to
      // ensure the mirror migrations have run and that earlier tests'
      // fire-and-forget mirror writes are drained before each case.

      before(async function () {
        await checkForMigrations(sequelizeMirror);
      });

      beforeEach(async function () {
        // Drain any fire-and-forget mirror writes left over from prior
        // tests in the outer describe (Audit.bulkCreate fires a mirror
        // write asynchronously via safeMirrorDbHandler), then clear the
        // mirror audit table so this case's assertions are independent.
        let lastCount = -1;
        for (let i = 0; i < 30; i += 1) {
          const c = await AuditMirror.count();
          if (c === lastCount) break;
          lastCount = c;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await AuditMirror.destroy({ where: {} });
      });

      const waitForMirrorRows = async (where, expected, timeoutMs = 5000) => {
        const deadline = Date.now() + timeoutMs;
        let rows = [];
        while (Date.now() < deadline) {
          rows = await AuditMirror.findAll({ where, raw: true });
          if (rows.length >= expected) return rows;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return rows;
      };

      it('forwards rows to AuditMirror when the mirror is enabled', async function () {
        const orgUid = uuidv4();
        const registryId = uuidv4();
        const rootHash = `0x${'b'.repeat(64)}`;
        const rows = Array.from({ length: 5 }, (_, idx) => ({
          orgUid,
          registryId,
          rootHash,
          type: 'INSERT',
          table: 'project',
          change: JSON.stringify({ idx }),
          onchainConfirmationTimeStamp: '1700000000',
          generation: 7,
          comment: 'mirror-test',
          author: 'mirror-test',
        }));

        await Audit.bulkCreate(rows);

        const mirrored = await waitForMirrorRows(
          { registryId, generation: 7 },
          rows.length,
        );
        expect(mirrored).to.have.length(rows.length);
        for (const row of mirrored) {
          expect(row.orgUid).to.equal(orgUid);
          expect(row.registryId).to.equal(registryId);
          expect(row.comment).to.equal('mirror-test');
          expect(row.author).to.equal('mirror-test');
        }
      });

      it('threads mirrorTransaction through so the mirror write commits with that tx, not the source tx', async function () {
        // Open separate source and mirror transactions, hand both to
        // Audit.bulkCreate, commit the source, then commit the mirror tx
        // a moment later. If the static failed to swap mirrorTransaction
        // in for `transaction` on the mirror options, the mirror write
        // would either land outside the mirror tx (visible immediately
        // after the source commit) or attempt to reuse the source tx
        // handle on the mirror connection. The expected behaviour is
        // that the mirror rows are NOT visible after the source commit
        // and ARE visible after the mirror tx commit.
        const orgUid = uuidv4();
        const registryId = uuidv4();
        const rootHash = `0x${'c'.repeat(64)}`;
        const rows = [
          {
            orgUid,
            registryId,
            rootHash,
            type: 'INSERT',
            table: 'project',
            change: '{}',
            onchainConfirmationTimeStamp: '1700000000',
            generation: 9,
            comment: 'mirror-tx-test',
            author: 'mirror-tx-test',
          },
        ];

        const sourceTx = await sequelize.transaction();
        const mirrorTx = await sequelizeMirror.transaction();
        let sourceCommitted = false;
        let mirrorCommitted = false;
        try {
          await Audit.bulkCreate(rows, {
            transaction: sourceTx,
            mirrorTransaction: mirrorTx,
          });
          await sourceTx.commit();
          sourceCommitted = true;

          // Source side has the row; mirror tx is still open so the row
          // must not yet be visible to a separate mirror reader. Give
          // the fire-and-forget mirror handler a moment to land its
          // write on `mirrorTx` before we probe with a separate read.
          const sourceRows = await Audit.findAll({
            where: { registryId, generation: 9 },
            raw: true,
          });
          expect(sourceRows).to.have.length(1);

          // Poll briefly to give the fire-and-forget mirror branch a
          // chance to run before we assert isolation. We expect 0 rows
          // visible here regardless: if mirrorTransaction was correctly
          // forwarded, the write is gated by mirrorTx and the read sees
          // 0; if the implementation regressed and used the source tx
          // (or no tx) on the mirror connection, the write would either
          // error out (and never land) or commit with the source - the
          // 0 still holds for the "wrong tx handle" case but a real
          // regression like 'forgot to swap transaction' would land
          // outside any tx and show up here as 1.
          await new Promise((resolve) => setTimeout(resolve, 250));
          const mirrorRowsBeforeMirrorCommit = await AuditMirror.findAll({
            where: { registryId, generation: 9 },
            raw: true,
          });
          expect(
            mirrorRowsBeforeMirrorCommit,
            'mirror rows must not be visible until mirrorTx commits',
          ).to.have.length(0);

          await mirrorTx.commit();
          mirrorCommitted = true;
        } finally {
          if (!sourceCommitted) await sourceTx.rollback();
          if (!mirrorCommitted) await mirrorTx.rollback();
        }

        const mirrored = await waitForMirrorRows(
          { registryId, generation: 9 },
          1,
        );
        expect(mirrored).to.have.length(1);
        expect(mirrored[0].orgUid).to.equal(orgUid);
        expect(mirrored[0].comment).to.equal('mirror-tx-test');
      });
    });
  });

  describe('FTS5 deferral helpers', function () {
    it('dropV1FtsTriggers removes all six project/unit FTS triggers idempotently', async function () {
      const before = await listFtsTriggers();
      expect(before).to.deep.equal([...ALL_FTS_TRIGGER_NAMES].sort());

      const tx = await sequelize.transaction();
      try {
        await dropV1FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }

      const afterFirst = await listFtsTriggers();
      expect(afterFirst).to.have.length(0);

      // Idempotent: a second drop on already-dropped triggers should not
      // throw.
      const tx2 = await sequelize.transaction();
      try {
        await dropV1FtsTriggers(tx2);
        await tx2.commit();
      } catch (e) {
        await tx2.rollback();
        throw e;
      }

      const afterSecond = await listFtsTriggers();
      expect(afterSecond).to.have.length(0);
    });

    it('recreateV1FtsTriggers restores all six triggers and they fire on insert', async function () {
      const tx = await sequelize.transaction();
      try {
        await dropV1FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }
      expect(await listFtsTriggers()).to.have.length(0);

      const tx2 = await sequelize.transaction();
      try {
        await recreateV1FtsTriggers(tx2);
        await tx2.commit();
      } catch (e) {
        await tx2.rollback();
        throw e;
      }

      const restored = await listFtsTriggers();
      expect(restored).to.deep.equal([...ALL_FTS_TRIGGER_NAMES].sort());

      // Insert a project; the insert trigger should populate projects_fts.
      await sequelize.query('DELETE FROM projects_fts;');
      const ftsCountBefore = await projectsFtsCount();
      expect(ftsCountBefore).to.equal(0);

      const projectId = uuidv4();
      await Project.create({
        warehouseProjectId: projectId,
        orgUid: 'fts-trigger-test',
        currentRegistry: 'fts-trigger-test',
        projectId: 'fts-test',
        originProjectId: 'fts-test',
        registryOfOrigin: 'fts-test',
        projectName: 'recreated-trigger-fires',
        projectLink: 'https://example.com',
        projectDeveloper: 'dev',
        sector: 'sector',
        coveredByNDC: 'no',
        projectType: 'type',
        projectStatus: 'Listed',
        projectStatusDate: '2025-01-01',
        unitMetric: 'tCO2e',
        validationDate: '2025-01-01',
        timeStaged: 1700000000,
      });

      const ftsCountAfter = await projectsFtsCount();
      expect(ftsCountAfter).to.equal(1);

      // Cleanup
      await Project.destroy({ where: { warehouseProjectId: projectId } });
    });

    it('rebuildV1FtsTables repopulates projects_fts/units_fts from projects/units', async function () {
      // Drop triggers, insert directly into projects/units (so FTS is NOT
      // populated by triggers), then run rebuild and assert FTS reflects
      // the source rows. This is the "during catch-up" simulation.
      const tx = await sequelize.transaction();
      try {
        await dropV1FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }

      const projectId = uuidv4();
      await Project.create({
        warehouseProjectId: projectId,
        orgUid: 'fts-rebuild-test',
        currentRegistry: 'fts-rebuild-test',
        // Single token (no dashes / underscores) so FTS5's default
        // tokeniser keeps the whole word as one match candidate.
        projectId: 'rebuildsearchtoken',
        originProjectId: 'fts-rebuild',
        registryOfOrigin: 'fts-rebuild',
        projectName: 'rebuildprojectname',
        projectLink: 'https://example.com',
        projectDeveloper: 'dev',
        sector: 'sector',
        coveredByNDC: 'no',
        projectType: 'type',
        projectStatus: 'Listed',
        projectStatusDate: '2025-01-01',
        unitMetric: 'tCO2e',
        validationDate: '2025-01-01',
        timeStaged: 1700000000,
      });

      // FTS should NOT have the row because triggers were dropped during the
      // direct insert.
      const beforeProjects = await projectsFtsCount();
      expect(beforeProjects).to.equal(0);

      const tx2 = await sequelize.transaction();
      try {
        await rebuildV1FtsTables(tx2);
        await tx2.commit();
      } catch (e) {
        await tx2.rollback();
        throw e;
      }

      const afterProjects = await projectsFtsCount();
      expect(afterProjects).to.equal(1);

      // Verify the row is searchable via FTS.
      const [matches] = await sequelize.query(
        "SELECT warehouseProjectId FROM projects_fts WHERE projects_fts MATCH 'rebuildsearchtoken';",
      );
      expect(matches.length).to.equal(1);
      expect(matches[0].warehouseProjectId).to.equal(projectId);

      // Cleanup
      const tx3 = await sequelize.transaction();
      try {
        await recreateV1FtsTriggers(tx3);
        await tx3.commit();
      } catch (e) {
        await tx3.rollback();
        throw e;
      }
      await Project.destroy({ where: { warehouseProjectId: projectId } });
    });
  });

  describe('FTS5 deferral state machine', function () {
    it('ensureV1FtsTriggersDeferred drops triggers and sets the meta flag', async function () {
      await ensureV1FtsTriggersDeferred();

      const triggers = await listFtsTriggers();
      expect(triggers).to.have.length(0);

      const flagRow = await Meta.findOne({
        where: { metaKey: FTS5_DEFER_META_KEY },
        raw: true,
      });
      expect(flagRow).to.exist;
    });

    it('ensureV1FtsTriggersDeferred is idempotent (safe to call twice)', async function () {
      await ensureV1FtsTriggersDeferred();
      await ensureV1FtsTriggersDeferred();

      const triggers = await listFtsTriggers();
      expect(triggers).to.have.length(0);

      // Only one meta row, not two.
      const count = await Meta.count({
        where: { metaKey: FTS5_DEFER_META_KEY },
      });
      expect(count).to.equal(1);
    });

    it('restoreV1FtsTriggersAndRebuildIfDeferred is a no-op when flag is unset', async function () {
      const result = await restoreV1FtsTriggersAndRebuildIfDeferred();
      expect(result).to.equal(false);

      // Triggers untouched.
      const triggers = await listFtsTriggers();
      expect(triggers).to.deep.equal([...ALL_FTS_TRIGGER_NAMES].sort());
    });

    it('restoreV1FtsTriggersAndRebuildIfDeferred recreates triggers + rebuilds + clears flag when set', async function () {
      // Set up a "during catch-up" state: triggers dropped, project written
      // directly into the source table without the trigger updating FTS.
      await ensureV1FtsTriggersDeferred();
      expect(await listFtsTriggers()).to.have.length(0);

      const projectId = uuidv4();
      await Project.create({
        warehouseProjectId: projectId,
        orgUid: 'fts-restore-test',
        currentRegistry: 'fts-restore-test',
        projectId: 'restoresearchtoken',
        originProjectId: 'fts-restore',
        registryOfOrigin: 'fts-restore',
        projectName: 'restoreprojectname',
        projectLink: 'https://example.com',
        projectDeveloper: 'dev',
        sector: 'sector',
        coveredByNDC: 'no',
        projectType: 'type',
        projectStatus: 'Listed',
        projectStatusDate: '2025-01-01',
        unitMetric: 'tCO2e',
        validationDate: '2025-01-01',
        timeStaged: 1700000000,
      });

      expect(await projectsFtsCount()).to.equal(0);

      const result = await restoreV1FtsTriggersAndRebuildIfDeferred();
      expect(result).to.equal(true);

      const triggers = await listFtsTriggers();
      expect(triggers).to.deep.equal([...ALL_FTS_TRIGGER_NAMES].sort());

      const flagRow = await Meta.findOne({
        where: { metaKey: FTS5_DEFER_META_KEY },
        raw: true,
      });
      expect(flagRow).to.equal(null);

      const ftsCount = await projectsFtsCount();
      expect(ftsCount).to.equal(1);

      const [matches] = await sequelize.query(
        "SELECT warehouseProjectId FROM projects_fts WHERE projects_fts MATCH 'restoresearchtoken';",
      );
      expect(matches.length).to.equal(1);

      // Cleanup
      await Project.destroy({ where: { warehouseProjectId: projectId } });
    });

    it('rebuild reflects rows in BOTH projects_fts and units_fts', async function () {
      await ensureV1FtsTriggersDeferred();

      const projectId = uuidv4();
      const unitId = uuidv4();

      await Project.create({
        warehouseProjectId: projectId,
        orgUid: 'fts-both-test',
        currentRegistry: 'fts-both-test',
        projectId: 'p',
        originProjectId: 'p',
        registryOfOrigin: 'p',
        projectName: 'p',
        projectLink: 'https://example.com',
        projectDeveloper: 'dev',
        sector: 'sector',
        coveredByNDC: 'no',
        projectType: 'type',
        projectStatus: 'Listed',
        projectStatusDate: '2025-01-01',
        unitMetric: 'tCO2e',
        validationDate: '2025-01-01',
        timeStaged: 1700000000,
      });

      await Unit.create({
        warehouseUnitId: unitId,
        orgUid: 'fts-both-test',
        issuanceId: uuidv4(),
        projectLocationId: 'loc',
        unitOwner: 'owner',
        countryJurisdictionOfOwner: 'US',
        inCountryJurisdictionOfOwner: 'US',
        serialNumberBlock: 'AAA1-AAA1',
        vintageYear: 2025,
        unitType: 'Reduction - Nature',
        marketplace: 'mp',
        marketplaceLink: 'https://example.com',
        marketplaceIdentifier: 'id',
        unitTags: 'tag',
        unitStatus: 'Held',
        unitStatusReason: 'na',
        unitRegistryLink: 'https://example.com',
        correspondingAdjustmentDeclaration: 'Unknown',
        correspondingAdjustmentStatus: 'Not Started',
        unitBlockStart: 'AAA1',
        unitBlockEnd: 'AAA1',
        unitCount: 1,
        timeStaged: 1700000000,
      });

      expect(await projectsFtsCount()).to.equal(0);
      expect(await unitsFtsCount()).to.equal(0);

      await restoreV1FtsTriggersAndRebuildIfDeferred();

      expect(await projectsFtsCount()).to.equal(1);
      expect(await unitsFtsCount()).to.equal(1);

      // Cleanup
      await Project.destroy({ where: { warehouseProjectId: projectId } });
      await Unit.destroy({ where: { warehouseUnitId: unitId } });
    });

    it('boot recovery: prepareDb-style restore runs when meta flag is pre-set', async function () {
      // Simulate a crash mid-catch-up: meta flag set, triggers still
      // dropped, projects table has rows, FTS is empty.
      await ensureV1FtsTriggersDeferred();

      const projectId = uuidv4();
      await Project.create({
        warehouseProjectId: projectId,
        orgUid: 'fts-boot-recovery-test',
        currentRegistry: 'fts-boot-recovery-test',
        projectId: 'crashrecoverytoken',
        originProjectId: 'p',
        registryOfOrigin: 'p',
        projectName: 'crashrecoveryname',
        projectLink: 'https://example.com',
        projectDeveloper: 'dev',
        sector: 'sector',
        coveredByNDC: 'no',
        projectType: 'type',
        projectStatus: 'Listed',
        projectStatusDate: '2025-01-01',
        unitMetric: 'tCO2e',
        validationDate: '2025-01-01',
        timeStaged: 1700000000,
      });

      // Boot recovery: this is what prepareDb() invokes after migrations.
      const recovered = await restoreV1FtsTriggersAndRebuildIfDeferred();
      expect(recovered).to.equal(true);

      // Triggers back, flag cleared, FTS has the row.
      expect(await listFtsTriggers()).to.deep.equal(
        [...ALL_FTS_TRIGGER_NAMES].sort(),
      );
      const flagRow = await Meta.findOne({
        where: { metaKey: FTS5_DEFER_META_KEY },
        raw: true,
      });
      expect(flagRow).to.equal(null);
      expect(await projectsFtsCount()).to.equal(1);

      // Cleanup
      await Project.destroy({ where: { warehouseProjectId: projectId } });
    });
  });
});
