import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV2OrganizationReady,
} from '../helpers/live-api-helpers.js';
import {
  setV2OrgUid,
  clearOrganizationState,
} from '../helpers/organization-state.js';
import { validateOrganizationStores } from '../helpers/datalayer-test-helpers.js';

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

      // Track org creation timing
      const orgCreateStartTime = Date.now();

      // Create V2 organization
      // Retry on transient wallet sync issues
      const maxRetries = 10;
      const retryDelayMs = 30000; // 30 seconds between retries
      let createResponse;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        createResponse = await request
          .post('/v2/organizations')
          .send(orgData);

        // Check if it's a transient wallet sync error
        const isWalletSyncError = createResponse.status === 400 &&
          (createResponse.body?.error?.includes('wallet is syncing') ||
           createResponse.body?.error?.includes('wallet is not available') ||
           createResponse.body?.error?.includes('Wallet') ||
           createResponse.body?.message === 'Chia Exception');

        // Check if server is still in startup phase (coin management)
        const isStartupPhaseError = createResponse.status === 503 &&
          createResponse.body?.startupPhase === 'coin_management';

        if (createResponse.status === 200) {
          break; // Success!
        } else if ((isWalletSyncError || isStartupPhaseError) && attempt < maxRetries) {
          const reason = isStartupPhaseError ? 'Server still starting (coin management)' : 'Wallet not ready';
          console.log(`[Attempt ${attempt}/${maxRetries}] ${reason}, retrying in ${retryDelayMs/1000}s...`);
          console.log(`  Error: ${createResponse.body?.error || createResponse.body?.message}`);
          lastError = createResponse.body?.error || createResponse.body?.message;
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        } else {
          // Non-retryable error or max retries reached
          break;
        }
      }

      if (createResponse.status !== 200) {
        console.error(`POST /v2/organizations failed with status ${createResponse.status}:`);
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
      const result = await waitForV2OrganizationReady(request, orgData.name);
      const v2OrgUid = result.orgUid;

      // Save to shared state
      setV2OrgUid(v2OrgUid);

      // Verify organization details
      expect(result.organization.name).to.equal(orgData.name);
      expect(result.organization.synced).to.be.true;
      expect(result.organization.is_home).to.be.true;

      // Verify all hashes are populated during org creation
      expect(result.organization.org_hash).to.be.a('string');
      expect(result.organization.org_hash).to.match(/^0x[a-f0-9]{64}$/i, 'org_hash should be a valid 32-byte hex hash');
      console.log(`  org_hash: ${result.organization.org_hash}`);

      expect(result.organization.data_model_version_store_hash).to.be.a('string');
      expect(result.organization.data_model_version_store_hash).to.match(/^0x[a-f0-9]{64}$/i, 'data_model_version_store_hash should be a valid 32-byte hex hash');
      console.log(`  data_model_version_store_hash: ${result.organization.data_model_version_store_hash}`);

      expect(result.organization.registry_hash).to.be.a('string');
      expect(result.organization.registry_hash).to.match(/^0x[a-f0-9]{64}$/i, 'registry_hash should be a valid 32-byte hex hash');
      console.log(`  registry_hash: ${result.organization.registry_hash}`);

      // Validate datalayer stores exist and contain expected data
      const datalayerValidation = await validateOrganizationStores(result.organization, true);
      expect(datalayerValidation.valid).to.be.true;
      if (!datalayerValidation.valid) {
        console.error('Datalayer validation errors:', datalayerValidation.errors);
      }

      // Org creation timing report
      const orgCreateElapsedMs = Date.now() - orgCreateStartTime;
      const orgCreateMinutes = Math.floor(orgCreateElapsedMs / 60000);
      const orgCreateSeconds = ((orgCreateElapsedMs % 60000) / 1000).toFixed(1);
      console.log(`\n╔══════════════════════════════════════════════════════════╗`);
      console.log(`║  V2 ORGANIZATION CREATION TIMING REPORT                  ║`);
      console.log(`╠══════════════════════════════════════════════════════════╣`);
      console.log(`║  Org UID:  ${v2OrgUid}`);
      console.log(`║  Duration: ${orgCreateMinutes}m ${orgCreateSeconds}s (${orgCreateElapsedMs}ms)`);
      console.log(`╚══════════════════════════════════════════════════════════╝`);

      console.log(`✓ V2 Organization created with all hashes populated: ${v2OrgUid}`);
    });
  });
});
