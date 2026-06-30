import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { sequelizeV2, prepareV2Db } from '../../../src/database/v2/index.js';
import {
  AuditV2,
  MetaV2,
  ProjectV2,
  UnitV2,
  IssuanceV2,
  OrganizationsV2,
} from '../../../src/models/v2/index.js';
import {
  FTS5_DEFER_META_KEY_V2,
  dropV2FtsTriggers,
  recreateV2FtsTriggers,
  rebuildV2FtsTables,
  ensureV2FtsTriggersDeferred,
  restoreV2FtsTriggersAndRebuildIfDeferred,
} from '../../../src/utils/fts5-deferral-v2.js';
import TaskManager from '../../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';

const ALL_V2_FTS_TRIGGER_NAMES = [
  'project_v2_insert_fts',
  'project_v2_update_fts',
  'project_v2_delete_fts',
  'unit_v2_insert_fts',
  'unit_v2_update_fts',
  'unit_v2_delete_fts',
];

async function listV2FtsTriggers() {
  const rows = await sequelizeV2.query(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN (:names)",
    {
      replacements: { names: ALL_V2_FTS_TRIGGER_NAMES },
      type: sequelizeV2.QueryTypes.SELECT,
    },
  );
  return rows.map((r) => r.name).sort();
}

async function listAuditV2Indexes() {
  const rows = await sequelizeV2.query(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit'",
    { type: sequelizeV2.QueryTypes.SELECT },
  );
  return rows.map((r) => r.name);
}

async function projectsV2FtsCount() {
  const [[row]] = await sequelizeV2.query(
    'SELECT COUNT(*) AS c FROM projects_v2_fts;',
  );
  return Number(row.c);
}

async function unitsV2FtsCount() {
  const [[row]] = await sequelizeV2.query(
    'SELECT COUNT(*) AS c FROM units_v2_fts;',
  );
  return Number(row.c);
}

describe('Sync Write Perf (V2) — recommended PR', function () {
  this.timeout(60000);

  before(async function () {
    await prepareV2Db();
    TaskManager.stopAll();
  });

  after(async function () {
    // Restart BOTH V1 and V2 sides so this file is never the reason a
    // side stays down for follow-on specs in the same mocha run,
    // regardless of file ordering relative to the V1 perf spec.
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    await TaskManager.start(
      configV1?.ENABLE !== false,
      configV2?.ENABLE !== false,
    );
  });

  beforeEach(async function () {
    // Re-create triggers if a previous test left them dropped (so the
    // delete trigger fires for cleanup destroys that follow).
    const triggers = await listV2FtsTriggers();
    if (triggers.length !== ALL_V2_FTS_TRIGGER_NAMES.length) {
      const tx = await sequelizeV2.transaction();
      try {
        await recreateV2FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    }

    await AuditV2.destroy({ where: {} });
    await UnitV2.destroy({ where: {}, truncate: true });
    await IssuanceV2.destroy({ where: {}, truncate: true });
    await ProjectV2.destroy({ where: {}, truncate: true });
    await MetaV2.destroy({ where: { meta_key: FTS5_DEFER_META_KEY_V2 } });
    // Explicit FTS truncation in case a prior test wrote to project/unit
    // while triggers were dropped (the cleanup destroys above only fire
    // delete triggers for rows currently visible to them).
    await sequelizeV2.query('DELETE FROM projects_v2_fts;');
    await sequelizeV2.query('DELETE FROM units_v2_fts;');
  });

  describe('audit composite indexes', function () {
    it('creates a composite index on (registry_id, generation)', async function () {
      const indexes = await listAuditV2Indexes();
      expect(indexes).to.include('audit_v2_registry_id_generation');
    });

    it('creates a composite index on (org_uid, generation)', async function () {
      const indexes = await listAuditV2Indexes();
      expect(indexes).to.include('audit_v2_org_uid_generation');
    });

    it('uses the registry_id composite index for the per-tick last-generation lookup', async function () {
      const plan = await sequelizeV2.query(
        `EXPLAIN QUERY PLAN SELECT * FROM audit
         WHERE registry_id = :registryId
         ORDER BY generation DESC
         LIMIT 1`,
        {
          replacements: { registryId: 'fake-registry-id' },
          type: sequelizeV2.QueryTypes.SELECT,
        },
      );
      const description = plan.map((row) => row.detail).join(' ');
      expect(description).to.match(/audit_v2_registry_id_generation/);
    });

    it('uses the org_uid composite index for the processJob mostRecentOrgAuditRecord lookup', async function () {
      // V2 audit lookup symmetric with V1 - see the V1 perf spec for
      // rationale.
      const plan = await sequelizeV2.query(
        `EXPLAIN QUERY PLAN SELECT * FROM audit
         WHERE org_uid = :orgUid
         ORDER BY generation DESC
         LIMIT 1`,
        {
          replacements: { orgUid: 'fake-org-uid' },
          type: sequelizeV2.QueryTypes.SELECT,
        },
      );
      const description = plan.map((row) => row.detail).join(' ');
      expect(description).to.match(/audit_v2_org_uid_generation/);
    });
  });

  describe('AuditV2.bulkCreate (already exposed) preserves audit row shape', function () {
    it('persists all rows with shared per-generation comment / author', async function () {
      const orgUid = uuidv4();
      const registryId = uuidv4();
      const rootHash = `0x${'a'.repeat(64)}`;
      const rows = Array.from({ length: 10 }, (_, idx) => ({
        org_uid: orgUid,
        registry_id: registryId,
        root_hash: rootHash,
        type: 'INSERT',
        table: 'project',
        change: JSON.stringify({ idx }),
        onchain_confirmation_time_stamp: '1700000000',
        generation: 5,
        comment: 'bulk-test-comment',
        author: 'bulk-test-author',
      }));

      await AuditV2.bulkCreate(rows);

      const persisted = await AuditV2.findAll({
        where: { registry_id: registryId, generation: 5 },
        raw: true,
      });
      expect(persisted).to.have.length(10);
      for (const row of persisted) {
        expect(row.comment).to.equal('bulk-test-comment');
        expect(row.author).to.equal('bulk-test-author');
        expect(row.org_uid).to.equal(orgUid);
        expect(row.registry_id).to.equal(registryId);
      }
    });
  });

  describe('FTS5 deferral helpers', function () {
    it('dropV2FtsTriggers removes all six project/unit FTS triggers idempotently', async function () {
      expect(await listV2FtsTriggers()).to.deep.equal(
        [...ALL_V2_FTS_TRIGGER_NAMES].sort(),
      );

      const tx = await sequelizeV2.transaction();
      try {
        await dropV2FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }
      expect(await listV2FtsTriggers()).to.have.length(0);

      // Idempotent re-drop.
      const tx2 = await sequelizeV2.transaction();
      try {
        await dropV2FtsTriggers(tx2);
        await tx2.commit();
      } catch (e) {
        await tx2.rollback();
        throw e;
      }
      expect(await listV2FtsTriggers()).to.have.length(0);
    });

    it('rebuildV2FtsTables repopulates projects_v2_fts/units_v2_fts from project/unit', async function () {
      // Drop triggers, insert directly into project/unit (so FTS is NOT
      // populated by triggers), then run rebuild.
      const tx = await sequelizeV2.transaction();
      try {
        await dropV2FtsTriggers(tx);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }

      const projectId = uuidv4();
      const orgUid = uuidv4();
      await ProjectV2.create({
        cadTrustProjectId: projectId,
        orgUid,
        projectRegistryName: 'reg',
        projectId: 'rebuildv2searchtoken',
        projectName: 'rebuildv2name',
      });

      expect(await projectsV2FtsCount()).to.equal(0);

      const tx2 = await sequelizeV2.transaction();
      try {
        await rebuildV2FtsTables(tx2);
        await tx2.commit();
      } catch (e) {
        await tx2.rollback();
        throw e;
      }

      expect(await projectsV2FtsCount()).to.equal(1);

      const [matches] = await sequelizeV2.query(
        "SELECT cad_trust_project_id FROM projects_v2_fts WHERE projects_v2_fts MATCH 'rebuildv2searchtoken';",
      );
      expect(matches.length).to.equal(1);
      expect(matches[0].cad_trust_project_id).to.equal(projectId);

      // Cleanup
      const tx3 = await sequelizeV2.transaction();
      try {
        await recreateV2FtsTriggers(tx3);
        await tx3.commit();
      } catch (e) {
        await tx3.rollback();
        throw e;
      }
      await ProjectV2.destroy({
        where: { cadTrustProjectId: projectId },
      });
    });
  });

  describe('FTS5 deferral state machine', function () {
    it('ensureV2FtsTriggersDeferred drops triggers and sets the meta flag', async function () {
      await ensureV2FtsTriggersDeferred();

      expect(await listV2FtsTriggers()).to.have.length(0);

      const flagRow = await MetaV2.findOne({
        where: { meta_key: FTS5_DEFER_META_KEY_V2 },
        raw: true,
      });
      expect(flagRow).to.exist;
    });

    it('ensureV2FtsTriggersDeferred is idempotent (safe to call twice)', async function () {
      await ensureV2FtsTriggersDeferred();
      await ensureV2FtsTriggersDeferred();

      expect(await listV2FtsTriggers()).to.have.length(0);

      const count = await MetaV2.count({
        where: { meta_key: FTS5_DEFER_META_KEY_V2 },
      });
      expect(count).to.equal(1);
    });

    it('restoreV2FtsTriggersAndRebuildIfDeferred is a no-op when flag is unset', async function () {
      const result = await restoreV2FtsTriggersAndRebuildIfDeferred();
      expect(result).to.equal(false);

      expect(await listV2FtsTriggers()).to.deep.equal(
        [...ALL_V2_FTS_TRIGGER_NAMES].sort(),
      );
    });

    it('restoreV2FtsTriggersAndRebuildIfDeferred recreates triggers + rebuilds + clears flag when set', async function () {
      await ensureV2FtsTriggersDeferred();
      expect(await listV2FtsTriggers()).to.have.length(0);

      const projectId = uuidv4();
      const orgUid = uuidv4();
      await ProjectV2.create({
        cadTrustProjectId: projectId,
        orgUid,
        projectRegistryName: 'reg',
        projectId: 'restorev2searchtoken',
        projectName: 'restorev2name',
      });

      expect(await projectsV2FtsCount()).to.equal(0);

      const result = await restoreV2FtsTriggersAndRebuildIfDeferred();
      expect(result).to.equal(true);

      expect(await listV2FtsTriggers()).to.deep.equal(
        [...ALL_V2_FTS_TRIGGER_NAMES].sort(),
      );

      const flagRow = await MetaV2.findOne({
        where: { meta_key: FTS5_DEFER_META_KEY_V2 },
        raw: true,
      });
      expect(flagRow).to.equal(null);

      expect(await projectsV2FtsCount()).to.equal(1);

      const [matches] = await sequelizeV2.query(
        "SELECT cad_trust_project_id FROM projects_v2_fts WHERE projects_v2_fts MATCH 'restorev2searchtoken';",
      );
      expect(matches.length).to.equal(1);

      // Cleanup
      await ProjectV2.destroy({
        where: { cadTrustProjectId: projectId },
      });
    });

    it('rebuild reflects rows in BOTH projects_v2_fts and units_v2_fts', async function () {
      await ensureV2FtsTriggersDeferred();

      const projectId = uuidv4();
      const unitId = uuidv4();
      const issuanceId = uuidv4();
      const orgUid = uuidv4();

      // First create a parent organization for context (V2 does not enforce
      // FK at the DB level, but we keep a coherent shape).
      await OrganizationsV2.findOrCreate({
        where: { org_uid: orgUid },
        defaults: {
          org_uid: orgUid,
          name: 'fts-perf-both-test',
          is_home: false,
          subscribed: true,
          synced: false,
          sync_remaining: 0,
          balance: '0',
          pending_balance: '0',
          metadata: '{}',
        },
      });

      await ProjectV2.create({
        cadTrustProjectId: projectId,
        orgUid,
        projectRegistryName: 'reg',
        projectId: 'p',
        projectName: 'p',
      });

      // IssuanceV2's required application-level fields are issuanceId,
      // cadTrustVerificationId, cadTrustProjectMethodologyId. We supply
      // placeholders; FTS doesn't depend on issuance content.
      await IssuanceV2.create({
        cadTrustIssuanceId: issuanceId,
        issuanceId: 'iss-' + issuanceId,
        cadTrustVerificationId: uuidv4(),
        cadTrustProjectMethodologyId: 'methodology-1',
      });

      await UnitV2.create({
        cadTrustUnitId: unitId,
        orgUid,
        cadTrustIssuanceId: issuanceId,
        unitSerialId: 'AAA1',
        unitStartBlock: 'AAA1',
        unitEndBlock: 'AAA1',
        unitCount: 1,
        unitVintageYear: 2025,
      });

      expect(await projectsV2FtsCount()).to.equal(0);
      expect(await unitsV2FtsCount()).to.equal(0);

      await restoreV2FtsTriggersAndRebuildIfDeferred();

      expect(await projectsV2FtsCount()).to.equal(1);
      expect(await unitsV2FtsCount()).to.equal(1);

      // Cleanup
      await UnitV2.destroy({ where: { cadTrustUnitId: unitId } });
      await IssuanceV2.destroy({
        where: { cadTrustIssuanceId: issuanceId },
      });
      await ProjectV2.destroy({
        where: { cadTrustProjectId: projectId },
      });
      await OrganizationsV2.destroy({ where: { org_uid: orgUid } });
    });

    it('boot recovery: prepareV2Db-style restore runs when meta flag is pre-set', async function () {
      await ensureV2FtsTriggersDeferred();

      const projectId = uuidv4();
      const orgUid = uuidv4();
      await ProjectV2.create({
        cadTrustProjectId: projectId,
        orgUid,
        projectRegistryName: 'reg',
        projectId: 'crashrecoverytokenv2',
        projectName: 'crashrecoveryv2',
      });

      const recovered = await restoreV2FtsTriggersAndRebuildIfDeferred();
      expect(recovered).to.equal(true);

      expect(await listV2FtsTriggers()).to.deep.equal(
        [...ALL_V2_FTS_TRIGGER_NAMES].sort(),
      );
      const flagRow = await MetaV2.findOne({
        where: { meta_key: FTS5_DEFER_META_KEY_V2 },
        raw: true,
      });
      expect(flagRow).to.equal(null);
      expect(await projectsV2FtsCount()).to.equal(1);

      // Cleanup
      await ProjectV2.destroy({
        where: { cadTrustProjectId: projectId },
      });
    });
  });
});
