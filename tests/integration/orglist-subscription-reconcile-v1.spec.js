import { expect } from 'chai';
import { prepareDb } from '../../src/database';
import { Organization, Project, Staging, Meta } from '../../src/models';
import {
  buildOrgListAllowSet,
  removeOrgsNotInOrgList,
} from '../../src/utils/orglist-subscription-reconcile.js';
import { defaultConfig } from '../../src/utils/defaultConfig.js';

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
  });

  it('should unsubscribe and delete orgs not on orglist using V1 field names', async function () {
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
      },
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
    });

    expect(unsubscribed).to.deep.equal([ORG_C]);
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
      subscribed: true,
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
      deleteAllOrganizationData: (orgUid) =>
        Organization.deleteAllOrganizationData(orgUid, { skipStagingTruncate: true }),
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
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

    const defaultOrgList = [{ orgUid: ORG_A }];
    await removeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async () => {},
      deleteAllOrganizationData: (orgUid) =>
        Organization.deleteAllOrganizationData(orgUid, { skipStagingTruncate: true }),
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
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
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
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
      deleteAllOrganizationData: async (orgUid) => {
        deleted.push(orgUid);
        await Organization.destroy({ where: { orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
    });

    // Already unsubscribed -> DataLayer unsubscribe is skipped, but data is purged.
    expect(unsubscribed).to.deep.equal([]);
    expect(deleted).to.deep.equal([ORG_C]);
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

  it('should default ONLY_CADT_SUBSCRIPTIONS to true in shared APP config', function () {
    expect(defaultConfig.APP.ONLY_CADT_SUBSCRIPTIONS).to.equal(true);
  });
});
