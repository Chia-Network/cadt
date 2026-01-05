import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV2OrganizationReady,
  waitForV1OrganizationReady,
} from '../helpers/live-api-helpers.js';
import {
  setV2OrgUid,
  setV1OrgUid,
  setUpgradedV2OrgUid,
  clearOrganizationState,
  getOrganizationState,
} from '../helpers/organization-state.js';

describe('Organization Creation Tests', function () {
  this.timeout(7200000); // 120 minute timeout (multiple 30-minute operations)

  let request;

  before(async function () {
    // Clear any existing organization state
    clearOrganizationState();

    request = await getLiveApiRequest();
  });

  describe('V2 Organization Creation', function () {
    it('should create a new V2 organization and wait for completion', async function () {
      const orgData = {
        name: `Test V2 Organization ${Date.now()}`,
        icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
      };

      // Create V2 organization
      const createResponse = await request
        .post('/v2/organizations')
        .send(orgData);

      if (createResponse.status !== 200) {
        console.error(`POST /v2/organizations failed with status ${createResponse.status}:`);
        console.error(`Response body:`, JSON.stringify(createResponse.body, null, 2));
        if (createResponse.body?.error) {
          console.error(`Error message: ${createResponse.body.error}`);
        }
        if (createResponse.body?.message) {
          console.error(`Message: ${createResponse.body.message}`);
        }
      }

      expect(createResponse.status).to.equal(200);
      expect(createResponse.body.success).to.be.true;
      expect(createResponse.body.message).to.include('currently being created');

      // Wait for organization to be ready
      const result = await waitForV2OrganizationReady(request, orgData.name);
      const v2OrgUid = result.orgUid;

      // Save to shared state
      setV2OrgUid(v2OrgUid);

      // Verify organization details
      expect(result.organization.name).to.equal(orgData.name);
      expect(result.organization.synced).to.be.true;
      expect(result.organization.is_home).to.be.true;
      console.log(`✓ V2 Organization created and saved: ${v2OrgUid}`);
    });
  });

  describe('V1 Organization Creation and Upgrade', function () {
    it('should create a new V1 organization and wait for completion', async function () {
      const orgData = {
        name: `Test V1 Organization ${Date.now()}`,
        icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
      };

      // Create V1 organization (uses /v1/organizations/create endpoint)
      const createResponse = await request
        .post('/v1/organizations/create')
        .send(orgData);

      if (createResponse.status !== 200) {
        console.error(`POST /v1/organizations/create failed with status ${createResponse.status}:`);
        console.error(`Response body:`, JSON.stringify(createResponse.body, null, 2));
        if (createResponse.body?.error) {
          console.error(`Error message: ${createResponse.body.error}`);
        }
        if (createResponse.body?.message) {
          console.error(`Message: ${createResponse.body.message}`);
        }
      }

      expect(createResponse.status).to.equal(200);
      expect(createResponse.body.success).to.be.true;
      expect(createResponse.body.message).to.include('currently being created');

      // Wait for organization to be ready
      const result = await waitForV1OrganizationReady(request, orgData.name);
      const v1OrgUid = result.orgUid;

      // Save to shared state
      setV1OrgUid(v1OrgUid);

      // Verify organization details
      expect(result.organization.name).to.equal(orgData.name);
      expect(result.organization.isHome === true || result.organization.is_home === true).to.be.true;
      console.log(`✓ V1 Organization created and saved: ${v1OrgUid}`);
    });

    it('should upgrade V1 organization to V2 and wait for completion', async function () {
      const state = getOrganizationState();
      if (!state.v1OrgUid) {
        throw new Error('No V1 organization was created - cannot test upgrade');
      }

      // Upgrade V1 to V2
      const upgradeResponse = await request
        .post('/v2/organizations/upgrade');

      if (upgradeResponse.status !== 200) {
        console.error(`POST /v2/organizations/upgrade failed with status ${upgradeResponse.status}:`);
        console.error(`Response body:`, JSON.stringify(upgradeResponse.body, null, 2));
        if (upgradeResponse.body?.error) {
          console.error(`Error message: ${upgradeResponse.body.error}`);
        }
        if (upgradeResponse.body?.message) {
          console.error(`Message: ${upgradeResponse.body.message}`);
        }
      }

      expect(upgradeResponse.status).to.equal(200);
      expect(upgradeResponse.body.success).to.be.true;
      expect(upgradeResponse.body.message).to.include('currently being processed');

      // Wait for upgraded organization to be ready
      const result = await waitForV2OrganizationReady(request);
      const upgradedV2OrgUid = result.orgUid;

      // Save to shared state
      setUpgradedV2OrgUid(upgradedV2OrgUid);

      // Verify organization details
      expect(result.organization.synced).to.be.true;
      expect(result.organization.is_home).to.be.true;
      console.log(`✓ V1 Organization upgraded to V2 and saved: ${upgradedV2OrgUid}`);
    });
  });
});
