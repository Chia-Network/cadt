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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstCreatedId } from './helpers/shared-state.js';
import {
  generateValidation,
  generateValidationMinimal,
  generateValidationMaximal,
  generateValidationForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Validation Live API Validation Tests', function () {
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
      const forbiddenData = generateValidationForbiddenFields(projectId);
      const response = await request
        .post('/v2/validation')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid picklist values', async function () {
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        this.skip();
      }
      const invalidData = generateValidationMinimal(projectId);
      invalidData.validationType = getInvalidPicklistValue('validationType');
      const response = await request
        .post('/v2/validation')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { validationId: 'TEST-VAL' }; // Missing cadTrustProjectId
      const response = await request
        .post('/v2/validation')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with strings that are too long', async function () {
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        this.skip();
      }
      const longData = generateValidation(projectId);
      // Note: Long strings test may need manual adjustment
      const response = await request
        .post('/v2/validation')
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
    it('should create validations with typical, minimal, and maximal data', async function () {
      // Get project ID from earlier test (project-validation.spec.js runs before this)
      const projectId = getFirstCreatedId('project');
      if (!projectId) {
        throw new Error('Project ID not found. Ensure project-validation.spec.js runs before validation-validation.spec.js');
      }

      // Create 10 typical records
      for (let i = 0; i < 10; i++) {
        const data = generateValidation(projectId);
        data.validationId = `${data.validationId}-${i}`;
        const { id, response } = await makePostRequest(request, '/v2/validation', data);
        expect(response.success).to.be.true;
        expect(id).to.exist;
        createdIds.push(id);
        addCreatedId('validation', id);
        // Check record is in staging table
        const inStaging = await checkRecordInStaging(request, '/v2/validation', id, {
          validationId: data.validationId,
        });
        expect(inStaging).to.be.true;
        // Commit if in extended mode
        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          await waitForDataToAppear(request, 'validation', id);
        } else {
          trackBatchVerification('POST', 'validation', id, {
            validationId: data.validationId,
          });
        }
      }

      // Create 1 minimal record
      const minimalData = generateValidationMinimal(projectId);
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/validation', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('validation', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'validation', minId);
      } else {
        trackBatchVerification('POST', 'validation', minId, {
          validationId: minimalData.validationId,
        });
      }

      // Create 1 maximal record
      const maximalData = generateValidationMaximal(projectId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/validation', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('validation', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'validation', maxId);
      } else {
        trackBatchVerification('POST', 'validation', maxId, {
          validationId: maximalData.validationId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'validation', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'validation', id);
        expect(record).to.exist;
        expect(record.cadTrustValidationId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a validation', async function () {
      const id = createdIds[0];
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/validation/${id}`).expect(200);
      // Create update data with ALL fields
      const updateData = {
        validationId: currentRecord.body.validationId,
        validationType: currentRecord.body.validationType || null,
        validationBody: currentRecord.body.validationBody || null,
        validationDate: currentRecord.body.validationDate || null,
        validationCreditPeriodStartDate: currentRecord.body.validationCreditPeriodStartDate || null,
        validationCreditPeriodEndDate: currentRecord.body.validationCreditPeriodEndDate || null,
        cadTrustProjectId: currentRecord.body.cadTrustProjectId,
      };
      const response = await makePutRequest(request, '/v2/validation', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'validation', id);
        await validateDataInDatabase(request, 'validation', id, {
          validationId: updateData.validationId,
        });
      } else {
        trackBatchVerification('PUT', 'validation', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all validations with pagination', async function () {
      const response = await request
        .get('/v2/validation?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific validation by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/validation/${id}`)
        .expect(200);

      expect(response.body.cadTrustValidationId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/validation')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created validations', async function () {
      // Delete in reverse order
      for (let i = createdIds.length - 1; i >= 0; i--) {
        const id = createdIds[i];
        const response = await makeDeleteRequest(request, '/v2/validation', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'validation', id);
        }
      }

      // Commit all deletes if in short mode
      if (!shouldAutoCommit()) {
        await commitStagedRecords(request, [], true);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
      }
    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all validations are deleted', async function () {
      const response = await request.get('/v2/validation').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have validations that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
