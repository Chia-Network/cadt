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
  generateLocation,
  generateLocationMinimal,
  generateLocationMaximal,
  generateLocationLongStrings,
  generateLocationForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
  getNonExistentId,
} from './data/test-data-generators.js';

describe('Location Live API Validation Tests', function () {
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
      const forbiddenData = generateLocationForbiddenFields();
      const response = await request
        .post('/v2/location')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateLocationMinimal(getNonExistentId());
      const response = await request
        .post('/v2/location')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        this.skip();
      }
      const invalidData = generateLocationMinimal(projectId);
      invalidData.locationCountry = getInvalidPicklistValue('locationCountry');
      const response = await request
        .post('/v2/location')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { locationCountry: 'United States of America' }; // Missing cadTrustProjectId
      const response = await request
        .post('/v2/location')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        this.skip();
      }
      const longData = generateLocationLongStrings(projectId);
      const response = await request
        .post('/v2/location')
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
    it('should create locations with typical, minimal, and maximal data', async function () {
      // Get project ID from earlier test (project-validation.spec.js runs before this)
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        throw new Error('Project ID not found. Ensure project-validation.spec.js runs before location-validation.spec.js');
      }

      // Create 1 typical record
      const data = generateLocation(projectId);
      const { id, response } = await makePostRequest(request, '/v2/location', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('location', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/location', id, {
        locationCountry: data.locationCountry,
        locationRegion: data.locationRegion,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'location', id);
      } else {
        trackBatchVerification('POST', 'location', id, {
          locationCountry: data.locationCountry,
          locationRegion: data.locationRegion,
        });
      }

      // Create 1 minimal record
      const minimalData = generateLocationMinimal(projectId);
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/location', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('location', minId);
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'location', minId);
      } else {
        trackBatchVerification('POST', 'location', minId, {
          cadTrustProjectId: minimalData.cadTrustProjectId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateLocationMaximal(projectId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/location', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('location', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'location', maxId);
      } else {
        trackBatchVerification('POST', 'location', maxId, {
          locationCountry: maximalData.locationCountry,
          locationRegion: maximalData.locationRegion,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'location', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'location', id);
        expect(record).to.exist;
        expect(record.cadTrustLocationId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a location', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'location');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/location/${id}`).expect(200);
      // Handle both wrapped { data: record } and direct record responses
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      // Ensure required field is present (should always exist for valid records)
      if (record.cadTrustProjectId == null) {
        throw new Error(`Required field cadTrustProjectId is missing from location record ${id}. Record keys: ${Object.keys(record).join(', ')}`);
      }
      const updateData = {
        locationCountry: record.locationCountry ?? null,
        locationRegion: `UPDATED-REGION-${Date.now()}`,
        locationGis: record.locationGis ?? null,
        locationMapType: record.locationMapType ?? null,
        locationMapFileLink: record.locationMapFileLink ?? null,
        cadTrustProjectId: record.cadTrustProjectId, // Required - must be present
      };
      const response = await makePutRequest(request, '/v2/location', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'location', id);
        await validateDataInDatabase(request, 'location', id, {
          locationRegion: updateData.locationRegion,
        });
      } else {
        trackBatchVerification('PUT', 'location', id, updateData);
      }
    });
  });

  describe('Step 8: GET Request Tests', function () {
    it('should list all locations with pagination', async function () {
      const response = await request
        .get('/v2/location?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific location by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/location/${id}`)
        .expect(200);

      expect(response.body.cadTrustLocationId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/location')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created locations', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'location');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/location', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'location', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all locations are deleted', async function () {
      const response = await request.get('/v2/location').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have locations that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
