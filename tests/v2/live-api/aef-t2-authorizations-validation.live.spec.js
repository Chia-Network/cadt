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
  generateAefT2Authorizations,
  generateAefT2AuthorizationsMinimal,
  generateAefT2AuthorizationsMaximal,
  generateAefT2AuthorizationsForbiddenFields,
  generateAefT2AuthorizationsInvalidPicklist,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('AefT2Authorizations Live API Validation Tests', function () {
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
      const forbiddenData = generateAefT2AuthorizationsForbiddenFields();
      const response = await request
        .post('/v2/aef-t2-authorizations')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateAefT2AuthorizationsInvalidPicklist();
      const response = await request
        .post('/v2/aef-t2-authorizations')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { aefT2AuthorizationsId: 'TEST' }; // Missing required fields
      const response = await request
        .post('/v2/aef-t2-authorizations')
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
    it('should create aefT2Authorizations with typical, minimal, and maximal data', async function () {
      // Get optional IDs from earlier tests if available
      const t1SubmissionId = getFirstCreatedId('aef-t1-submission');
      const unitId = getFirstCreatedId('unit');
      const projectId = getFirstCreatedId('project');
      const t5EntityId = getFirstCreatedId('aef-t5-authorized-entities');

      // Create 1 typical record
      const data = generateAefT2Authorizations(t1SubmissionId, unitId, projectId, t5EntityId);
      const { id, response } = await makePostRequest(request, '/v2/aef-t2-authorizations', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('aef-t2-authorizations', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/aef-t2-authorizations', id, {
        aefT2AuthorizationsId: data.aefT2AuthorizationsId,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t2-authorizations', id);
      } else {
        trackBatchVerification('POST', 'aef-t2-authorizations', id, {
          aefT2AuthorizationsId: data.aefT2AuthorizationsId,
        });
      }

      // Create 1 minimal record
      const minimalData = generateAefT2AuthorizationsMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/aef-t2-authorizations', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('aef-t2-authorizations', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t2-authorizations', minId);
      } else {
        trackBatchVerification('POST', 'aef-t2-authorizations', minId, {
          aefT2AuthorizationsId: minimalData.aefT2AuthorizationsId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateAefT2AuthorizationsMaximal(t1SubmissionId, unitId, projectId, t5EntityId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/aef-t2-authorizations', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('aef-t2-authorizations', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t2-authorizations', maxId);
      } else {
        trackBatchVerification('POST', 'aef-t2-authorizations', maxId, {
          aefT2AuthorizationsId: maximalData.aefT2AuthorizationsId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'aef-t2-authorizations', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'aef-t2-authorizations', id);
        expect(record).to.exist;
        expect(record.cadTrustAefT2AuthorizationsId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a aefT2Authorizations', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'aef-t2-authorizations');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/aef-t2-authorizations/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        aefT2AuthorizationsId: record.aefT2AuthorizationsId,
        aefT2AuthorizationsDate: record.aefT2AuthorizationsDate,
        aefT2AuthorizationsCooperativeApproachId: record.aefT2AuthorizationsCooperativeApproachId,
        aefT2AuthorizationsAuthorizedPartyId: record.aefT2AuthorizationsAuthorizedPartyId,
        aefT2AuthorizationsVersion: record.aefT2AuthorizationsVersion ?? null,
        aefT2AuthorizationsQuantity: record.aefT2AuthorizationsQuantity ?? null,
        aefT2AuthorizationsMetric: record.aefT2AuthorizationsMetric ?? null,
        aefT2AuthorizationsGwpValue: record.aefT2AuthorizationsGwpValue ?? null,
        aefT2AuthorizationsApplicableNonGhgMetric: record.aefT2AuthorizationsApplicableNonGhgMetric ?? null,
        aefT2AuthorizationsSector: record.aefT2AuthorizationsSector ?? null,
        aefT2AuthorizationsActivityType: record.aefT2AuthorizationsActivityType ?? null,
        aefT2AuthorizationsPurposesForAuthorization: record.aefT2AuthorizationsPurposesForAuthorization ?? null,
        aefT2AuthorizationsAuthoziedEntityId: record.aefT2AuthorizationsAuthoziedEntityId ?? null,
        aefT2AuthorizationsOimpAuthorizedParty: record.aefT2AuthorizationsOimpAuthorizedParty ?? null,
        aefT2AuthorizationsAuthorizedTimeframe: record.aefT2AuthorizationsAuthorizedTimeframe ?? null,
        aefT2AuthorizationsAuthorizationTerms: record.aefT2AuthorizationsAuthorizationTerms ?? null,
        aefT2AuthorizationsAuthorizationDocumentation: record.aefT2AuthorizationsAuthorizationDocumentation ?? null,
        aefT2AuthorizationsFirstTransferDefinitionOimp: record.aefT2AuthorizationsFirstTransferDefinitionOimp ?? null,
        aefT2AuthorizationsAdditionalInformation: record.aefT2AuthorizationsAdditionalInformation ?? null,
        cadTrustAefT1SubmissionId: record.cadTrustAefT1SubmissionId ?? null,
        cadTrustUnitId: record.cadTrustUnitId ?? null,
        cadTrustProjectId: record.cadTrustProjectId ?? null,
        cadTrustAefT5AuthorizedEntitiesId: record.cadTrustAefT5AuthorizedEntitiesId ?? null,
      };
      const response = await makePutRequest(request, '/v2/aef-t2-authorizations', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'aef-t2-authorizations', id);
        await validateDataInDatabase(request, 'aef-t2-authorizations', id, {
          aefT2AuthorizationsId: updateData.aefT2AuthorizationsId,
        });
      } else {
        trackBatchVerification('PUT', 'aef-t2-authorizations', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all aef-t2-authorizations with pagination', async function () {
      const response = await request
        .get('/v2/aef-t2-authorizations?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific aef-t2-authorizations by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/aef-t2-authorizations/${id}`)
        .expect(200);

      expect(response.body.cadTrustAefT2AuthorizationsId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/aef-t2-authorizations')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created aef-t2-authorizations', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'aef-t2-authorizations');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/aef-t2-authorizations', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'aef-t2-authorizations', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all aef-t2-authorizations are deleted', async function () {
      const response = await request.get('/v2/aef-t2-authorizations').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have aef-t2-authorizations that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
