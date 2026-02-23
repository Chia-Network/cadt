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
  generateAefT5AuthorizedEntities,
  generateAefT5AuthorizedEntitiesMinimal,
  generateAefT5AuthorizedEntitiesMaximal,
  generateAefT5AuthorizedEntitiesForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('AefT5AuthorizedEntities Live API Validation Tests', function () {
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
      const forbiddenData = generateAefT5AuthorizedEntitiesForbiddenFields();
      const response = await request
        .post('/v2/aef-t5-authorized-entities')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateAefT5AuthorizedEntitiesMinimal();
      invalidData.aefT5AuthorizedEntitiesIncorporationCountry = getInvalidPicklistValue('aefT5AuthorizedEntitiesIncorporationCountry');
      const response = await request
        .post('/v2/aef-t5-authorized-entities')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { aefT5AuthorizedEntitiesName: 'Incomplete' }; // Missing other required fields
      const response = await request
        .post('/v2/aef-t5-authorized-entities')
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
    it('should create aefT5AuthorizedEntities with typical, minimal, and maximal data', async function () {
      // AEF T5 Authorized Entities has no dependencies - standalone entity
      // Create 1 typical record
      const data = generateAefT5AuthorizedEntities();
      const { id, response } = await makePostRequest(request, '/v2/aef-t5-authorized-entities', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('aef-t5-authorized-entities', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/aef-t5-authorized-entities', id, {
        aefT5AuthorizedEntitiesId: data.aefT5AuthorizedEntitiesId,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t5-authorized-entities', id);
      } else {
        trackBatchVerification('POST', 'aef-t5-authorized-entities', id, {
          aefT5AuthorizedEntitiesId: data.aefT5AuthorizedEntitiesId,
        });
      }

      // Create 1 minimal record
      const minimalData = generateAefT5AuthorizedEntitiesMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/aef-t5-authorized-entities', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('aef-t5-authorized-entities', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t5-authorized-entities', minId);
      } else {
        trackBatchVerification('POST', 'aef-t5-authorized-entities', minId, {
          aefT5AuthorizedEntitiesId: minimalData.aefT5AuthorizedEntitiesId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateAefT5AuthorizedEntitiesMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/aef-t5-authorized-entities', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('aef-t5-authorized-entities', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t5-authorized-entities', maxId);
      } else {
        trackBatchVerification('POST', 'aef-t5-authorized-entities', maxId, {
          aefT5AuthorizedEntitiesId: maximalData.aefT5AuthorizedEntitiesId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'aef-t5-authorized-entities', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'aef-t5-authorized-entities', id);
        expect(record).to.exist;
        expect(record.cadTrustAefT5AuthorizedEntitiesId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a aefT5AuthorizedEntities', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'aef-t5-authorized-entities');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/aef-t5-authorized-entities/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        aefT5AuthorizedEntitiesAuthorizationDate: record.aefT5AuthorizedEntitiesAuthorizationDate,
        aefT5AuthorizedEntitiesName: record.aefT5AuthorizedEntitiesName,
        aefT5AuthorizedEntitiesId: record.aefT5AuthorizedEntitiesId,
        aefT5AuthorizedEntitiesCooperativeApproachId: record.aefT5AuthorizedEntitiesCooperativeApproachId,
        aefT5AuthorizedEntitiesIncorporationCountry: record.aefT5AuthorizedEntitiesIncorporationCountry ?? null,
        aefT5AuthorizedEntitiesConditions: record.aefT5AuthorizedEntitiesConditions ?? null,
        aefT5AuthorizedEntitiesChangeConditions: record.aefT5AuthorizedEntitiesChangeConditions ?? null,
        aefT5AuthorizedEntitiesAdditionalInformation: record.aefT5AuthorizedEntitiesAdditionalInformation ?? null,
        cadTrustAefT1SubmissionId: record.cadTrustAefT1SubmissionId ?? null,
        cadTrustUnitId: record.cadTrustUnitId ?? null,
        cadTrustProjectId: record.cadTrustProjectId ?? null,
      };
      const response = await makePutRequest(request, '/v2/aef-t5-authorized-entities', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t5-authorized-entities', id);
        await validateDataInDatabase(request, 'aef-t5-authorized-entities', id, {
          aefT5AuthorizedEntitiesId: updateData.aefT5AuthorizedEntitiesId,
        });
      } else {
        trackBatchVerification('PUT', 'aef-t5-authorized-entities', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all aef-t5-authorized-entities with pagination', async function () {
      const response = await request
        .get('/v2/aef-t5-authorized-entities?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific aef-t5-authorized-entities by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/aef-t5-authorized-entities/${id}`)
        .expect(200);

      expect(response.body.cadTrustAefT5AuthorizedEntitiesId).to.equal(id);
    });

    it('should filter aef-t5-authorized-entities by orgUid=me', async function () {
      const response = await request
        .get('/v2/aef-t5-authorized-entities?orgUid=me&page=1&limit=10')
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
        .get('/v2/aef-t5-authorized-entities')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created aef-t5-authorized-entities', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'aef-t5-authorized-entities');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/aef-t5-authorized-entities', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'aef-t5-authorized-entities', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all aef-t5-authorized-entities are deleted', async function () {
      const response = await request.get('/v2/aef-t5-authorized-entities').query({ page: 1, limit: 10 }).expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have aef-t5-authorized-entities that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
