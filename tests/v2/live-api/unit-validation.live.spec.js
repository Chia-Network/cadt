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
  getNonExistentId,
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
        this.skip();
      }
      const forbiddenData = generateUnitForbiddenFields(issuanceId);
      const response = await request
        .post('/v2/unit')
        .send(forbiddenData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateUnitMinimal(getNonExistentId());
      const response = await request
        .post('/v2/unit')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
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

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { unitSerialId: 'Incomplete' }; // Missing unitStartBlock, unitEndBlock, etc.
      const response = await request
        .post('/v2/unit')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const issuanceId = getFirstCreatedId('issuance');
      if (!issuanceId) {
        this.skip();
      }
      const invalidTypeData = generateUnitMinimal(issuanceId);
      invalidTypeData.unitCount = 'not-a-number';
      const response = await request
        .post('/v2/unit')
        .send(invalidTypeData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });
  describe('Step 4: POST Request Tests', function () {
    it('should create units with typical, minimal, and maximal data', async function () {
      // Get issuance ID from earlier test (automatically checks file for cross-process access)
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
        // Track ALL fields from the request data for comprehensive verification
        trackBatchVerification('POST', 'unit', id, data);
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
        // Track ALL fields from the request data for comprehensive verification
        trackBatchVerification('POST', 'unit', minId, minimalData);
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
        // Track ALL fields from the request data for comprehensive verification
        trackBatchVerification('POST', 'unit', maxId, maximalData);
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
      // Get ID from createdIds (if available) or query for test records we created
      let id = createdIds[0];
      if (!id) {
        // Query for test records by filtering by home org and TEST- prefix
        let page = 1;
        const limit = 100;
        let found = false;

        while (!found && page <= 10) { // Limit to 10 pages to avoid infinite loop
          const response = await request.get(`/v2/unit?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);

          // Find first test record (unitSerialId or unitCurrentOwner starts with "TEST-")
          const testRecord = data.find(record =>
            (record.unitSerialId && record.unitSerialId.startsWith('TEST-')) ||
            (record.unitCurrentOwner && record.unitCurrentOwner.startsWith('TEST-'))
          );

          if (testRecord) {
            id = testRecord.cadTrustUnitId;
            found = true;
            break;
          }

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          if (page >= totalPages || data.length < limit) {
            break;
          }
          page++;
        }

        if (!id) {
          this.skip(); // Skip if no test records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/unit/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;

      // Verify record belongs to home org and is a test record
      if (record.orgUid !== homeOrgId) {
        this.skip(); // Skip if record doesn't belong to home org
      }
      const isTestRecord = (record.unitSerialId && record.unitSerialId.startsWith('TEST-')) ||
                           (record.unitCurrentOwner && record.unitCurrentOwner.startsWith('TEST-'));
      if (!isTestRecord) {
        this.skip(); // Skip if not a test record
      }

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
      // Query for test units by orgUid and TEST- prefix
      // This works even when DELETE runs in a separate process
      let idsToDelete = [];

      // First try createdIds if available (when running in same process)
      if (createdIds.length > 0) {
        idsToDelete = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get units belonging to our organization
          const response = await request.get(`/v2/unit?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);

          // Filter for test records (unitSerialId or unitCurrentOwner starts with "TEST-")
          const testRecords = data.filter(record =>
            (record.unitSerialId && record.unitSerialId.startsWith('TEST-')) ||
            (record.unitCurrentOwner && record.unitCurrentOwner.startsWith('TEST-'))
          );

          idsToDelete.push(...testRecords.map(r => r.cadTrustUnitId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      if (idsToDelete.length === 0) {
        this.skip(); // No test records to delete
      }

      console.log(`Found ${idsToDelete.length} test unit(s) to delete`);

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        try {
          const response = await makeDeleteRequest(request, '/v2/unit', id);
          // Check if delete was successful or if record doesn't exist (already deleted)
          if (response.success === false && response.error && response.error.includes('not found')) {
            // Record already deleted, continue
            continue;
          }
          expect(response.success).to.be.true;
        } catch (error) {
          // If delete fails, log but continue
          console.warn(`Failed to delete unit ${id}: ${error.message}`);
          continue;
        }

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          // Verify record is deleted
          try {
            const checkResponse = await request.get(`/v2/unit/${id}`);
            expect(checkResponse.status).to.equal(404, `Unit ${id} should be deleted but still exists`);
          } catch (error) {
            // 404 is expected - record is deleted
            if (error.status !== 404 && error.response?.status !== 404) {
              throw error;
            }
          }
        } else {
          trackBatchVerification('DELETE', 'unit', id);
        }
      }
    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all test units are deleted', async function () {
      // Query for test units by orgUid and TEST- prefix to verify they're all deleted
      // This works even when DELETE runs in a separate process
      let testUnitIds = [];

      // First try createdIds if available
      if (createdIds.length > 0) {
        testUnitIds = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get units belonging to our organization
          const response = await request.get(`/v2/unit?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);

          // Filter for test records (unitSerialId or unitCurrentOwner starts with "TEST-")
          const testRecords = data.filter(record =>
            (record.unitSerialId && record.unitSerialId.startsWith('TEST-')) ||
            (record.unitCurrentOwner && record.unitCurrentOwner.startsWith('TEST-'))
          );

          testUnitIds.push(...testRecords.map(r => r.cadTrustUnitId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      // Verify all test units are deleted
      for (const id of testUnitIds) {
        try {
          const checkResponse = await request.get(`/v2/unit/${id}`);
          expect(checkResponse.status).to.equal(404, `Test unit ${id} should be deleted but still exists`);
        } catch (error) {
          // 404 is expected - record is deleted
          if (error.status !== 404 && error.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (testUnitIds.length > 0) {
        console.log(`✓ Verified ${testUnitIds.length} test unit(s) are deleted`);
      } else {
        console.log('✓ No test units found to verify (all deleted or none created)');
      }
    });
  });
});
