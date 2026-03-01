import { expect } from 'chai';
import {
  getLiveApiRequest,
  waitForV2OrganizationReady,
  waitForV1OrganizationReady,
  waitForWalletReadyForTransactions,
  createOrganizationWithRetry,
  logOrganizationCreationFailure,
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
  this.timeout(3600000); // 60 minute timeout (V1 creation + upgrade)

  let request;
  let v1OrgName;

  before(async function () {
    // Clear any existing organization state
    clearOrganizationState();

    request = await getLiveApiRequest();

    // Wait for wallet to be stable before attempting org creation.
    // Governance store sync (triggered by a real GOVERNANCE_LOOKUP_ID) can cause
    // the wallet to become temporarily unavailable after the Chia-level sync check passes.
    await waitForWalletReadyForTransactions(request, 600000);
  });

  describe('V1 Organization Creation (for upgrade)', function () {
    it('should create a new V1 organization and wait for completion', async function () {
      // Track V1 org creation timing
      const v1OrgCreateStartTime = Date.now();

      // Retry the entire create + wait cycle to handle a wallet sync race condition:
      // The POST to create an org may return 200 (wallet passes the "available" check),
      // but the internal datalayer store creation can still fail with
      // "Wallet needs to be fully synced before making transactions." This causes
      // the PENDING org to be cleaned up before completion. Retrying after a settle
      // delay allows the wallet to reach full transaction readiness.
      const MAX_ORG_CREATE_ATTEMPTS = 3;
      const WALLET_SETTLE_DELAY_MS = 90000; // 90s between outer retry attempts

      let result = null;
      let v1OrgUid = null;
      let lastCreateResponse = null;
      let lastCreateError = null;
      let orgData = null;

      for (let attempt = 1; attempt <= MAX_ORG_CREATE_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          console.log(`\n[Org create attempt ${attempt}/${MAX_ORG_CREATE_ATTEMPTS}] Waiting ${WALLET_SETTLE_DELAY_MS / 1000}s for wallet to fully settle before retry...`);
          await new Promise(resolve => setTimeout(resolve, WALLET_SETTLE_DELAY_MS));
        }

        orgData = {
          name: `Test V1 Upgrade Org ${Date.now()}`,
          icon: 'https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg',
        };
        v1OrgName = orgData.name;

        const { createResponse, lastError: err } = await createOrganizationWithRetry(
          request,
          '/v1/organizations/create',
          orgData,
        );
        lastCreateResponse = createResponse;
        lastCreateError = err;

        if (createResponse.status !== 200) {
          if (attempt < MAX_ORG_CREATE_ATTEMPTS) {
            logOrganizationCreationFailure('/v1/organizations/create', createResponse, err);
            console.log(`[Org create attempt ${attempt}] POST failed, will retry outer loop...`);
            continue;
          }
          break; // Exhausted retries — assertions below will handle the failure
        }

        // POST succeeded — now wait for the org to be fully created on-chain
        try {
          result = await waitForV1OrganizationReady(request, orgData.name);
          v1OrgUid = result.orgUid;
          break; // Full success
        } catch (error) {
          // PENDING org disappeared = wallet wasn't ready for datalayer transactions.
          // Retry the whole cycle after a settle delay.
          const isPendingDisappeared =
            error.message.includes('PENDING organization was cleaned up') ||
            error.message.includes('Organization creation failed');
          if (isPendingDisappeared && attempt < MAX_ORG_CREATE_ATTEMPTS) {
            console.log(`[Org create attempt ${attempt}] ${error.message}`);
            console.log(`  → Wallet was not yet fully synced for datalayer store transactions. Will retry after settling.`);
            continue;
          }
          throw error; // Re-throw non-retryable errors or failure on final attempt
        }
      }

      if (lastCreateResponse.status !== 200) {
        logOrganizationCreationFailure('/v1/organizations/create', lastCreateResponse, lastCreateError);
      }

      expect(lastCreateResponse.status).to.equal(200);
      expect(lastCreateResponse.body.success).to.be.true;
      expect(lastCreateResponse.body.message).to.include('currently being created');

      if (!result) {
        throw new Error('Organization creation failed after all retry attempts — check server logs for wallet sync issues');
      }

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

      // Mirror validation runs at the end of the live API test run (after all data tests)
      // to allow extra time for mirror creation/retries.

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

      // V1 org creation timing report
      const v1OrgCreateElapsedMs = Date.now() - v1OrgCreateStartTime;
      const v1OrgCreateMinutes = Math.floor(v1OrgCreateElapsedMs / 60000);
      const v1OrgCreateSeconds = ((v1OrgCreateElapsedMs % 60000) / 1000).toFixed(1);
      console.log(`\n╔══════════════════════════════════════════════════════════╗`);
      console.log(`║  V1 ORGANIZATION CREATION TIMING REPORT (for upgrade)    ║`);
      console.log(`╠══════════════════════════════════════════════════════════╣`);
      console.log(`║  Org UID:  ${v1OrgUid}`);
      console.log(`║  Duration: ${v1OrgCreateMinutes}m ${v1OrgCreateSeconds}s (${v1OrgCreateElapsedMs}ms)`);
      console.log(`╚══════════════════════════════════════════════════════════╝`);

      console.log(`✓ V1 Organization created with all hashes populated: ${v1OrgUid}`);
    });
  });

  describe('V1 to V2 Upgrade', function () {
    it('should upgrade V1 organization to V2 and wait for completion', async function () {
      const state = getOrganizationState();
      if (!state.v1OrgUid) {
        throw new Error('No V1 organization was created - cannot test upgrade');
      }

      // Track V2 upgrade timing
      const v2UpgradeStartTime = Date.now();

      console.log(`Upgrading V1 organization ${state.v1OrgUid} to V2...`);

      // Retry the entire upgrade cycle (POST + wait) to handle cases where the
      // CADT background upgrade process fails due to transient wallet sync issues.
      // The server-side upgradeFromV1 runs async (fire-and-forget) so the POST
      // returns 200 even if the background process later fails. If we detect failure
      // via waitForV2OrganizationReady fast-fail, we settle and retry the upgrade.
      const MAX_UPGRADE_CYCLE_ATTEMPTS = 3;
      const UPGRADE_SETTLE_DELAY_MS = 90000; // 90s between outer retry attempts

      let result = null;

      for (let cycleAttempt = 1; cycleAttempt <= MAX_UPGRADE_CYCLE_ATTEMPTS; cycleAttempt++) {
        if (cycleAttempt > 1) {
          console.log(`\n[Upgrade cycle attempt ${cycleAttempt}/${MAX_UPGRADE_CYCLE_ATTEMPTS}] Waiting ${UPGRADE_SETTLE_DELAY_MS / 1000}s for wallet to settle before retry...`);
          await new Promise(resolve => setTimeout(resolve, UPGRADE_SETTLE_DELAY_MS));
        }

        // POST the upgrade request, retrying on transient 400 errors
        const maxUpgradeRetries = 6;
        const upgradeRetryDelayMs = 30000;
        let upgradeResponse;
        let lastUpgradeError;

        for (let attempt = 1; attempt <= maxUpgradeRetries; attempt++) {
          upgradeResponse = await request.post('/v2/organizations/upgrade');

          const isSingletonNotReady = upgradeResponse.status === 400 &&
            (upgradeResponse.body?.message?.includes('singleton') ||
             upgradeResponse.body?.message?.includes('not completed') ||
             upgradeResponse.body?.message?.includes('still be creating'));

          // If upgrade is already complete (re-POST after partial success), treat as success
          const isAlreadyComplete = upgradeResponse.status === 400 &&
            upgradeResponse.body?.message?.includes('already complete');

          if (upgradeResponse.status === 200 || isAlreadyComplete) {
            break;
          } else if (isSingletonNotReady && attempt < maxUpgradeRetries) {
            console.log(`[Upgrade Attempt ${attempt}/${maxUpgradeRetries}] V1 singleton not ready, retrying in ${upgradeRetryDelayMs/1000}s...`);
            console.log(`  Message: ${upgradeResponse.body?.message}`);
            lastUpgradeError = upgradeResponse.body?.message;
            await new Promise(resolve => setTimeout(resolve, upgradeRetryDelayMs));
          } else {
            break;
          }
        }

        if (upgradeResponse.status !== 200) {
          // Check if upgrade is already complete from a previous cycle
          const isAlreadyComplete = upgradeResponse.status === 400 &&
            upgradeResponse.body?.message?.includes('already complete');

          if (!isAlreadyComplete) {
            console.error(`POST /v2/organizations/upgrade failed with status ${upgradeResponse.status}:`);
            console.error(`Response body:`, JSON.stringify(upgradeResponse.body, null, 2));
            if (lastUpgradeError) {
              console.error(`Last retry error: ${lastUpgradeError}`);
            }

            if (cycleAttempt < MAX_UPGRADE_CYCLE_ATTEMPTS) {
              console.log(`[Upgrade cycle attempt ${cycleAttempt}] POST failed, will retry outer loop...`);
              continue;
            }
          }
        }

        expect(
          upgradeResponse.status === 200 ||
          (upgradeResponse.status === 400 && upgradeResponse.body?.message?.includes('already complete')),
        ).to.be.true;

        // Wait for upgraded organization to be ready
        // isUpgrade: true uses a longer no-progress threshold since upgrade has no status endpoint
        try {
          result = await waitForV2OrganizationReady(request, null, 900000, { isUpgrade: true });
          break; // Full success
        } catch (error) {
          const isBackgroundFailure =
            error.message.includes('appears to have failed') ||
            error.message.includes('No PENDING organization') ||
            error.message.includes('Timeout waiting');

          if (isBackgroundFailure && cycleAttempt < MAX_UPGRADE_CYCLE_ATTEMPTS) {
            console.log(`[Upgrade cycle attempt ${cycleAttempt}] ${error.message}`);
            console.log(`  → CADT background upgrade process may have failed. Will retry after settling.`);
            continue;
          }
          throw error;
        }
      }

      if (!result) {
        throw new Error('V2 upgrade failed after all retry attempts — check server logs for wallet sync issues');
      }

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

      // Mirror validation runs at the end of the live API test run (after all data tests)
      // to allow extra time for mirror creation/retries.

      // V2 upgrade timing report
      const v2UpgradeElapsedMs = Date.now() - v2UpgradeStartTime;
      const v2UpgradeMinutes = Math.floor(v2UpgradeElapsedMs / 60000);
      const v2UpgradeSeconds = ((v2UpgradeElapsedMs % 60000) / 1000).toFixed(1);
      console.log(`\n╔══════════════════════════════════════════════════════════╗`);
      console.log(`║  V1 TO V2 UPGRADE TIMING REPORT                         ║`);
      console.log(`╠══════════════════════════════════════════════════════════╣`);
      console.log(`║  Org UID:          ${upgradedV2OrgUid}`);
      console.log(`║  Upgrade Duration: ${v2UpgradeMinutes}m ${v2UpgradeSeconds}s (${v2UpgradeElapsedMs}ms)`);
      console.log(`╚══════════════════════════════════════════════════════════╝`);

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
