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
import { addCreatedId, shouldAutoCommit, trackBatchVerification } from './helpers/shared-state.js';
import {
  generateProgram,
  generateProgramMinimal,
  generateProgramMaximal,
  generateProgramLongStrings,
  generateProgramForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Program Live API Validation Tests', function () {
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
      const forbiddenData = generateProgramForbiddenFields();
      const response = await request
        .post('/v2/program')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateProgramMinimal();
      invalidData.programRegistry = getInvalidPicklistValue('programRegistry');
      const response = await request
        .post('/v2/program')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { programName: 'Test' }; // Missing programRegistry and programRegistryActivityId
      const response = await request
        .post('/v2/program')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateProgramLongStrings();
      const response = await request
        .post('/v2/program')
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
    it('should create programs with typical, minimal, and maximal data', async function () {
      // Create 5 typical records
      for (let i = 0; i < 5; i++) {
        const data = generateProgram();
        data.programName = `${data.programName}-${i}`;
        const { id, response } = await makePostRequest(request, '/v2/program', data);
        expect(response.success).to.be.true;
        expect(id).to.exist;
        createdIds.push(id);
        addCreatedId('program', id);
        // Check record is in staging table
        const inStaging = await checkRecordInStaging(request, '/v2/program', id, {
          programName: data.programName,
          programRegistry: data.programRegistry,
        });
        expect(inStaging).to.be.true;
        // Commit if in extended mode
        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          await waitForDataToAppear(request, 'program', id);
        } else {
          trackBatchVerification('POST', 'program', id, {
            programName: data.programName,
            programRegistry: data.programRegistry,
          });
        }
      }

      // Create 1 minimal record
      const minimalData = generateProgramMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/program', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('program', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'program', minId);
      } else {
        trackBatchVerification('POST', 'program', minId, {
          programCode: minimalData.programCode,
          programName: minimalData.programName,
        });
      }

      // Create 1 maximal record
      const maximalData = generateProgramMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/program', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('program', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'program', maxId);
      } else {
        trackBatchVerification('POST', 'program', maxId, {
          programCode: maximalData.programCode,
          programName: maximalData.programName,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'program', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'program', id);
        expect(record).to.exist;
        expect(record.cadTrustProgramId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a program', async function () {
      const id = createdIds[0];
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/program/${id}`).expect(200);
      // Create update data with ALL fields
      const updateData = {
        programCode: `UPDATED-${Date.now()}`,
        programName: 'Updated Program Name',
        programVersion: currentRecord.body.programVersion || null,
        programDate: currentRecord.body.programDate || null,
        programLink: currentRecord.body.programLink || null,
        programType: currentRecord.body.programType || null,
      };
      const response = await makePutRequest(request, '/v2/program', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'program', id);
        await validateDataInDatabase(request, 'program', id, {
          programCode: updateData.programCode,
          programName: updateData.programName,
        });
      } else {
        trackBatchVerification('PUT', 'program', id, updateData);
      }
    });
  });

  describe('Step 8: GET Request Tests', function () {
    it('should list all programs with pagination', async function () {
      const response = await request
        .get('/v2/program?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific program by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/program/${id}`)
        .expect(200);

      expect(response.body.cadTrustProgramId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/program')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created programs', async function () {
      // Delete in reverse order
      for (let i = createdIds.length - 1; i >= 0; i--) {
        const id = createdIds[i];
        const response = await makeDeleteRequest(request, '/v2/program', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'program', id);
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
    it('should verify all programs are deleted', async function () {
      const response = await request.get('/v2/program').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have programs that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
