import { expect } from 'chai';
import sinon from 'sinon';
import { Op } from 'sequelize';
import { prepareDb } from '../../src/database';
import { Organization, Project, Staging, Meta, Governance } from '../../src/models';
import {
  buildOrgListAllowSet,
  removeOrgsNotInOrgList,
  resetOrgListReconcileState,
  resolvePurgeGraceCycles,
} from '../../src/utils/orglist-subscription-reconcile.js';
import { defaultConfig } from '../../src/utils/defaultConfig.js';
import {
  destroyByPrimaryKeyBatches,
  resolveDeleteBatchSize,
} from '../../src/utils/batched-delete.js';
import {
  isGovernanceReady,
  markGovernanceNotReady,
  markGovernanceReady,
  resetGovernanceReadiness,
} from '../../src/utils/governance-readiness.js';

const GOVERNANCE_BODY_ID = defaultConfig.V1.GOVERNANCE.GOVERNANCE_BODY_ID;
const ORG_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORG_C = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

const V1_FIELD_NAMES = {
  orgUid: 'orgUid',
  isHome: 'isHome',
  subscribed: 'subscribed',
};

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {} };

// Runs one reconcile cycle against the V1 wiring. `orgList` drives both the
// raw list and the derived allow set; every other collaborator has a
// no-op/permissive default that tests override only where they assert on it.
const reconcile = ({ orgList = [{ orgUid: ORG_A }], ...overrides } = {}) => {
  // Derive from the effective list so an override of either key can't leave
  // the allow set describing a different org list than defaultOrgList.
  const effectiveOrgList = overrides.defaultOrgList ?? orgList;
  return removeOrgsNotInOrgList({
    defaultOrgList: effectiveOrgList,
    allowSet: buildOrgListAllowSet(effectiveOrgList, GOVERNANCE_BODY_ID),
    organizationModel: Organization,
    fieldNames: V1_FIELD_NAMES,
    unsubscribeFromOrganizationStores: async () => {},
    isStoreUnsubscribed: async () => true,
    deleteAllOrganizationData: async () => {},
    logger: silentLogger,
    apiVersionLabel: 'v1',
    graceCycles: 1,
    ...overrides,
  });
};

describe('orglist-subscription-reconcile (V1)', function () {
  this.timeout(30000);

  before(async function () {
    await prepareDb();
  });

  beforeEach(async function () {
    await Organization.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await Staging.truncate();
    await Meta.destroy({ where: {} });
    resetOrgListReconcileState();
    resetGovernanceReadiness();
  });

  // A test aborted by timeout never reaches its own restore, which would leave
  // a stub installed for the rest of the file.
  afterEach(function () {
    sinon.restore();
  });

  it('should unsubscribe and delete orgs after the grace cycle using V1 field names', async function () {
    await Organization.create({
      orgUid: ORG_A,
      name: 'Org A',
      isHome: false,
      subscribed: true,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: true,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    const unsubscribed = [];
    const deleted = [];
    const trackUnsubscribe = async (org) => {
      unsubscribed.push(org.orgUid);
    };
    const trackDelete = async (orgUid) => {
      deleted.push(orgUid);
      await Organization.destroy({ where: { orgUid } });
    };

    await reconcile({
      unsubscribeFromOrganizationStores: async (org) => {
        await trackUnsubscribe(org);
        await Organization.update(
          { subscribed: false },
          { where: { orgUid: org.orgUid } },
        );
      },
      deleteAllOrganizationData: trackDelete,
      graceCycles: 2,
    });

    expect(unsubscribed).to.deep.equal([ORG_C]);
    expect(deleted).to.deep.equal([]);

    await reconcile({
      unsubscribeFromOrganizationStores: trackUnsubscribe,
      deleteAllOrganizationData: trackDelete,
      graceCycles: 2,
    });

    expect(deleted).to.deep.equal([]);

    await reconcile({
      unsubscribeFromOrganizationStores: trackUnsubscribe,
      deleteAllOrganizationData: trackDelete,
      graceCycles: 2,
    });

    expect(deleted).to.deep.equal([ORG_C]);
    const orgC = await Organization.findOne({ where: { orgUid: ORG_C }, raw: true });
    expect(orgC).to.equal(null);
    const orgA = await Organization.findOne({ where: { orgUid: ORG_A }, raw: true });
    expect(orgA).to.not.equal(null);
  });

  it('should purge removed org data and the org row via deleteAllOrganizationData', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      registryId: 'reg-c',
      dataModelVersionStoreId: 'singleton-c',
      metadata: '{}',
    });
    await Project.create({
      orgUid: ORG_C,
      warehouseProjectId: 'wh-proj-c',
      projectId: 'proj-c',
      projectName: 'Removed Org Project',
    });

    await reconcile({
      deleteAllOrganizationData: (orgUid) =>
        Organization.deleteAllOrganizationData(orgUid, { skipStagingTruncate: true }),
    });

    const orgC = await Organization.findOne({ where: { orgUid: ORG_C }, raw: true });
    expect(orgC).to.equal(null);
    const projects = await Project.findAll({ where: { orgUid: ORG_C }, raw: true });
    expect(projects).to.have.length(0);
  });

  it('should not truncate home-org staging when skipStagingTruncate is set', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });
    await Staging.create({
      uuid: 'pending-home-change',
      table: 'projects',
      action: 'INSERT',
      data: '{}',
    });

    await reconcile({
      deleteAllOrganizationData: (orgUid) =>
        Organization.deleteAllOrganizationData(orgUid, { skipStagingTruncate: true }),
    });

    const stagingRows = await Staging.findAll({ raw: true });
    expect(stagingRows).to.have.length(1);
  });

  it('should truncate staging by default (when skipStagingTruncate is not set)', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: true,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });
    await Staging.create({
      uuid: 'pending-home-change',
      table: 'projects',
      action: 'INSERT',
      data: '{}',
    });

    await Organization.deleteAllOrganizationData(ORG_C);

    const stagingRows = await Staging.findAll({ raw: true });
    expect(stagingRows).to.have.length(0);
  });

  it('should never remove the home organization', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Home Org',
      isHome: true,
      subscribed: true,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    const deleted = [];
    await reconcile({
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
    });

    expect(deleted).to.deep.equal([]);
    const home = await Organization.findOne({ where: { orgUid: ORG_C }, raw: true });
    expect(home).to.not.equal(null);
  });

  it('should purge orgs already locally unsubscribed but off the orglist', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    const unsubscribed = [];
    const deleted = [];
    await reconcile({
      unsubscribeFromOrganizationStores: async (org) => {
        unsubscribed.push(org.orgUid);
      },
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
    });

    // Already unsubscribed -> DataLayer unsubscribe is skipped, but data is purged.
    expect(unsubscribed).to.deep.equal([]);
    expect(deleted).to.deep.equal([ORG_C]);
  });

  it('should defer purge while the org stores are still subscribed', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    const deleted = [];
    await reconcile({
      isStoreUnsubscribed: async () => false,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
    });

    expect(deleted).to.deep.equal([]);
    const orgC = await Organization.findOne({ where: { orgUid: ORG_C }, raw: true });
    expect(orgC).to.not.equal(null);
  });

  it('should clear the off-orglist streak when an org returns to the allow list', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    const deleted = [];
    const trackDelete = async (orgUid) => {
      deleted.push(orgUid);
    };

    await reconcile({
      deleteAllOrganizationData: trackDelete,
      graceCycles: 2,
    });

    await reconcile({
      orgList: [{ orgUid: ORG_A }, { orgUid: ORG_C }],
      deleteAllOrganizationData: trackDelete,
      graceCycles: 2,
    });

    await reconcile({
      deleteAllOrganizationData: trackDelete,
      graceCycles: 2,
    });

    expect(deleted).to.deep.equal([]);
  });

  it('should restart the grace streak if unsubscribe confirmation is interrupted', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    const deleted = [];
    let isUnsubscribed = true;
    let confirmationError = null;
    const cycle = () =>
      reconcile({
        isStoreUnsubscribed: async () => {
          if (confirmationError) {
            throw confirmationError;
          }
          return isUnsubscribed;
        },
        deleteAllOrganizationData: async (orgUid) => {
          deleted.push(orgUid);
        },
        graceCycles: 2,
      });

    await cycle();
    expect(deleted).to.deep.equal([]);

    confirmationError = new Error('datalayer unreachable');
    await cycle();
    expect(deleted).to.deep.equal([]);

    confirmationError = null;
    await cycle();
    expect(deleted).to.deep.equal([]);

    isUnsubscribed = false;
    await cycle();
    expect(deleted).to.deep.equal([]);

    isUnsubscribed = true;
    await cycle();
    expect(deleted).to.deep.equal([]);

    await cycle();
    expect(deleted).to.deep.equal([ORG_C]);
  });

  it('should delete V1 org data across multiple batches', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: false,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });
    for (let i = 0; i < 3; i += 1) {
      await Project.create({
        orgUid: ORG_C,
        warehouseProjectId: `wh-proj-c-${i}`,
        projectId: `proj-c-${i}`,
        projectName: `Removed Org Project ${i}`,
      });
    }

    const deletedCount = await Organization.deleteAllOrganizationData(ORG_C, {
      skipStagingTruncate: true,
      recordUserDeleted: false,
      useCommittedBatches: true,
      batchSize: 1,
    });

    expect(deletedCount).to.be.greaterThan(3);
    expect(await Project.count({ where: { orgUid: ORG_C } })).to.equal(0);
    expect(await Organization.count({ where: { orgUid: ORG_C } })).to.equal(0);
  });

  it('should delete selected primary keys in bounded batches', async function () {
    let rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const findCalls = [];
    const destroyIds = [];
    let transactionRunnerCalls = 0;
    const fakeModel = {
      name: 'FakeModel',
      primaryKeyAttributes: ['id'],
      findAll: async (options) => {
        findCalls.push(options);
        return rows.slice(0, options.limit);
      },
      destroy: async ({ where }) => {
        const ids = where.id[Op.in];
        destroyIds.push(ids);
        rows = rows.filter((row) => !ids.includes(row.id));
        return ids.length;
      },
    };

    const deleted = await destroyByPrimaryKeyBatches(fakeModel, {
      where: { orgUid: ORG_C },
      batchSize: 1,
      transactionRunner: async (operation) => {
        transactionRunnerCalls += 1;
        return await operation({ id: transactionRunnerCalls });
      },
    });

    expect(deleted).to.equal(3);
    expect(findCalls.every((call) => call.limit === 1)).to.equal(true);
    expect(destroyIds).to.deep.equal([[1], [2], [3]]);
    expect(transactionRunnerCalls).to.equal(4);
  });

  it('should not record the org as user-deleted when recordUserDeleted is false', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: true,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    await Organization.deleteAllOrganizationData(ORG_C, {
      recordUserDeleted: false,
    });

    const userDeleted = (await Meta.getUserDeletedOrgUids()) || [];
    expect(userDeleted).to.not.include(ORG_C);
  });

  it('should record the org as user-deleted by default', async function () {
    await Organization.create({
      orgUid: ORG_C,
      name: 'Org C',
      isHome: false,
      subscribed: true,
      synced: false,
      sync_remaining: 0,
      metadata: '{}',
    });

    await Organization.deleteAllOrganizationData(ORG_C);

    const userDeleted = await Meta.getUserDeletedOrgUids();
    expect(userDeleted).to.include(ORG_C);
  });

  it('should track governance readiness per API version', function () {
    expect(isGovernanceReady('v1')).to.equal(false);
    expect(isGovernanceReady('v2')).to.equal(false);

    markGovernanceReady('v1');

    expect(isGovernanceReady('v1')).to.equal(true);
    expect(isGovernanceReady('v2')).to.equal(false);

    markGovernanceNotReady('v1');

    expect(isGovernanceReady('v1')).to.equal(false);
  });

  it('should expire governance readiness once the last confirmed-good sync is stale', function () {
    const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });

    try {
      markGovernanceReady('v1');
      expect(isGovernanceReady('v1')).to.equal(true);

      // Readiness holds for five default 120s sync intervals, so a handful of
      // failed syncs does not gate the purge off.
      clock.tick(9 * 60 * 1000);
      expect(isGovernanceReady('v1')).to.equal(true);

      clock.tick(2 * 60 * 1000);
      expect(isGovernanceReady('v1')).to.equal(false);
    } finally {
      clock.restore();
    }
  });

  it('should keep governance readiness while a sync is in flight', async function () {
    markGovernanceReady('v1');

    let releaseUpsert;
    const upsertGate = new Promise((resolve) => {
      releaseUpsert = resolve;
    });
    let upsertStarted;
    const upsertReached = new Promise((resolve) => {
      upsertStarted = resolve;
    });

    const upsertStub = sinon.stub(Governance, 'upsert').callsFake(async () => {
      upsertStarted();
      await upsertGate;
    });

    try {
      const syncPromise = Governance.sync();
      await upsertReached;

      // A sync that has started but not finished must not lower readiness: the
      // purge gate is polled by a task on the same interval, so it would read
      // the cleared value for the whole cycle.
      expect(isGovernanceReady('v1')).to.equal(true);

      releaseUpsert();
      await syncPromise;
    } finally {
      upsertStub.restore();
    }
  });

  it('should mark V1 governance ready after fallback governance sync', async function () {
    markGovernanceNotReady('v1');

    await Governance.sync();

    expect(isGovernanceReady('v1')).to.equal(true);
  });

  it('should report whether a governance download included orgList', async function () {
    const withoutOrgList = await Governance.upsertGovernanceDownload('gov-store', {
      glossary: '[]',
      pickList: '[]',
    });
    expect(withoutOrgList.hasOrgList).to.equal(false);

    const withOrgList = await Governance.upsertGovernanceDownload('gov-store', {
      orgList: '[]',
      glossary: '[]',
      pickList: '[]',
    });
    expect(withOrgList.hasOrgList).to.equal(true);
  });

  it('should default ONLY_CADT_SUBSCRIPTIONS to true in shared APP config', function () {
    expect(defaultConfig.APP.ONLY_CADT_SUBSCRIPTIONS).to.equal(true);
    expect(resolveDeleteBatchSize('invalid')).to.equal(1000);
    expect(resolveDeleteBatchSize('7rows')).to.equal(1000);
    expect(resolveDeleteBatchSize('2.5')).to.equal(1000);
    expect(resolveDeleteBatchSize(2)).to.equal(2);
    expect(resolvePurgeGraceCycles('invalid')).to.equal(3);
    expect(resolvePurgeGraceCycles('2cycles')).to.equal(3);
    expect(resolvePurgeGraceCycles('2.5')).to.equal(3);
    expect(resolvePurgeGraceCycles(0)).to.equal(3);
    expect(resolvePurgeGraceCycles(2)).to.equal(2);
  });
});
