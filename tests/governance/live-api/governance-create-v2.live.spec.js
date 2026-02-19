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
  waitForGovernanceKeyOnChain,
} from './helpers/governance-datalayer-helpers.js';

import v2PickList from '../../../src/models/governance/governance-v2.stub.js';
import glossary from '../../../src/models/governance/glossary.stub.js';

const TEST_ORG_LIST = [
  { orgUid: 'test-governance-org-1' },
  { orgUid: 'test-governance-org-2' },
];

/**
 * V2 Governance Body Creation Test
 *
 * Creates a V2 governance body, sets picklist/glossary/orgList data,
 * then verifies the data via both the CADT API and Chia datalayer RPCs.
 *
 * Requires:
 *   - CADT running with V2.IS_GOVERNANCE_BODY=true
 *   - V2.GOVERNANCE.GOVERNANCE_BODY_ID empty
 *   - Wallet funded with txch
 */
describe('V2 Governance Body Creation Tests', function () {
  this.timeout(3600000); // 60 minute timeout

  let request;
  let mainGovernanceBodyId;

  before(async function () {
    request = await getGovernanceApiRequest({ apiVersion: 'v2' });
  });

  describe('Create V2 Governance Body', function () {
    it('should create a V2 governance body', async function () {
      const startTime = Date.now();

      const { response, lastError } = await createGovernanceBodyWithRetry(request, 'v2');

      if (response.status !== 200) {
        console.error(`POST /v2/governance failed: ${response.status}`);
        console.error('Response:', JSON.stringify(response.body, null, 2));
        if (lastError) console.error('Last error:', lastError);
      }

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;

      mainGovernanceBodyId = await waitForGovernanceCreated(request, 'v2');
      expect(mainGovernanceBodyId).to.be.a('string').with.lengthOf(64);

      const elapsedMs = Date.now() - startTime;
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = ((elapsedMs % 60000) / 1000).toFixed(1);
      console.log(`\nV2 governance body created in ${minutes}m ${seconds}s`);
      console.log(`  Main governance body ID: ${mainGovernanceBodyId}`);
    });
  });

  describe('Set V2 Governance Data', function () {
    it('should set picklist and wait for confirmation', async function () {
      await setGovernanceData(request, 'v2', 'pickList', v2PickList);
      await waitForGovernanceDataConfirmed(request, 'v2', ['pickList']);
      await waitForGovernanceKeyOnChain(mainGovernanceBodyId, 'v2', 'pickList');
    });

    it('should set glossary and wait for confirmation', async function () {
      await setGovernanceData(request, 'v2', 'glossary', glossary);
      await waitForGovernanceDataConfirmed(request, 'v2', ['pickList', 'glossary']);
      await waitForGovernanceKeyOnChain(mainGovernanceBodyId, 'v2', 'glossary');
    });

    it('should set orgList and wait for confirmation', async function () {
      await setGovernanceData(request, 'v2', 'orgList', TEST_ORG_LIST);
      await waitForGovernanceDataConfirmed(request, 'v2', ['pickList', 'glossary', 'orgList']);
      await waitForGovernanceKeyOnChain(mainGovernanceBodyId, 'v2', 'orgList');
    });
  });

  describe('Verify V2 Governance Data via CADT API', function () {
    it('should return correct data from all governance GET endpoints', async function () {
      const result = await verifyGovernanceApiData(request, 'v2', {
        pickList: v2PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('API verification errors:', result.errors);
      }
    });

    it('should report governance body as created', async function () {
      const response = await request.get('/v2/governance/exists');
      expect(response.status).to.equal(200);
      expect(response.body.created).to.be.true;
      expect(response.body.success).to.be.true;
      expect(response.body.governanceBodyId).to.equal(mainGovernanceBodyId);
    });
  });

  describe('Verify V2 Governance Stores on Datalayer', function () {
    it('should have a valid main governance store with v2 version mapping', async function () {
      const result = await validateGovernanceMainStore(mainGovernanceBodyId, { v2: null });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('Main store validation errors:', result.errors);
      }

      expect(result.versionStoreIds.v2).to.be.a('string').with.lengthOf(64);
    });

    it('should have correct data in the v2 version store', async function () {
      const mainResult = await validateGovernanceMainStore(mainGovernanceBodyId, { v2: null });
      const v2StoreId = mainResult.versionStoreIds.v2;

      const result = await validateGovernanceVersionStore(v2StoreId, 'v2', {
        pickList: v2PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('Version store validation errors:', result.errors);
      }

      expect(result.foundKeys).to.include.members(['pickList', 'glossary', 'orgList']);
    });
  });
});
