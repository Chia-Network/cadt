import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV1OrganizationReady,
} from '../helpers/live-api-helpers.js';
import {
  setV1OrgUid,
  clearOrganizationState,
} from '../helpers/organization-state.js';

/**
 * V1 Organization Creation Test
 *
 * This test creates a V1 organization using the V1 API.
 * Run this before other V1 live API tests to ensure an organization exists.
 *
 * Note: This is separate from V2 tests because you can only have one home organization.
 */
describe('V1 Organization Creation Tests', function () {
  this.timeout(3600000); // 60 minute timeout for org creation

  let request;

  before(async function () {
    // Clear any existing organization state
    clearOrganizationState();

    request = await getLiveApiRequest();
  });

  describe('V1 Organization Creation', function () {
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
  });
});
