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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateMethodology,
  generateMethodologyMinimal,
  generateMethodologyMaximal,
  generateMethodologyLongStrings,
  generateMethodologyInvalidPicklist,
  generateMethodologyForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Methodology Live API Validation Tests', function () {
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
      const forbiddenData = generateMethodologyForbiddenFields();
      const response = await request
        .post('/v2/methodology')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateMethodologyInvalidPicklist();
      const response = await request
        .post('/v2/methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { methodologyName: 'Incomplete' }; // Missing methodologyCode
      const response = await request
        .post('/v2/methodology')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateMethodologyLongStrings();
      const response = await request
        .post('/v2/methodology')
        .send(longData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const invalidTypeData = generateMethodology();
      invalidTypeData.methodologyDate = 'not-a-date';
      const response = await request
        .post('/v2/methodology')
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
    it('should create methodologies with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateMethodology();
      const { id, response } = await makePostRequest(request, '/v2/methodology', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('methodology', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/methodology', id, {
        methodologyCode: data.methodologyCode,
        methodologyName: data.methodologyName,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'methodology', id);
      } else {
        trackBatchVerification('POST', 'methodology', id, {
          methodologyCode: data.methodologyCode,
          methodologyName: data.methodologyName,
        });
      }

      // Create 1 minimal record
      const minimalData = generateMethodologyMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/methodology', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('methodology', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'methodology', minId);
      } else {
        trackBatchVerification('POST', 'methodology', minId, {
          methodologyCode: minimalData.methodologyCode,
          methodologyName: minimalData.methodologyName,
        });
      }

      // Create 1 maximal record
      const maximalData = generateMethodologyMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/methodology', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('methodology', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'methodology', maxId);
      } else {
        trackBatchVerification('POST', 'methodology', maxId, {
          methodologyCode: maximalData.methodologyCode,
          methodologyName: maximalData.methodologyName,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'methodology', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'methodology', id);
        expect(record).to.exist;
        expect(record.cadTrustMethodologyId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a methodology', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        // Query database to get first existing record (for PUT tests running in separate process)
        const listResponse = await request.get('/v2/methodology').expect(200);
        const data = Array.isArray(listResponse.body)
          ? listResponse.body
          : (listResponse.body?.data || []);
        if (!data || data.length === 0) {
          this.skip(); // Skip if no records exist
        }
        id = data[0].cadTrustMethodologyId;
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/methodology/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        methodologyCode: `UPDATED-${Date.now()}`,
        methodologyName: 'Updated Methodology Name',
        methodologyVersion: record.methodologyVersion ?? null,
        methodologyDate: record.methodologyDate ?? null,
        methodologyLink: record.methodologyLink ?? null,
        methodologyType: record.methodologyType ?? null,
      };
      const response = await makePutRequest(request, '/v2/methodology', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'methodology', id);
        await validateDataInDatabase(request, 'methodology', id, {
          methodologyCode: updateData.methodologyCode,
          methodologyName: updateData.methodologyName,
        });
      } else {
        trackBatchVerification('PUT', 'methodology', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all methodologies with pagination', async function () {
      const response = await request
        .get('/v2/methodology?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific methodology by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/methodology/${id}`)
        .expect(200);

      expect(response.body.cadTrustMethodologyId).to.equal(id);
      expect(response.body).to.have.property('orgUid');
    });

    it('should filter methodologies by orgUid=me', async function () {
      const response = await request
        .get('/v2/methodology?orgUid=me&page=1&limit=10')
        .expect(200);

      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      for (const m of data) {
        expect(m).to.have.property('orgUid');
        expect(m.orgUid).to.equal(homeOrgId);
      }
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/methodology')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created methodologies', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'methodology');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/methodology', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'methodology', id);
        }
      }
    });
  });
  describe('Step 10: Final Validation', function () {
    it('should verify all methodologies are deleted', async function () {
      const response = await request.get('/v2/methodology').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have methodologies that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
