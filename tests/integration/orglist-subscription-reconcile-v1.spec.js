import { expect } from 'chai';
import { prepareDb } from '../../src/database';
import { Organization } from '../../src/models';
import {
  buildOrgListAllowSet,
  unsubscribeOrgsNotInOrgList,
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
  });

  it('should unsubscribe orgs not on orglist using V1 field names', async function () {
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
    const defaultOrgList = [{ orgUid: ORG_A }];
    await unsubscribeOrgsNotInOrgList({
      defaultOrgList,
      allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
      organizationModel: Organization,
      fieldNames: { orgUid: 'orgUid', isHome: 'isHome', subscribed: 'subscribed' },
      unsubscribeFromOrganizationStores: async (org) => {
        unsubscribed.push(org.orgUid);
        await Organization.update({ subscribed: false }, { where: { orgUid: org.orgUid } });
      },
      logger: { info: () => {}, warn: () => {} },
      apiVersionLabel: 'v1',
    });

    expect(unsubscribed).to.deep.equal([ORG_C]);
    const orgC = await Organization.findOne({ where: { orgUid: ORG_C }, raw: true });
    expect(Boolean(orgC.subscribed)).to.equal(false);
  });

  it('should default ONLY_CADT_SUBSCRIPTIONS to false in shared APP config', function () {
    expect(defaultConfig.APP.ONLY_CADT_SUBSCRIPTIONS).to.equal(false);
  });
});
