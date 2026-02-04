import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV1OrganizationReady,
} from '../helpers/live-api-helpers.js';
import {
  setV1OrgUid,
  clearOrganizationState,
} from '../helpers/organization-state.js';
import { validateOrganizationStores } from '../helpers/datalayer-test-helpers.js';

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

    // Use V1 API version for health checks since V2 is disabled for V1 tests
    request = await getLiveApiRequest({ apiVersion: 'v1' });
  });

  describe('V1 Organization Creation', function () {
    it('should create a new V1 organization and wait for completion', async function () {
      const orgData = {
        name: `Test V1 Organization ${Date.now()}`,
        icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
      };

      // Create V1 organization (uses /v1/organizations/create endpoint)
      // Retry on transient wallet sync issues
      const maxRetries = 10;
      const retryDelayMs = 30000; // 30 seconds between retries
      let createResponse;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        createResponse = await request
          .post('/v1/organizations/create')
          .send(orgData);

        // Check if it's a transient wallet sync error
        const isWalletSyncError = createResponse.status === 400 &&
          (createResponse.body?.error?.includes('wallet is syncing') ||
           createResponse.body?.error?.includes('wallet is not available') ||
           createResponse.body?.error?.includes('Wallet') ||
           createResponse.body?.message === 'Chia Exception');

        if (createResponse.status === 200) {
          break; // Success!
        } else if (isWalletSyncError && attempt < maxRetries) {
          console.log(`[Attempt ${attempt}/${maxRetries}] Wallet not ready, retrying in ${retryDelayMs/1000}s...`);
          console.log(`  Error: ${createResponse.body?.error || createResponse.body?.message}`);
          lastError = createResponse.body?.error || createResponse.body?.message;
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        } else {
          // Non-retryable error or max retries reached
          break;
        }
      }

      if (createResponse.status !== 200) {
        console.error(`POST /v1/organizations/create failed with status ${createResponse.status}:`);
        console.error(`Response body:`, JSON.stringify(createResponse.body, null, 2));
        if (createResponse.body?.error) {
          console.error(`Error message: ${createResponse.body.error}`);
        }
        if (createResponse.body?.message) {
          console.error(`Message: ${createResponse.body.message}`);
        }
        if (lastError) {
          console.error(`Last retry error: ${lastError}`);
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

      // Verify all hashes are populated during org creation (V1 uses camelCase)
      expect(result.organization.orgHash).to.be.a('string');
      expect(result.organization.orgHash).to.match(/^0x[a-f0-9]{64}$/i, 'orgHash should be a valid 32-byte hex hash');
      console.log(`  orgHash: ${result.organization.orgHash}`);

      expect(result.organization.dataModelVersionStoreHash).to.be.a('string');
      expect(result.organization.dataModelVersionStoreHash).to.match(/^0x[a-f0-9]{64}$/i, 'dataModelVersionStoreHash should be a valid 32-byte hex hash');
      console.log(`  dataModelVersionStoreHash: ${result.organization.dataModelVersionStoreHash}`);

      expect(result.organization.registryHash).to.be.a('string');
      expect(result.organization.registryHash).to.match(/^0x[a-f0-9]{64}$/i, 'registryHash should be a valid 32-byte hex hash');
      console.log(`  registryHash: ${result.organization.registryHash}`);

      // Validate datalayer stores exist and contain expected data
      const datalayerValidation = await validateOrganizationStores(result.organization, false);
      expect(datalayerValidation.valid).to.be.true;
      if (!datalayerValidation.valid) {
        console.error('Datalayer validation errors:', datalayerValidation.errors);
      }

      console.log(`✓ V1 Organization created with all hashes populated: ${v1OrgUid}`);
    });
  });
});
