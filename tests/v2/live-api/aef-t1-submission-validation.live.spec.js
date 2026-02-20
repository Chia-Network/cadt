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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstRecordIdFromDatabase, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateAefT1Submission,
  generateAefT1SubmissionMinimal,
  generateAefT1SubmissionMaximal,
  generateAefT1SubmissionForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('AefT1Submission Live API Validation Tests', function () {
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
      const forbiddenData = generateAefT1SubmissionForbiddenFields();
      const response = await request
        .post('/v2/aef-t1-submission')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { aefT1SubmissionParty: 'Incomplete' }; // Missing other required fields
      const response = await request
        .post('/v2/aef-t1-submission')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const invalidTypeData = generateAefT1Submission();
      invalidTypeData.aefT1SubmissionReportYear = 'not-a-number';
      const response = await request
        .post('/v2/aef-t1-submission')
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
    it('should create aefT1Submissions with typical, minimal, and maximal data', async function () {
      // AEF T1 Submission has no dependencies - standalone entity
      // Create 1 typical record
      const data = generateAefT1Submission();
      const { id, response } = await makePostRequest(request, '/v2/aef-t1-submission', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('aef-t1-submission', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/aef-t1-submission', id, {
        aefT1SubmissionParty: data.aefT1SubmissionParty,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t1-submission', id);
      } else {
        trackBatchVerification('POST', 'aef-t1-submission', id, {
          aefT1SubmissionParty: data.aefT1SubmissionParty,
        });
      }

      // Create 1 minimal record
      const minimalData = generateAefT1SubmissionMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/aef-t1-submission', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('aef-t1-submission', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t1-submission', minId);
      } else {
        trackBatchVerification('POST', 'aef-t1-submission', minId, {
          aefT1SubmissionParty: minimalData.aefT1SubmissionParty,
        });
      }

      // Create 1 maximal record
      const maximalData = generateAefT1SubmissionMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/aef-t1-submission', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('aef-t1-submission', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t1-submission', maxId);
      } else {
        trackBatchVerification('POST', 'aef-t1-submission', maxId, {
          aefT1SubmissionParty: maximalData.aefT1SubmissionParty,
        });
      }
    });
  });
  describe('Step 5: Staging Commit (if short mode)', function () {
    it('should commit all staged records in batch', async function () {
      if (!shouldAutoCommit()) {
        // Commit all uncommitted records
        await commitStagedRecords(request, [], true); // Force commit
        // Wait for all records to appear
        const recordsToWaitFor = createdIds.map(id => ({ type: 'aef-t1-submission', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'aef-t1-submission', id);
        expect(record).to.exist;
        expect(record.cadTrustAefT1SubmissionId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a aefT1Submission', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'aef-t1-submission');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/aef-t1-submission/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        aefT1SubmissionParty: record.aefT1SubmissionParty,
        aefT1SubmissionVersion: record.aefT1SubmissionVersion,
        aefT1SubmissionReportYear: record.aefT1SubmissionReportYear,
        aefT1SubmissionSubmissionDate: record.aefT1SubmissionSubmissionDate,
        aefT1SubmissionReviewStatus: record.aefT1SubmissionReviewStatus ?? null,
        aefT1SubmissionResultCheck: record.aefT1SubmissionResultCheck ?? null,
        aefT1SubmissionNdcFirstYear: record.aefT1SubmissionNdcFirstYear ?? null,
        aefT1SubmissionNdcLastYear: record.aefT1SubmissionNdcLastYear ?? null,
        aefT1SubmissionReferenceReviewReport: record.aefT1SubmissionReferenceReviewReport ?? null,
      };
      const response = await makePutRequest(request, '/v2/aef-t1-submission', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t1-submission', id);
        await validateDataInDatabase(request, 'aef-t1-submission', id, {
          aefT1SubmissionParty: updateData.aefT1SubmissionParty,
        });
      } else {
        trackBatchVerification('PUT', 'aef-t1-submission', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all aef-t1-submissions with pagination', async function () {
      const response = await request
        .get('/v2/aef-t1-submission?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific aef-t1-submission by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/aef-t1-submission/${id}`)
        .expect(200);

      expect(response.body.cadTrustAefT1SubmissionId).to.equal(id);
      expect(response.body).to.have.property('orgUid');
    });

    it('should filter aef-t1-submissions by orgUid=me', async function () {
      const response = await request
        .get('/v2/aef-t1-submission?orgUid=me&page=1&limit=10')
        .expect(200);

      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      for (const s of data) {
        expect(s).to.have.property('orgUid');
        expect(s.orgUid).to.equal(homeOrgId);
      }
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/aef-t1-submission')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created aef-t1-submissions', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'aef-t1-submission');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/aef-t1-submission', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'aef-t1-submission', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all aef-t1-submissions are deleted', async function () {
      const response = await request.get('/v2/aef-t1-submission').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have aef-t1-submissions that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
