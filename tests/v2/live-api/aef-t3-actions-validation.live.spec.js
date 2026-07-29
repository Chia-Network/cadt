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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstCreatedId, getCreatedIds, getFirstRecordIdFromDatabase, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateAefT3Actions,
  generateAefT3ActionsMinimal,
  generateAefT3ActionsMaximal,
  generateAefT3ActionsForbiddenFields,
  generateAefT3ActionsInvalidForeignKey,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('AefT3Actions Live API Validation Tests', function () {
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
      const forbiddenData = generateAefT3ActionsForbiddenFields();
      const response = await request
        .post('/v2/aef-t3-actions')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateAefT3ActionsInvalidForeignKey();
      const response = await request
        .post('/v2/aef-t3-actions')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { aefT3ActionsDate: '2022-03-01' }; // Missing required fields
      const response = await request
        .post('/v2/aef-t3-actions')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });
  describe('Step 4: POST Request Tests', function () {
    it('should create aefT3Actions with typical, minimal, and maximal data', async function () {
      // Get optional IDs from earlier tests if available
      const t2AuthId = getFirstCreatedId('aef-t2-authorizations');
      const unitId = getFirstCreatedId('unit');

      // Create 1 typical record
      const data = generateAefT3Actions(t2AuthId, unitId);
      const { id, response } = await makePostRequest(request, '/v2/aef-t3-actions', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('aef-t3-actions', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/aef-t3-actions', id, {
        aefT3ActionsCooperativeApproachId: data.aefT3ActionsCooperativeApproachId,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t3-actions', id);
      } else {
        trackBatchVerification('POST', 'aef-t3-actions', id, {
          aefT3ActionsCooperativeApproachId: data.aefT3ActionsCooperativeApproachId,
        });
      }

      // Create 1 minimal record
      const minimalData = generateAefT3ActionsMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/aef-t3-actions', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('aef-t3-actions', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t3-actions', minId);
      } else {
        trackBatchVerification('POST', 'aef-t3-actions', minId, {
          aefT3ActionsCooperativeApproachId: minimalData.aefT3ActionsCooperativeApproachId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateAefT3ActionsMaximal(t2AuthId, unitId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/aef-t3-actions', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('aef-t3-actions', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t3-actions', maxId);
      } else {
        trackBatchVerification('POST', 'aef-t3-actions', maxId, {
          aefT3ActionsCooperativeApproachId: maximalData.aefT3ActionsCooperativeApproachId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'aef-t3-actions', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'aef-t3-actions', id);
        expect(record).to.exist;
        expect(record.cadTrustAefT3ActionsId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a aefT3Actions', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'aef-t3-actions');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/aef-t3-actions/${id}`).expect(200);
      // Create update data with ALL fields (required fields must be included)
      // Use all fields from current record to ensure we have all required fields
      const updateData = { ...currentRecord.body };
      // Remove auto-generated and forbidden fields (check both camelCase and snake_case)
      delete updateData.cadTrustAefT3ActionsId;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.created_at;
      delete updateData.updated_at;
      delete updateData.createdByOrgUid;
      delete updateData.created_by_org_uid;
      const response = await makePutRequest(request, '/v2/aef-t3-actions', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t3-actions', id);
        await validateDataInDatabase(request, 'aef-t3-actions', id, {
          aefT3ActionsDate: updateData.aefT3ActionsDate,
        });
      } else {
        trackBatchVerification('PUT', 'aef-t3-actions', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all aef-t3-actions with pagination', async function () {
      const response = await request
        .get('/v2/aef-t3-actions?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific aef-t3-actions by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/aef-t3-actions/${id}`)
        .expect(200);

      expect(response.body.cadTrustAefT3ActionsId).to.equal(id);
    });

    it('should filter aef-t3-actions by orgUid=me', async function () {
      const response = await request
        .get('/v2/aef-t3-actions?orgUid=me&page=1&limit=10')
        .expect(200);

      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      expect(data.length).to.be.greaterThan(0);
      for (const record of data) {
        expect(record).to.have.property('cadTrustProjectId');
      }
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/aef-t3-actions')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created aef-t3-actions', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'aef-t3-actions');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/aef-t3-actions', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'aef-t3-actions', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all aef-t3-actions are deleted', async function () {
      const response = await request.get('/v2/aef-t3-actions').query({ page: 1, limit: 10 }).expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have aef-t3-actions that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
