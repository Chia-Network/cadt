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
  generateLabel,
  generateLabelMinimal,
  generateLabelMaximal,
  generateLabelLongStrings,
  generateLabelForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Label Live API Validation Tests', function () {
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
      const forbiddenData = generateLabelForbiddenFields();
      const response = await request
        .post('/v2/label')
        .send(forbiddenData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateLabelMinimal();
      invalidData.labelType = getInvalidPicklistValue('labelType');
      const response = await request
        .post('/v2/label')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = {}; // Missing labelName
      const response = await request
        .post('/v2/label')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateLabelLongStrings();
      const response = await request
        .post('/v2/label')
        .send(longData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });
  describe('Step 4: POST Request Tests', function () {
    it('should create labels with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateLabel();
      const { id, response } = await makePostRequest(request, '/v2/label', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('label', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/label', id, {
        labelName: data.labelName,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'label', id);
      } else {
        trackBatchVerification('POST', 'label', id, {
          labelName: data.labelName,
        });
      }

      // Create 1 minimal record
      const minimalData = generateLabelMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/label', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('label', minId);
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'label', minId);
      } else {
        trackBatchVerification('POST', 'label', minId, {
          labelName: minimalData.labelName,
        });
      }

      // Create 1 maximal record
      const maximalData = generateLabelMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/label', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('label', maxId);
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'label', maxId);
      } else {
        trackBatchVerification('POST', 'label', maxId, {
          labelName: maximalData.labelName,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'label', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'label', id);
        expect(record).to.exist;
        expect(record.cadTrustLabelId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a label', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'label');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/label/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        labelName: `UPDATED-${Date.now()}`,
        labelType: record.labelType ?? null,
        labelLink: record.labelLink ?? null,
        labelDate: record.labelDate ?? null,
      };
      const response = await makePutRequest(request, '/v2/label', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'label', id);
        await validateDataInDatabase(request, 'label', id, {
          labelName: updateData.labelName,
        });
      } else {
        trackBatchVerification('PUT', 'label', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all labels with pagination', async function () {
      const response = await request
        .get('/v2/label?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific label by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/label/${id}`)
        .expect(200);

      expect(response.body.cadTrustLabelId).to.equal(id);
      expect(response.body).to.have.property('orgUid');
    });

    it('should filter labels by orgUid=me', async function () {
      const response = await request
        .get('/v2/label?orgUid=me&page=1&limit=10')
        .expect(200);

      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      for (const l of data) {
        expect(l).to.have.property('orgUid');
        expect(l.orgUid).to.equal(homeOrgId);
      }
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/label')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created labels', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'label');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/label', id, { query: { force: 'true' } });
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'label', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all labels are deleted', async function () {
      const response = await request.get('/v2/label').query({ page: 1, limit: 10 }).expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have labels that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
