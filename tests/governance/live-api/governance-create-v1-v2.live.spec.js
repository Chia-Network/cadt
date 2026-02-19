import { expect } from 'chai';
import {
  getGovernanceApiRequest,
  createGovernanceBodyWithRetry,
  waitForGovernanceCreated,
  setGovernanceData,
  waitForGovernanceDataConfirmed,
  verifyGovernanceApiData,
} from './helpers/governance-helpers.js';
import {
  validateGovernanceMainStore,
  validateGovernanceVersionStore,
} from './helpers/governance-datalayer-helpers.js';

import v1PickList from '../../../src/models/governance/governance.stub.js';
import v2PickList from '../../../src/models/governance/governance-v2.stub.js';
import glossary from '../../../src/models/governance/glossary.stub.js';

const TEST_ORG_LIST = [
  { orgUid: 'test-governance-org-1' },
  { orgUid: 'test-governance-org-2' },
];

/**
 * V1 then V2 Governance Body Creation Test
 *
 * Creates a V1 governance body first, sets V1 data, then creates a V2 governance
 * body (which auto-detects the existing V1 and adds V2 to the same main store).
 * Finally verifies both versions' data via the CADT API and datalayer RPCs.
 *
 * Requires:
 *   - CADT running with V1.IS_GOVERNANCE_BODY=true and V2.IS_GOVERNANCE_BODY=true
 *   - Both GOVERNANCE_BODY_IDs empty
 *   - Wallet funded with txch
 */
describe('V1 then V2 Governance Body Creation Tests', function () {
  this.timeout(7200000); // 120 minute timeout

  let request;
  let mainGovernanceBodyId;

  before(async function () {
    request = await getGovernanceApiRequest({ apiVersion: 'any' });
  });

  // ------- Phase 1: Create V1 Governance Body -------

  describe('Phase 1: Create V1 Governance Body', function () {
    it('should create a V1 governance body', async function () {
      const startTime = Date.now();

      const { response, lastError } = await createGovernanceBodyWithRetry(request, 'v1');

      if (response.status !== 200) {
        console.error(`POST /v1/governance failed: ${response.status}`);
        console.error('Response:', JSON.stringify(response.body, null, 2));
        if (lastError) console.error('Last error:', lastError);
      }

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;

      mainGovernanceBodyId = await waitForGovernanceCreated(request, 'v1');
      expect(mainGovernanceBodyId).to.be.a('string').with.lengthOf(64);

      const elapsedMs = Date.now() - startTime;
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = ((elapsedMs % 60000) / 1000).toFixed(1);
      console.log(`\nV1 governance body created in ${minutes}m ${seconds}s`);
      console.log(`  Main governance body ID: ${mainGovernanceBodyId}`);
    });
  });

  describe('Phase 1: Set V1 Governance Data', function () {
    it('should set V1 picklist and wait for confirmation', async function () {
      await setGovernanceData(request, 'v1', 'pickList', v1PickList);
      await waitForGovernanceDataConfirmed(request, 'v1', ['pickList']);
    });

    it('should set V1 glossary and wait for confirmation', async function () {
      await setGovernanceData(request, 'v1', 'glossary', glossary);
      await waitForGovernanceDataConfirmed(request, 'v1', ['pickList', 'glossary']);
    });

    it('should set V1 orgList and wait for confirmation', async function () {
      await setGovernanceData(request, 'v1', 'orgList', TEST_ORG_LIST);
      await waitForGovernanceDataConfirmed(request, 'v1', ['pickList', 'glossary', 'orgList']);
    });
  });

  describe('Phase 1: Verify V1 Governance Before Adding V2', function () {
    it('should have valid V1 governance data in the API', async function () {
      const result = await verifyGovernanceApiData(request, 'v1', {
        pickList: v1PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });
      expect(result.valid).to.be.true;
    });

    it('should have v1 version mapping in the main store', async function () {
      const result = await validateGovernanceMainStore(mainGovernanceBodyId, { v1: null });
      expect(result.valid).to.be.true;
      expect(result.versionStoreIds.v1).to.be.a('string').with.lengthOf(64);
    });
  });

  // ------- Phase 2: Add V2 to Existing V1 Governance Body -------

  describe('Phase 2: Add V2 Governance to Existing V1', function () {
    it('should create V2 governance (auto-detects V1 and adds V2)', async function () {
      const startTime = Date.now();

      const { response, lastError } = await createGovernanceBodyWithRetry(request, 'v2');

      if (response.status !== 200) {
        console.error(`POST /v2/governance failed: ${response.status}`);
        console.error('Response:', JSON.stringify(response.body, null, 2));
        if (lastError) console.error('Last error:', lastError);
      }

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;

      // V2 governance should reuse the same main governance body
      const v2MainId = await waitForGovernanceCreated(request, 'v2');
      expect(v2MainId).to.be.a('string').with.lengthOf(64);

      // The main governance body ID should be the same since V2 was added to V1
      expect(v2MainId).to.equal(mainGovernanceBodyId);

      const elapsedMs = Date.now() - startTime;
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = ((elapsedMs % 60000) / 1000).toFixed(1);
      console.log(`\nV2 governance added to existing V1 in ${minutes}m ${seconds}s`);
    });
  });

  describe('Phase 2: Set V2 Governance Data', function () {
    it('should set V2 picklist and wait for confirmation', async function () {
      await setGovernanceData(request, 'v2', 'pickList', v2PickList);
      await waitForGovernanceDataConfirmed(request, 'v2', ['pickList']);
    });

    it('should set V2 glossary and wait for confirmation', async function () {
      await setGovernanceData(request, 'v2', 'glossary', glossary);
      await waitForGovernanceDataConfirmed(request, 'v2', ['pickList', 'glossary']);
    });

    it('should set V2 orgList and wait for confirmation', async function () {
      await setGovernanceData(request, 'v2', 'orgList', TEST_ORG_LIST);
      await waitForGovernanceDataConfirmed(request, 'v2', ['pickList', 'glossary', 'orgList']);
    });
  });

  // ------- Phase 3: Verify Both V1 and V2 -------

  describe('Phase 3: Verify Both V1 and V2 Governance Data via CADT API', function () {
    it('should return correct V1 data from governance GET endpoints', async function () {
      const result = await verifyGovernanceApiData(request, 'v1', {
        pickList: v1PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });
      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('V1 API verification errors:', result.errors);
      }
    });

    it('should return correct V2 data from governance GET endpoints', async function () {
      const result = await verifyGovernanceApiData(request, 'v2', {
        pickList: v2PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });
      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('V2 API verification errors:', result.errors);
      }
    });

    it('should report V1 governance body as created', async function () {
      const response = await request.get('/v1/governance/exists');
      expect(response.status).to.equal(200);
      expect(response.body.created).to.be.true;
      expect(response.body.governanceBodyId).to.equal(mainGovernanceBodyId);
    });

    it('should report V2 governance body as created', async function () {
      const response = await request.get('/v2/governance/exists');
      expect(response.status).to.equal(200);
      expect(response.body.created).to.be.true;
      expect(response.body.governanceBodyId).to.equal(mainGovernanceBodyId);
    });
  });

  describe('Phase 3: Verify Datalayer Stores Contain Both V1 and V2', function () {
    it('should have both v1 and v2 in the main governance store', async function () {
      const result = await validateGovernanceMainStore(mainGovernanceBodyId, { v1: null, v2: null });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('Main store validation errors:', result.errors);
      }

      expect(result.versionStoreIds.v1).to.be.a('string').with.lengthOf(64);
      expect(result.versionStoreIds.v2).to.be.a('string').with.lengthOf(64);
      expect(result.versionStoreIds.v1).to.not.equal(result.versionStoreIds.v2);

      console.log(`  V1 version store: ${result.versionStoreIds.v1}`);
      console.log(`  V2 version store: ${result.versionStoreIds.v2}`);
    });

    it('should have correct V1 data in the v1 version store', async function () {
      const mainResult = await validateGovernanceMainStore(mainGovernanceBodyId, { v1: null, v2: null });
      const v1StoreId = mainResult.versionStoreIds.v1;

      const result = await validateGovernanceVersionStore(v1StoreId, 'v1', {
        pickList: v1PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('V1 version store validation errors:', result.errors);
      }
      expect(result.foundKeys).to.include.members(['pickList', 'glossary', 'orgList']);
    });

    it('should have correct V2 data in the v2 version store', async function () {
      const mainResult = await validateGovernanceMainStore(mainGovernanceBodyId, { v1: null, v2: null });
      const v2StoreId = mainResult.versionStoreIds.v2;

      const result = await validateGovernanceVersionStore(v2StoreId, 'v2', {
        pickList: v2PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('V2 version store validation errors:', result.errors);
      }
      expect(result.foundKeys).to.include.members(['pickList', 'glossary', 'orgList']);
    });
  });
});
