import { expect } from 'chai';
import sinon from 'sinon';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { OrganizationsV2, GovernanceV2, ProjectV2 } from '../../../src/models/v2/index.js';
import {
  buildOrgListAllowSet,
  unsubscribeOrgsNotInOrgList,
} from '../../../src/utils/orglist-subscription-reconcile.js';
import { defaultConfig } from '../../../src/utils/defaultConfig.js';
import { v4 as uuidv4 } from 'uuid';

const GOVERNANCE_BODY_ID = defaultConfig.V2.GOVERNANCE.GOVERNANCE_BODY_ID;
const ORG_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ORG_C = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

describe('orglist-subscription-reconcile (V2)', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
  });

  beforeEach(async function () {
    await OrganizationsV2.destroy({ where: {} });
    await GovernanceV2.destroy({ where: {} });
    await ProjectV2.destroy({ where: {} });
  });

  describe('buildOrgListAllowSet', function () {
    it('should include orgList UIDs and governance body id', function () {
      const allowSet = buildOrgListAllowSet(
        [{ orgUid: ORG_A }, { orgUid: ORG_B }],
        GOVERNANCE_BODY_ID,
      );
      expect(allowSet.has(ORG_A)).to.equal(true);
      expect(allowSet.has(ORG_B)).to.equal(true);
      expect(allowSet.has(GOVERNANCE_BODY_ID)).to.equal(true);
      expect(allowSet.has(ORG_C)).to.equal(false);
    });
  });

  describe('unsubscribeOrgsNotInOrgList', function () {
    it('should skip when orglist is empty', async function () {
      const unsubscribeStub = sinon.stub().resolves();
      await unsubscribeOrgsNotInOrgList({
        defaultOrgList: [],
        allowSet: new Set(),
        organizationModel: OrganizationsV2,
        fieldNames: { orgUid: 'org_uid', isHome: 'is_home', subscribed: 'subscribed' },
        unsubscribeFromOrganizationStores: unsubscribeStub,
        logger: { info: () => {}, warn: () => {} },
      });
      expect(unsubscribeStub.called).to.equal(false);
    });

    it('should unsubscribe orgs not on orglist but keep home and governance body', async function () {
      await OrganizationsV2.create({
        org_uid: ORG_A,
        name: 'Org A',
        is_home: false,
        subscribed: true,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        registry_id: 'reg-a',
        data_model_version_store_id: 'singleton-a',
      });
      await OrganizationsV2.create({
        org_uid: ORG_C,
        name: 'Org C',
        is_home: false,
        subscribed: true,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        registry_id: 'reg-c',
        data_model_version_store_id: 'singleton-c',
      });
      await OrganizationsV2.create({
        org_uid: GOVERNANCE_BODY_ID,
        name: 'Governance',
        is_home: false,
        subscribed: true,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        registry_id: 'reg-gov',
        data_model_version_store_id: 'singleton-gov',
      });
      await OrganizationsV2.create({
        org_uid: ORG_B,
        name: 'Home',
        is_home: true,
        subscribed: true,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        registry_id: 'reg-home',
        data_model_version_store_id: 'singleton-home',
      });

      const unsubscribed = [];
      const unsubscribeFn = async (org) => {
        unsubscribed.push(org.org_uid);
        await OrganizationsV2.update(
          { subscribed: false },
          { where: { org_uid: org.org_uid } },
        );
      };

      const defaultOrgList = [{ orgUid: ORG_A }];
      const allowSet = buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID);
      await unsubscribeOrgsNotInOrgList({
        defaultOrgList,
        allowSet,
        organizationModel: OrganizationsV2,
        fieldNames: { orgUid: 'org_uid', isHome: 'is_home', subscribed: 'subscribed' },
        unsubscribeFromOrganizationStores: unsubscribeFn,
        logger: { info: () => {}, warn: () => {} },
      });

      expect(unsubscribed).to.deep.equal([ORG_C]);

      const orgA = await OrganizationsV2.findOne({ where: { org_uid: ORG_A }, raw: true });
      const orgC = await OrganizationsV2.findOne({ where: { org_uid: ORG_C }, raw: true });
      const gov = await OrganizationsV2.findOne({
        where: { org_uid: GOVERNANCE_BODY_ID },
        raw: true,
      });
      const home = await OrganizationsV2.findOne({ where: { org_uid: ORG_B }, raw: true });

      expect(Boolean(orgA.subscribed)).to.equal(true);
      expect(Boolean(orgC.subscribed)).to.equal(false);
      expect(Boolean(gov.subscribed)).to.equal(true);
      expect(Boolean(home.subscribed)).to.equal(true);
    });

    it('should not unsubscribe orgs already marked subscribed false', async function () {
      await OrganizationsV2.create({
        org_uid: ORG_C,
        name: 'Org C',
        is_home: false,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      const unsubscribeStub = sinon.stub().resolves();
      const defaultOrgList = [{ orgUid: ORG_A }];
      await unsubscribeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames: { orgUid: 'org_uid', isHome: 'is_home', subscribed: 'subscribed' },
        unsubscribeFromOrganizationStores: unsubscribeStub,
        logger: { info: () => {}, warn: () => {} },
      });

      expect(unsubscribeStub.called).to.equal(false);
    });

    it('should retain synced registry data after unsubscribe', async function () {
      await OrganizationsV2.create({
        org_uid: ORG_C,
        name: 'Org C',
        is_home: false,
        subscribed: true,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
        registry_id: 'reg-c',
        data_model_version_store_id: 'singleton-c',
      });
      await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: ORG_C,
        projectRegistryName: 'Removed Org Registry',
        projectId: 'proj-1',
        projectName: 'Stale Project',
      });

      const defaultOrgList = [{ orgUid: ORG_A }];
      await unsubscribeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames: { orgUid: 'org_uid', isHome: 'is_home', subscribed: 'subscribed' },
        unsubscribeFromOrganizationStores: async (org) => {
          await OrganizationsV2.update(
            { subscribed: false },
            { where: { org_uid: org.org_uid } },
          );
        },
        logger: { info: () => {}, warn: () => {} },
      });

      const project = await ProjectV2.findOne({
        where: { projectId: 'proj-1' },
        raw: true,
      });
      expect(project).to.exist;
      expect(project.projectName).to.equal('Stale Project');
    });
  });

  describe('defaultConfig', function () {
    it('should default ONLY_CADT_SUBSCRIPTIONS to false', function () {
      expect(defaultConfig.APP.ONLY_CADT_SUBSCRIPTIONS).to.equal(false);
    });
  });
});
