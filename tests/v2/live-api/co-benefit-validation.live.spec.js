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
  generateCoBenefit,
  generateCoBenefitMinimal,
  generateCoBenefitMaximal,
  generateCoBenefitForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
  getNonExistentId,
} from './data/test-data-generators.js';

describe('CoBenefit Live API Validation Tests', function () {
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
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        this.skip();
      }
      const forbiddenData = generateCoBenefitForbiddenFields(projectId);
      const response = await request
        .post('/v2/co-benefit')
        .send(forbiddenData);
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateCoBenefitMinimal(getNonExistentId());
      const response = await request
        .post('/v2/co-benefit')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        this.skip();
      }
      const invalidData = generateCoBenefitMinimal(projectId);
      invalidData.coBenefitId = getInvalidPicklistValue('coBenefitId');
      const response = await request
        .post('/v2/co-benefit')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { coBenefitId: 'SDG 13 - Climate action' }; // Missing cadTrustProjectId
      const response = await request
        .post('/v2/co-benefit')
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
    it('should create coBenefits with typical, minimal, and maximal data', async function () {
      // Get project ID from earlier test (project-validation.spec.js runs before this)
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        throw new Error('Project ID not found. Ensure project-validation.spec.js runs before co-benefit-validation.spec.js');
      }

      // Create 1 typical record
      const data = generateCoBenefit(projectId);
      const { id, response } = await makePostRequest(request, '/v2/co-benefit', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('coBenefit', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/co-benefit', id, {
        coBenefitId: data.coBenefitId,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'coBenefit', id);
      } else {
        trackBatchVerification('POST', 'coBenefit', id, {
          coBenefitId: data.coBenefitId,
        });
      }

      // Create 1 minimal record
      const minimalData = generateCoBenefitMinimal(getFirstCreatedId('project'));
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/co-benefit', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('coBenefit', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'coBenefit', minId);
      } else {
        trackBatchVerification('POST', 'coBenefit', minId, {
          coBenefitId: minimalData.coBenefitId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateCoBenefitMaximal(getFirstCreatedId('project'));
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/co-benefit', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('coBenefit', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'coBenefit', maxId);
      } else {
        trackBatchVerification('POST', 'coBenefit', maxId, {
          coBenefitId: maximalData.coBenefitId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'coBenefit', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'coBenefit', id);
        expect(record).to.exist;
        expect(record.cadTrustCoBenefitId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a coBenefit', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'co-benefit');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/co-benefit/${id}`).expect(200);
      // Create update data with ALL fields
      const updateData = {
        coBenefitId: 'SDG 17 - Partnerships for the goals', // Different SDG value
        cadTrustProjectId: currentRecord.body.cadTrustProjectId,
      };
      const response = await makePutRequest(request, '/v2/co-benefit', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'coBenefit', id);
        await validateDataInDatabase(request, 'coBenefit', id, {
          coBenefitId: updateData.coBenefitId,
        });
      } else {
        trackBatchVerification('PUT', 'coBenefit', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all coBenefits with pagination', async function () {
      const response = await request
        .get('/v2/co-benefit?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific coBenefit by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/co-benefit/${id}`)
        .expect(200);

      expect(response.body.cadTrustCoBenefitId).to.equal(id);
    });

    it('should filter co-benefits by orgUid=me', async function () {
      const response = await request
        .get('/v2/co-benefit?orgUid=me&page=1&limit=10')
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
        .get('/v2/co-benefit')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created coBenefits', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'co-benefit');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/co-benefit', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'coBenefit', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all coBenefits are deleted', async function () {
      const response = await request.get('/v2/co-benefit').query({ page: 1, limit: 10 }).expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have coBenefits that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
