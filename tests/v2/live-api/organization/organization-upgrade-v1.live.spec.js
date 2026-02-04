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
import { validateOrganizationStores } from '../helpers/datalayer-test-helpers.js';

// Store V1 organization details for comparison after upgrade
let v1OrganizationDetails = null;

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

      // Verify all hashes are populated during V1 org creation (V1 uses camelCase)
      expect(result.organization.orgHash).to.be.a('string');
      expect(result.organization.orgHash).to.match(/^0x[a-f0-9]{64}$/i, 'orgHash should be a valid 32-byte hex hash');
      console.log(`  orgHash: ${result.organization.orgHash}`);

      expect(result.organization.dataModelVersionStoreHash).to.be.a('string');
      expect(result.organization.dataModelVersionStoreHash).to.match(/^0x[a-f0-9]{64}$/i, 'dataModelVersionStoreHash should be a valid 32-byte hex hash');
      console.log(`  dataModelVersionStoreHash: ${result.organization.dataModelVersionStoreHash}`);

      expect(result.organization.registryHash).to.be.a('string');
      expect(result.organization.registryHash).to.match(/^0x[a-f0-9]{64}$/i, 'registryHash should be a valid 32-byte hex hash');
      console.log(`  registryHash: ${result.organization.registryHash}`);

      // Validate datalayer stores exist and contain expected data (V1)
      const datalayerValidation = await validateOrganizationStores(result.organization, false);
      expect(datalayerValidation.valid).to.be.true;
      if (!datalayerValidation.valid) {
        console.error('Datalayer validation errors:', datalayerValidation.errors);
      }

      // Save V1 organization details for comparison after upgrade
      v1OrganizationDetails = {
        orgUid: result.organization.orgUid,
        dataModelVersionStoreId: result.organization.dataModelVersionStoreId,
        fileStoreId: result.organization.fileStoreId,
        registryId: result.organization.registryId,
        orgHash: result.organization.orgHash,
        dataModelVersionStoreHash: result.organization.dataModelVersionStoreHash,
        name: result.organization.name,
      };
      console.log(`\nV1 Organization details saved for upgrade comparison:`);
      console.log(`  orgUid: ${v1OrganizationDetails.orgUid}`);
      console.log(`  dataModelVersionStoreId: ${v1OrganizationDetails.dataModelVersionStoreId}`);
      console.log(`  fileStoreId: ${v1OrganizationDetails.fileStoreId}`);
      console.log(`  registryId: ${v1OrganizationDetails.registryId}`);

      console.log(`✓ V1 Organization created with all hashes populated: ${v1OrgUid}`);
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
      // Use isUpgrade: true to skip fast-fail checks - upgrade is fully async with no status endpoint
      const result = await waitForV2OrganizationReady(request, null, 1800000, { isUpgrade: true });
      const upgradedV2OrgUid = result.orgUid;

      // Save to shared state
      setUpgradedV2OrgUid(upgradedV2OrgUid);

      // Verify organization details
      expect(result.organization.synced).to.be.true;
      expect(result.organization.is_home).to.be.true;

      // Verify all hashes are populated after V2 upgrade (V2 uses snake_case)
      expect(result.organization.org_hash).to.be.a('string');
      expect(result.organization.org_hash).to.match(/^0x[a-f0-9]{64}$/i, 'org_hash should be a valid 32-byte hex hash');
      console.log(`  org_hash: ${result.organization.org_hash}`);

      expect(result.organization.data_model_version_store_hash).to.be.a('string');
      expect(result.organization.data_model_version_store_hash).to.match(/^0x[a-f0-9]{64}$/i, 'data_model_version_store_hash should be a valid 32-byte hex hash');
      console.log(`  data_model_version_store_hash: ${result.organization.data_model_version_store_hash}`);

      expect(result.organization.registry_hash).to.be.a('string');
      expect(result.organization.registry_hash).to.match(/^0x[a-f0-9]{64}$/i, 'registry_hash should be a valid 32-byte hex hash');
      console.log(`  registry_hash: ${result.organization.registry_hash}`);

      // Validate datalayer stores exist and contain expected data (V2)
      const datalayerValidation = await validateOrganizationStores(result.organization, true);
      expect(datalayerValidation.valid).to.be.true;
      if (!datalayerValidation.valid) {
        console.error('Datalayer validation errors:', datalayerValidation.errors);
      }

      console.log(`✓ V1 Organization upgraded to V2 with all hashes populated: ${upgradedV2OrgUid}`);
    });

    it('should maintain shared identity between V1 and V2 organizations', async function () {
      // This test verifies the critical requirement that V1 and V2 organizations
      // share certain stores (org store, data model version store, file store)
      // while having separate registry stores

      if (!v1OrganizationDetails) {
        throw new Error('V1 organization details not available - V1 creation test must run first');
      }

      // Get the V2 organization
      const orgsResponse = await request.get('/v2/organizations');
      expect(orgsResponse.status).to.equal(200);

      const orgs = Object.values(orgsResponse.body);
      const v2Org = orgs.find(o => o.is_home === true);
      expect(v2Org).to.exist;

      console.log(`\nVerifying shared identity between V1 and V2 organizations:`);
      console.log(`  V1 orgUid: ${v1OrganizationDetails.orgUid}`);
      console.log(`  V2 org_uid: ${v2Org.org_uid}`);

      // CRITICAL: V1 orgUid must equal V2 org_uid (shared org store identity)
      expect(v2Org.org_uid).to.equal(
        v1OrganizationDetails.orgUid,
        'V2 org_uid must equal V1 orgUid (shared org store identity)',
      );
      console.log(`  ✓ org_uid is shared between V1 and V2`);

      // CRITICAL: Data model version store must be shared (singleton)
      expect(v2Org.data_model_version_store_id).to.equal(
        v1OrganizationDetails.dataModelVersionStoreId,
        'V2 data_model_version_store_id must equal V1 dataModelVersionStoreId (shared singleton)',
      );
      console.log(`  ✓ data_model_version_store_id is shared between V1 and V2`);

      // File store should be shared (if V1 had one)
      if (v1OrganizationDetails.fileStoreId) {
        // V2 uses file_store_subscribed field
        expect(v2Org.file_store_subscribed).to.equal(
          v1OrganizationDetails.fileStoreId,
          'V2 file_store_subscribed must equal V1 fileStoreId (shared file store)',
        );
        console.log(`  ✓ file_store is shared between V1 and V2`);
      }

      // CRITICAL: V2 must have a DIFFERENT registry store than V1
      expect(v2Org.registry_id).to.not.equal(
        v1OrganizationDetails.registryId,
        'V2 registry_id must be different from V1 registryId (V2 has its own registry)',
      );
      console.log(`  ✓ V2 has a separate registry store (V1: ${v1OrganizationDetails.registryId}, V2: ${v2Org.registry_id})`);

      // Org hash should be the same (shared org store)
      expect(v2Org.org_hash).to.equal(
        v1OrganizationDetails.orgHash,
        'V2 org_hash must equal V1 orgHash (shared org store)',
      );
      console.log(`  ✓ org_hash is the same (shared org store content)`);

      console.log(`\n✓ All shared identity verifications passed`);
    });
  });
});
