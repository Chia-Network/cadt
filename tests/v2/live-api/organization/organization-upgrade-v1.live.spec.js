import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV2OrganizationReady,
  waitForV1OrganizationReady,
} from '../helpers/live-api-helpers.js';
import {
  setV1OrgUid,
  setUpgradedV2OrgUid,
  clearOrganizationState,
  getOrganizationState,
} from '../helpers/organization-state.js';

/**
 * V1 to V2 Organization Upgrade Test
 *
 * This test creates a V1 organization and then upgrades it to V2.
 * This tests the migration path for existing V1 users.
 *
 * IMPORTANT: This test must be run in a separate CI job from other organization
 * creation tests because you can only have ONE home organization.
 * Run this with a fresh database (no existing home org).
 */
describe('V1 to V2 Organization Upgrade Tests', function () {
  this.timeout(7200000); // 120 minute timeout (V1 creation + upgrade)

  let request;
  let v1OrgName;

  before(async function () {
    // Clear any existing organization state
    clearOrganizationState();

    request = await getLiveApiRequest();
  });

  describe('V1 Organization Creation (for upgrade)', function () {
    it('should create a new V1 organization and wait for completion', async function () {
      const orgData = {
        name: `Test V1 Upgrade Org ${Date.now()}`,
        icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
      };
      v1OrgName = orgData.name;

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
      console.log(`✓ V1 Organization created: ${v1OrgUid}`);
    });
  });

  describe('V1 to V2 Upgrade', function () {
    it('should upgrade V1 organization to V2 and wait for completion', async function () {
      const state = getOrganizationState();
      if (!state.v1OrgUid) {
        throw new Error('No V1 organization was created - cannot test upgrade');
      }

      console.log(`Upgrading V1 organization ${state.v1OrgUid} to V2...`);

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
      console.log(`✓ V1 Organization upgraded to V2: ${upgradedV2OrgUid}`);
    });
  });
});
