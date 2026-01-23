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
  generateIssuance,
  generateIssuanceMinimal,
  generateIssuanceMaximal,
  generateIssuanceForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
  getNonExistentId,
  generateIssuanceInvalidForeignKey,
} from './data/test-data-generators.js';

describe('Issuance Live API Validation Tests', function () {
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
      const verificationId = getFirstCreatedId('verification');
      const projectMethodologyId = getFirstCreatedId('projectMethodology');
      if (!verificationId || !projectMethodologyId) {
        this.skip();
      }
      const forbiddenData = generateIssuanceForbiddenFields(verificationId, projectMethodologyId);
      const response = await request
        .post('/v2/issuance')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateIssuanceInvalidForeignKey();
      const response = await request
        .post('/v2/issuance')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { issuanceId: 'Incomplete' }; // Missing cadTrustVerificationId
      const response = await request
        .post('/v2/issuance')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const verificationId = getFirstCreatedId('verification');
      const projectMethodologyId = getFirstCreatedId('projectMethodology');
      if (!verificationId || !projectMethodologyId) {
        this.skip();
      }
      const longData = generateIssuance(verificationId, projectMethodologyId);
      longData.issuanceId = getLongString(500);
      const response = await request
        .post('/v2/issuance')
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
    it('should create issuances with typical, minimal, and maximal data', async function () {
      // Get verification and projectMethodology IDs from earlier tests
      const verificationId = getFirstCreatedId('verification');
      const projectMethodologyId = getFirstCreatedId('projectMethodology');
      if (!verificationId || !projectMethodologyId) {
        throw new Error('Verification or ProjectMethodology ID not found. Ensure verification-validation.spec.js and project-methodology-validation.spec.js run before issuance-validation.spec.js');
      }
      // Optionally get location ID if available
      const locationIds = getCreatedIds('location');
      const locationId = locationIds.length > 0 ? locationIds[0] : null;

      // Create 1 typical record
      const data = generateIssuance(verificationId, projectMethodologyId, locationId);
      const { id, response } = await makePostRequest(request, '/v2/issuance', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('issuance', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/issuance', id, {
        issuanceId: data.issuanceId,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'issuance', id);
      } else {
        trackBatchVerification('POST', 'issuance', id, {
          issuanceId: data.issuanceId,
        });
      }

      // Create 1 minimal record
      const minimalData = generateIssuanceMinimal(verificationId, projectMethodologyId);
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/issuance', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('issuance', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'issuance', minId);
      } else {
        trackBatchVerification('POST', 'issuance', minId, {
          issuanceId: minimalData.issuanceId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateIssuanceMaximal(verificationId, projectMethodologyId, locationId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/issuance', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('issuance', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'issuance', maxId);
      } else {
        trackBatchVerification('POST', 'issuance', maxId, {
          issuanceId: maximalData.issuanceId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'issuance', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'issuance', id);
        expect(record).to.exist;
        expect(record.cadTrustIssuanceId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a issuance', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'issuance');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/issuance/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        issuanceId: record.issuanceId,
        issuanceDate: record.issuanceDate ?? null,
        cadTrustVerificationId: record.cadTrustVerificationId,
        cadTrustProjectMethodologyId: record.cadTrustProjectMethodologyId,
        cadTrustLocationId: record.cadTrustLocationId ?? null,
      };
      const response = await makePutRequest(request, '/v2/issuance', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'issuance', id);
        await validateDataInDatabase(request, 'issuance', id, {
          issuanceId: updateData.issuanceId,
        });
      } else {
        trackBatchVerification('PUT', 'issuance', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all issuances with pagination', async function () {
      const response = await request
        .get('/v2/issuance?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific issuance by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/issuance/${id}`)
        .expect(200);

      expect(response.body.cadTrustIssuanceId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/issuance')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created issuances', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'issuance');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/issuance', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'issuance', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all issuances are deleted', async function () {
      const response = await request.get('/v2/issuance').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have issuances that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
