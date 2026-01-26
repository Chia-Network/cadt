import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV2OrganizationReady,
} from '../helpers/live-api-helpers.js';
import {
  setV2OrgUid,
  clearOrganizationState,
} from '../helpers/organization-state.js';

/**
 * V2 Organization Creation Test
 *
 * This test creates a V2 organization directly using the V2 API.
 * Run this before other V2 live API tests to ensure an organization exists.
 *
 * Note: This is separate from the V1 upgrade test because you can only have
 * one home organization. The V1 upgrade test (organization-upgrade-v1.live.spec.js)
 * should be run in a separate CI job with a fresh database.
 */
describe('V2 Organization Creation Tests', function () {
  this.timeout(3600000); // 60 minute timeout for org creation

  let request;

  before(async function () {
    // Clear any existing organization state
    clearOrganizationState();

    // Use V2 API version for health checks
    request = await getLiveApiRequest({ apiVersion: 'v2' });
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
});
