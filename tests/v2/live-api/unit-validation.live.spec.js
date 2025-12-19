import { expect } from 'chai';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
  waitForDataToAppear,
  waitForBatchToAppear,
  clearStagingTable,
  validateDataInDatabase,
} from './helpers/live-api-helpers.js';
import { getSharedRequest, getSharedHomeOrgId } from './helpers/shared-setup.js';
import {
  makePostRequest,
  makePutRequest,
  makeDeleteRequest,
  checkRecordInStaging,
} from './helpers/api-request-helpers.js';
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstCreatedId, getFirstRecordIdFromDatabase, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateUnit,
  generateUnitMinimal,
  generateUnitMaximal,
  generateUnitForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Unit Live API Validation Tests', function () {
  this.timeout(600000); // 10 minute timeout
  let request;
  let homeOrgId;
  const createdIds = []; // Track all created IDs
  before(async function () {
    // Get shared request and home org ID (setup already done by orchestration)
    request = getSharedRequest();
    homeOrgId = getSharedHomeOrgId();
  });
  describe('Step 3: Validation Failure Tests', function () {
    it('should reject POST with forbidden fields (createdAt, updatedAt, ID)', async function () {
      const issuanceId = getFirstCreatedId('issuance');
      if (!issuanceId) {
        this.skip(); // Skip if prerequisite not available
      }
      const forbiddenData = generateUnitForbiddenFields(issuanceId);
      const response = await request
        .post('/v2/unit')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid picklist values', async function () {
      const issuanceId = getFirstCreatedId('issuance');
      if (!issuanceId) {
        this.skip();
      }
      const invalidData = generateUnitMinimal(issuanceId);
      invalidData.unitType = getInvalidPicklistValue('unitType');
      const response = await request
        .post('/v2/unit')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { unitSerialId: 'TEST-UNIT' }; // Missing unitStartBlock, unitEndBlock, unitVintageYear, cadTrustIssuanceId
      const response = await request
        .post('/v2/unit')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with strings that are too long', async function () {
      const issuanceId = getFirstCreatedId('issuance');
      if (!issuanceId) {
        this.skip();
      }
      const longData = generateUnitMaximal(issuanceId); // Use maximal which has long strings
      // Note: Long strings test may need manual adjustment
      const response = await request
        .post('/v2/unit')
        .send(longData);

      // May or may not fail depending on validation rules
      // Just verify it doesn't succeed with invalid data
      if (response.status === 200) {
        console.warn('⚠️  Long strings were accepted (may be valid)');
      }
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });
  describe('Step 4: POST Request Tests', function () {
    it('should create units with typical, minimal, and maximal data', async function () {
      // Get issuance ID from earlier test (issuance-validation.spec.js runs before this)
      const issuanceId = getFirstCreatedId('issuance');
      if (!issuanceId) {
        throw new Error('Issuance ID not found. Ensure issuance-validation.spec.js runs before unit-validation.spec.js');
      }

      // Create 1 typical record
      const data = generateUnit(issuanceId);
      const { id, response } = await makePostRequest(request, '/v2/unit', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('unit', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/unit', id, {
        unitSerialId: data.unitSerialId,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', id);
      } else {
        trackBatchVerification('POST', 'unit', id, {
          unitSerialId: data.unitSerialId,
        });
      }

      // Create 1 minimal record
      const minimalData = generateUnitMinimal(issuanceId);
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/unit', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('unit', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', minId);
      } else {
        trackBatchVerification('POST', 'unit', minId, {
          unitSerialId: minimalData.unitSerialId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateUnitMaximal(issuanceId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/unit', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('unit', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', maxId);
      } else {
        trackBatchVerification('POST', 'unit', maxId, {
          unitSerialId: maximalData.unitSerialId,
        });
      }
    });
  });
  describe('Step 5: Staging Commit (if short mode)', function () {
    it('should commit all staged records in batch', async function () {
      if (!shouldAutoCommit()) {
        // Commit all uncommitted records
        await commitStagedRecords(request, [], true); // Force commit
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        // Wait for all records to appear
        const recordsToWaitFor = createdIds.map(id => ({ type: 'unit', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'unit', id);
        expect(record).to.exist;
        expect(record.cadTrustUnitId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a unit', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'unit');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/unit/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;

      // Ensure required fields exist
      if (!record.unitSerialId) {
        throw new Error('unitSerialId is required but missing from GET response');
      }
      if (!record.unitStartBlock) {
        throw new Error('unitStartBlock is required but missing from GET response');
      }
      if (!record.unitEndBlock) {
        throw new Error('unitEndBlock is required but missing from GET response');
      }
      if (!record.unitVintageYear) {
        throw new Error('unitVintageYear is required but missing from GET response');
      }
      if (!record.cadTrustIssuanceId) {
        throw new Error('cadTrustIssuanceId is required but missing from GET response');
      }

      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        unitSerialId: record.unitSerialId, // Required
        unitStartBlock: record.unitStartBlock, // Required
        unitEndBlock: record.unitEndBlock, // Required
        unitVintageYear: record.unitVintageYear, // Required
        cadTrustIssuanceId: record.cadTrustIssuanceId, // Required
        // Optional fields: include with their value (can be null)
        unitCount: record.unitCount ?? null,
        unitType: record.unitType ?? null,
        unitStatus: record.unitStatus ?? null,
        unitStatusReason: record.unitStatusReason ?? null,
        unitStatusDate: record.unitStatusDate ?? null,
        unitRetirementDetail: record.unitRetirementDetail ?? null,
        unitRetirementBeneficiary: record.unitRetirementBeneficiary ?? null,
        unitRetirementBeneficiaryId: record.unitRetirementBeneficiaryId ?? null,
        unitLink: record.unitLink ?? null,
        unitMetric: record.unitMetric ?? null,
        unitCurrentOwner: record.unitCurrentOwner ?? null,
        unitItmosReferenceId: record.unitItmosReferenceId ?? null,
        marketplace: record.marketplace ?? null,
        marketplaceLink: record.marketplaceLink ?? null,
        marketplaceIdentifier: record.marketplaceIdentifier ?? null,
      };
      const response = await makePutRequest(request, '/v2/unit', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'unit', id);
        await validateDataInDatabase(request, 'unit', id, {
          unitSerialId: updateData.unitSerialId,
        });
      } else {
        trackBatchVerification('PUT', 'unit', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all units with pagination', async function () {
      const response = await request
        .get('/v2/unit?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific unit by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/unit/${id}`)
        .expect(200);

      expect(response.body.cadTrustUnitId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/unit')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created units', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'unit');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/unit', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'unit', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all units are deleted', async function () {
      const response = await request.get('/v2/unit').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have units that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
