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

import v1PickList from '../../../src/models/governance/governance.stub.js';
import glossary from '../../../src/models/governance/glossary.stub.js';

const TEST_ORG_LIST = [
  { orgUid: 'test-governance-org-1' },
  { orgUid: 'test-governance-org-2' },
];

/**
 * V1 Governance Body Creation Test
 *
 * Creates a V1 governance body, sets picklist/glossary/orgList data,
 * then verifies the data via both the CADT API and Chia datalayer RPCs.
 *
 * Requires:
 *   - CADT running with V1.IS_GOVERNANCE_BODY=true
 *   - V1.GOVERNANCE.GOVERNANCE_BODY_ID empty
 *   - Wallet funded with txch
 */
describe('V1 Governance Body Creation Tests', function () {
  this.timeout(3600000); // 60 minute timeout

  let request;
  let mainGovernanceBodyId;

  before(async function () {
    request = await getGovernanceApiRequest({ apiVersion: 'v1' });
  });

  describe('Create V1 Governance Body', function () {
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

  describe('Set V1 Governance Data', function () {
    it('should set picklist and wait for confirmation', async function () {
      await setGovernanceData(request, 'v1', 'pickList', v1PickList);
      await waitForGovernanceDataConfirmed(request, 'v1', ['pickList']);
      await waitForGovernanceKeyOnChain(mainGovernanceBodyId, 'v1', 'pickList');
    });

    it('should set glossary and wait for confirmation', async function () {
      await setGovernanceData(request, 'v1', 'glossary', glossary);
      await waitForGovernanceDataConfirmed(request, 'v1', ['pickList', 'glossary']);
      await waitForGovernanceKeyOnChain(mainGovernanceBodyId, 'v1', 'glossary');
    });

    it('should set orgList and wait for confirmation', async function () {
      await setGovernanceData(request, 'v1', 'orgList', TEST_ORG_LIST);
      await waitForGovernanceDataConfirmed(request, 'v1', ['pickList', 'glossary', 'orgList']);
      await waitForGovernanceKeyOnChain(mainGovernanceBodyId, 'v1', 'orgList');
    });
  });

  describe('Verify V1 Governance Data via CADT API', function () {
    it('should return correct data from all governance GET endpoints', async function () {
      const result = await verifyGovernanceApiData(request, 'v1', {
        pickList: v1PickList,
        glossary,
        orgList: TEST_ORG_LIST,
      });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('API verification errors:', result.errors);
      }
    });

    it('should report governance body as created', async function () {
      const response = await request.get('/v1/governance/exists');
      expect(response.status).to.equal(200);
      expect(response.body.created).to.be.true;
      expect(response.body.success).to.be.true;
      expect(response.body.governanceBodyId).to.equal(mainGovernanceBodyId);
    });
  });

  describe('Verify V1 Governance Stores on Datalayer', function () {
    it('should have a valid main governance store with v1 version mapping', async function () {
      const result = await validateGovernanceMainStore(mainGovernanceBodyId, { v1: null });

      expect(result.valid).to.be.true;
      if (!result.valid) {
        console.error('Main store validation errors:', result.errors);
      }

      expect(result.versionStoreIds.v1).to.be.a('string').with.lengthOf(64);
    });

    it('should have correct data in the v1 version store', async function () {
      const mainResult = await validateGovernanceMainStore(mainGovernanceBodyId, { v1: null });
      const v1StoreId = mainResult.versionStoreIds.v1;

      const result = await validateGovernanceVersionStore(v1StoreId, 'v1', {
        pickList: v1PickList,
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
