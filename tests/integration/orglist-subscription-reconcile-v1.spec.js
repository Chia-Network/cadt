import { expect } from 'chai';
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
import { getConfig } from '../../src/utils/config-loader.js';
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
    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async (org) => {
        unsubscribed.push(org.orgUid);
        await Organization.update(
          { subscribed: false },
          { where: { orgUid: org.orgUid } },
        );
      },
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 2,
    });

    expect(unsubscribed).to.deep.equal([ORG_C]);
    expect(deleted).to.deep.equal([]);

    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async (org) => {
        unsubscribed.push(org.orgUid);
      },
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 2,
    });

    expect(deleted).to.deep.equal([]);

    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async (org) => {
        unsubscribed.push(org.orgUid);
      },
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
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

    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: (orgUid) =>
        Organization.deleteAllOrganizationData(orgUid, { skipStagingTruncate: true }),
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 1,
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

    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: (orgUid) =>
        Organization.deleteAllOrganizationData(orgUid, { skipStagingTruncate: true }),
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 1,
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
    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 1,
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
    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async (org) => {
        unsubscribed.push(org.orgUid);
      },
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 1,
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
    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => false,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 1,
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
    await removeOrgsNotInOrgList({
      defaultOrgList: [{ orgUid: ORG_A }],
      allowSet: buildOrgListAllowSet([{ orgUid: ORG_A }], GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 2,
    });

    await removeOrgsNotInOrgList({
      defaultOrgList: [{ orgUid: ORG_A }, { orgUid: ORG_C }],
      allowSet: buildOrgListAllowSet(
        [{ orgUid: ORG_A }, { orgUid: ORG_C }],
        GOVERNANCE_BODY_ID,
      ),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      apiVersionLabel: 'v1',
      graceCycles: 2,
    });

    await removeOrgsNotInOrgList({
      defaultOrgList: [{ orgUid: ORG_A }],
      allowSet: buildOrgListAllowSet([{ orgUid: ORG_A }], GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      isStoreUnsubscribed: async () => true,
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      apiVersionLabel: 'v1',
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
    const reconcile = () =>
      removeOrgsNotInOrgList({
        defaultOrgList: [{ orgUid: ORG_A }],
        allowSet: buildOrgListAllowSet([{ orgUid: ORG_A }], GOVERNANCE_BODY_ID),
        organizationModel: Organization,
        fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
        unsubscribeFromOrganizationStores: async () => {},
        isStoreUnsubscribed: async () => {
          if (confirmationError) {
            throw confirmationError;
          }
          return isUnsubscribed;
        },
        deleteAllOrganizationData: async (orgUid) => {
          deleted.push(orgUid);
        },
        logger: { info: () => {}, warn: () => {}, debug: () => {} },
        apiVersionLabel: 'v1',
        graceCycles: 2,
      });

    await reconcile();
    expect(deleted).to.deep.equal([]);

    confirmationError = new Error('datalayer unreachable');
    await reconcile();
    expect(deleted).to.deep.equal([]);

    confirmationError = null;
    await reconcile();
    expect(deleted).to.deep.equal([]);

    isUnsubscribed = false;
    await reconcile();
    expect(deleted).to.deep.equal([]);

    isUnsubscribed = true;
    await reconcile();
    expect(deleted).to.deep.equal([]);

    await reconcile();
    expect(deleted).to.deep.equal([ORG_C]);
  });

  it('should delete V1 org data across multiple batches', async function () {
    const config = getConfig();
    const originalBatchSize = config.APP.ORG_PURGE_DELETE_BATCH_SIZE;
    config.APP.ORG_PURGE_DELETE_BATCH_SIZE = 1;
    try {
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
      });

      expect(deletedCount).to.be.greaterThan(3);
      expect(await Project.count({ where: { orgUid: ORG_C } })).to.equal(0);
      expect(await Organization.count({ where: { orgUid: ORG_C } })).to.equal(0);
    } finally {
      config.APP.ORG_PURGE_DELETE_BATCH_SIZE = originalBatchSize;
    }
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

  it('should clear V1 governance readiness when sync does not provide orgList', async function () {
    markGovernanceReady('v1');

    await Governance.sync();

    expect(isGovernanceReady('v1')).to.equal(false);
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
    expect(defaultConfig.APP.ONLY_CADT_SUBSCRIPTIONS_PURGE_GRACE_CYCLES).to.equal(3);
    expect(defaultConfig.APP.ORG_PURGE_DELETE_BATCH_SIZE).to.equal(5000);
    expect(resolveDeleteBatchSize('invalid')).to.equal(5000);
    expect(resolveDeleteBatchSize('7rows')).to.equal(5000);
    expect(resolveDeleteBatchSize('2.5')).to.equal(5000);
    expect(resolveDeleteBatchSize(2)).to.equal(2);
    expect(resolvePurgeGraceCycles('invalid')).to.equal(3);
    expect(resolvePurgeGraceCycles('2cycles')).to.equal(3);
    expect(resolvePurgeGraceCycles('2.5')).to.equal(3);
    expect(resolvePurgeGraceCycles(0)).to.equal(3);
    expect(resolvePurgeGraceCycles(2)).to.equal(2);
  });
});
