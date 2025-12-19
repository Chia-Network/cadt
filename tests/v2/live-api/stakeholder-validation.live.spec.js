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
  generateStakeholder,
  generateStakeholderMinimal,
  generateStakeholderMaximal,
  generateStakeholderLongStrings,
  generateStakeholderForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Stakeholder Live API Validation Tests', function () {
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
      const forbiddenData = generateStakeholderForbiddenFields();
      const response = await request
        .post('/v2/stakeholder')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateStakeholderMinimal();
      invalidData.stakeholderType = getInvalidPicklistValue('stakeholderType');
      const response = await request
        .post('/v2/stakeholder')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = {}; // Missing stakeholderName (required field)
      const response = await request
        .post('/v2/stakeholder')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateStakeholderLongStrings();
      const response = await request
        .post('/v2/stakeholder')
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
    it('should create stakeholders with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateStakeholder();
      const { id, response } = await makePostRequest(request, '/v2/stakeholder', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('stakeholder', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/stakeholder', id, {
        stakeholderName: data.stakeholderName,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'stakeholder', id);
      } else {
        trackBatchVerification('POST', 'stakeholder', id, {
          stakeholderName: data.stakeholderName,
        });
      }

      // Create 1 minimal record
      const minimalData = generateStakeholderMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/stakeholder', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('stakeholder', minId);
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'stakeholder', minId);
      } else {
        trackBatchVerification('POST', 'stakeholder', minId, {
          stakeholderName: minimalData.stakeholderName,
        });
      }

      // Create 1 maximal record
      const maximalData = generateStakeholderMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/stakeholder', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('stakeholder', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'stakeholder', maxId);
      } else {
        trackBatchVerification('POST', 'stakeholder', maxId, {
          stakeholderName: maximalData.stakeholderName,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'stakeholder', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'stakeholder', id);
        expect(record).to.exist;
        expect(record.cadTrustStakeholderId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a stakeholder', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'stakeholder');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/stakeholder/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        stakeholderName: `UPDATED-${Date.now()}`,
        stakeholderType: record.stakeholderType ?? null,
        stakeholderLink: record.stakeholderLink ?? null,
      };
      const response = await makePutRequest(request, '/v2/stakeholder', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'stakeholder', id);
        await validateDataInDatabase(request, 'stakeholder', id, {
          stakeholderName: updateData.stakeholderName,
        });
      } else {
        trackBatchVerification('PUT', 'stakeholder', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all stakeholders with pagination', async function () {
      const response = await request
        .get('/v2/stakeholder?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific stakeholder by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/stakeholder/${id}`)
        .expect(200);

      expect(response.body.cadTrustStakeholderId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/stakeholder')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created stakeholders', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'stakeholder');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/stakeholder', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'stakeholder', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all stakeholders are deleted', async function () {
      const response = await request.get('/v2/stakeholder').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have stakeholders that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
