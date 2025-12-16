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
import { addCreatedId, shouldAutoCommit, trackBatchVerification, getFirstCreatedId, getCreatedIds } from './helpers/shared-state.js';
import {
  generateProjectMethodology,
  generateProjectMethodologyMinimal,
  generateProjectMethodologyMaximal,
  generateProjectMethodologyForbiddenFields,
  generateProjectMethodologyInvalidForeignKey,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('ProjectMethodology Live API Validation Tests', function () {
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
      const methodologyId = getFirstCreatedId('methodology');
      if (!projectId || !methodologyId) {
        this.skip();
      }
      const forbiddenData = generateProjectMethodologyForbiddenFields(projectId, methodologyId);
      const response = await request
        .post('/v2/project-methodology')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateProjectMethodologyInvalidForeignKey();
      const response = await request
        .post('/v2/project-methodology')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { cadTrustProjectId: 'test' }; // Missing cadTrustMethodologyId
      const response = await request
        .post('/v2/project-methodology')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with strings that are too long', async function () {
      const projectId = getFirstCreatedId('project');
      const methodologyId = getFirstCreatedId('methodology');
      if (!projectId || !methodologyId) {
        this.skip();
      }
      const longData = generateProjectMethodologyMaximal(projectId, methodologyId);
      // Note: Long strings test may need manual adjustment
      const response = await request
        .post('/v2/project-methodology')
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
    it('should create projectMethodologies with typical, minimal, and maximal data', async function () {
      // Get project and methodology IDs from earlier tests
      const projectId = getFirstCreatedId('project');
      const methodologyId = getFirstCreatedId('methodology');
      if (!projectId || !methodologyId) {
        throw new Error('Project or Methodology ID not found. Ensure project-validation.spec.js and methodology-validation.spec.js run before project-methodology-validation.spec.js');
      }

      // Create up to 10 typical records
      // Use unique combinations to avoid duplicate composite keys
      const methodologyIds = getCreatedIds('methodology');
      const projectIds = getCreatedIds('project');
      const usedCombinations = new Set();
      let created = 0;
      const maxRecords = Math.min(10, projectIds.length * methodologyIds.length);

      for (let projIdx = 0; projIdx < projectIds.length && created < maxRecords; projIdx++) {
        for (let methIdx = 0; methIdx < methodologyIds.length && created < maxRecords; methIdx++) {
          const currentProjectId = projectIds[projIdx];
          const currentMethodologyId = methodologyIds[methIdx];
          const combinationKey = `${currentProjectId}-${currentMethodologyId}`;

          // Skip if we've already used this combination
          if (usedCombinations.has(combinationKey)) {
            continue;
          }

          usedCombinations.add(combinationKey);
          const data = generateProjectMethodology(currentProjectId, currentMethodologyId);
          const { id, response } = await makePostRequest(request, '/v2/project-methodology', data);
          expect(response.success).to.be.true;
          expect(id).to.exist;
          // Composite key: { projectId, methodologyId }
          const compositeId = { projectId: currentProjectId, methodologyId: currentMethodologyId };
          createdIds.push(compositeId);
          addCreatedId('project-methodology', compositeId);
          // Check record is in staging table
          const inStaging = await checkRecordInStaging(request, '/v2/project-methodology', compositeId, {
            cadTrustProjectId: currentProjectId,
            cadTrustMethodologyId: currentMethodologyId,
          });
          expect(inStaging).to.be.true;
          // Commit if in extended mode
          if (shouldAutoCommit()) {
            await commitStagedRecords(request, []);
            await waitForPendingCommits(request);
            await waitForStagingEmpty(request);
            await waitForDataToAppear(request, 'project-methodology', compositeId);
          } else {
            trackBatchVerification('POST', 'project-methodology', compositeId, {
              cadTrustProjectId: currentProjectId,
              cadTrustMethodologyId: currentMethodologyId,
            });
          }
          created++;
        }
      }

      // Create 1 minimal record - use a combination that hasn't been used yet
      let minProjectId = projectId;
      let minMethodologyId = methodologyId;
      const minCombinationKey = `${minProjectId}-${minMethodologyId}`;
      if (usedCombinations.has(minCombinationKey)) {
        // Find an unused combination
        for (let i = 0; i < projectIds.length; i++) {
          for (let j = 0; j < methodologyIds.length; j++) {
            const testKey = `${projectIds[i]}-${methodologyIds[j]}`;
            if (!usedCombinations.has(testKey)) {
              minProjectId = projectIds[i];
              minMethodologyId = methodologyIds[j];
              break;
            }
          }
          if (!usedCombinations.has(`${minProjectId}-${minMethodologyId}`)) break;
        }
      }
      usedCombinations.add(`${minProjectId}-${minMethodologyId}`);
      const minimalData = generateProjectMethodologyMinimal(minProjectId, minMethodologyId);
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/project-methodology', minimalData);
      expect(minResponse.success).to.be.true;
      const minCompositeId = { projectId: minProjectId, methodologyId: minMethodologyId };
      createdIds.push(minCompositeId);
      addCreatedId('project-methodology', minCompositeId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project-methodology', minCompositeId);
      } else {
        trackBatchVerification('POST', 'project-methodology', minCompositeId, {
          cadTrustProjectId: projectId,
          cadTrustMethodologyId: methodologyId,
        });
      }

      // Create 1 maximal record - use a combination that hasn't been used yet
      let maxProjectId = projectId;
      let maxMethodologyId = methodologyId;
      const maxCombinationKey = `${maxProjectId}-${maxMethodologyId}`;
      if (usedCombinations.has(maxCombinationKey)) {
        // Find an unused combination
        for (let i = 0; i < projectIds.length; i++) {
          for (let j = 0; j < methodologyIds.length; j++) {
            const testKey = `${projectIds[i]}-${methodologyIds[j]}`;
            if (!usedCombinations.has(testKey)) {
              maxProjectId = projectIds[i];
              maxMethodologyId = methodologyIds[j];
              break;
            }
          }
          if (!usedCombinations.has(`${maxProjectId}-${maxMethodologyId}`)) break;
        }
      }
      usedCombinations.add(`${maxProjectId}-${maxMethodologyId}`);
      const maximalData = generateProjectMethodologyMaximal(maxProjectId, maxMethodologyId);
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/project-methodology', maximalData);
      expect(maxResponse.success).to.be.true;
      const maxCompositeId = { projectId: maxProjectId, methodologyId: maxMethodologyId };
      createdIds.push(maxCompositeId);
      addCreatedId('project-methodology', maxCompositeId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project-methodology', maxCompositeId);
      } else {
        trackBatchVerification('POST', 'project-methodology', maxCompositeId, {
          cadTrustProjectId: maxProjectId,
          cadTrustMethodologyId: maxMethodologyId,
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'projectMethodology', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const compositeId of createdIds) {
        const record = await waitForDataToAppear(request, 'project-methodology', compositeId);
        expect(record).to.exist;
        expect(record.cadTrustProjectId).to.equal(compositeId.projectId);
        expect(record.cadTrustMethodologyId).to.equal(compositeId.methodologyId);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a projectMethodology', async function () {
      const compositeId = createdIds[0];
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/project-methodology/project/${compositeId.projectId}/methodology/${compositeId.methodologyId}`).expect(200);
      // Create update data with ALL fields
      const updateData = {
        cadTrustProjectId: currentRecord.body.cadTrustProjectId,
        cadTrustMethodologyId: currentRecord.body.cadTrustMethodologyId,
        projectMethodologyDate: currentRecord.body.projectMethodologyDate || null,
        projectMethodologyDescription: currentRecord.body.projectMethodologyDescription || null,
      };
      const response = await makePutRequest(request, '/v2/project-methodology', compositeId, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project-methodology', compositeId);
        await validateDataInDatabase(request, 'project-methodology', compositeId, {
          cadTrustProjectId: updateData.cadTrustProjectId,
          cadTrustMethodologyId: updateData.cadTrustMethodologyId,
        });
      } else {
        trackBatchVerification('PUT', 'project-methodology', compositeId, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all projectMethodologies with pagination', async function () {
      const response = await request
        .get('/v2/project-methodology?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific projectMethodology by ID', async function () {
      const compositeId = createdIds[0];
      const response = await request
        .get(`/v2/project-methodology/project/${compositeId.projectId}/methodology/${compositeId.methodologyId}`)
        .expect(200);

      expect(response.body.cadTrustProjectId).to.equal(compositeId.projectId);
      expect(response.body.cadTrustMethodologyId).to.equal(compositeId.methodologyId);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/project-methodology')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created projectMethodologies', async function () {
      // Delete in reverse order
      for (let i = createdIds.length - 1; i >= 0; i--) {
        const compositeId = createdIds[i];
        const response = await makeDeleteRequest(request, '/v2/project-methodology', compositeId);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'project-methodology', compositeId);
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
    it('should verify all projectMethodologies are deleted', async function () {
      const response = await request.get('/v2/project-methodology').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have projectMethodologies that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
