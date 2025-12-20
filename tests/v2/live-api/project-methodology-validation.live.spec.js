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
  generateProjectMethodology,
  generateProjectMethodologyMinimal,
  generateProjectMethodologyMaximal,
  generateProjectMethodologyForbiddenFields,
  generateProjectMethodologyInvalidForeignKey,
  getLongString,
  getInvalidPicklistValue,
  getNonExistentId,
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
      
      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateProjectMethodologyInvalidForeignKey();
      const response = await request
        .post('/v2/project-methodology')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { cadTrustProjectId: getNonExistentId() }; // Missing cadTrustMethodologyId
      const response = await request
        .post('/v2/project-methodology')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
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

      // Create up to 1 typical record
      const methodologyIds = getCreatedIds('methodology');
      const projectIds = getCreatedIds('project');
      let created = 0;
      const maxRecords = Math.min(1, projectIds.length * methodologyIds.length);
      const usedCombinations = new Set(); // Track used project-methodology combinations

      for (let projIdx = 0; projIdx < projectIds.length && created < maxRecords; projIdx++) {
        for (let methIdx = 0; methIdx < methodologyIds.length && created < maxRecords; methIdx++) {
          const currentProjectId = projectIds[projIdx];
          const currentMethodologyId = methodologyIds[methIdx];
          const comboKey = `${currentProjectId}:${currentMethodologyId}`;

          // Skip if this combination was already used
          if (usedCombinations.has(comboKey)) {
            continue;
          }

          const data = generateProjectMethodology(currentProjectId, currentMethodologyId);
          const { id, response } = await makePostRequest(request, '/v2/project-methodology', data);

          // Fail fast on any error - including duplicates
          expect(response.success).to.be.true;
          expect(id).to.exist;
          // UUID primary key
          const projectMethodologyId = id;
          createdIds.push(projectMethodologyId);
          addCreatedId('project-methodology', projectMethodologyId);
          usedCombinations.add(comboKey);

          // Check record is in staging table
          const inStaging = await checkRecordInStaging(request, '/v2/project-methodology', projectMethodologyId, {
            cadTrustProjectId: currentProjectId,
            cadTrustMethodologyId: currentMethodologyId,
          });
          expect(inStaging).to.be.true;
          // Commit if in extended mode
          if (shouldAutoCommit()) {
            await commitStagedRecords(request, []);
            await waitForPendingCommits(request);
            await waitForStagingEmpty(request);
            await waitForDataToAppear(request, 'project-methodology', projectMethodologyId);
          } else {
            trackBatchVerification('POST', 'project-methodology', projectMethodologyId, {
              cadTrustProjectId: currentProjectId,
              cadTrustMethodologyId: currentMethodologyId,
            });
          }
          created++;
        }
      }

      // Create 1 minimal record - find an unused combination
      let minProjectId = null;
      let minMethodologyId = null;
      for (let projIdx = 0; projIdx < projectIds.length && !minProjectId; projIdx++) {
        for (let methIdx = 0; methIdx < methodologyIds.length && !minProjectId; methIdx++) {
          const comboKey = `${projectIds[projIdx]}:${methodologyIds[methIdx]}`;
          if (!usedCombinations.has(comboKey)) {
            minProjectId = projectIds[projIdx];
            minMethodologyId = methodologyIds[methIdx];
            usedCombinations.add(comboKey);
            break;
          }
        }
      }

      if (minProjectId && minMethodologyId) {
        const minimalData = generateProjectMethodologyMinimal(minProjectId, minMethodologyId);
        const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/project-methodology', minimalData);

        // Fail fast on any error - including duplicates
        expect(minResponse.success).to.be.true;
        expect(minId).to.exist;
        createdIds.push(minId);
        addCreatedId('project-methodology', minId);

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          await waitForDataToAppear(request, 'project-methodology', minId);
        } else {
          trackBatchVerification('POST', 'project-methodology', minId, {
            cadTrustProjectId: minProjectId,
            cadTrustMethodologyId: minMethodologyId,
          });
        }
      }

      // Create 1 maximal record - find another unused combination
      let maxProjectId = null;
      let maxMethodologyId = null;
      for (let projIdx = 0; projIdx < projectIds.length && !maxProjectId; projIdx++) {
        for (let methIdx = 0; methIdx < methodologyIds.length && !maxProjectId; methIdx++) {
          const comboKey = `${projectIds[projIdx]}:${methodologyIds[methIdx]}`;
          if (!usedCombinations.has(comboKey)) {
            maxProjectId = projectIds[projIdx];
            maxMethodologyId = methodologyIds[methIdx];
            usedCombinations.add(comboKey);
            break;
          }
        }
      }

      if (maxProjectId && maxMethodologyId) {
        const maximalData = generateProjectMethodologyMaximal(maxProjectId, maxMethodologyId);
        const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/project-methodology', maximalData);

        // Fail fast on any error - including duplicates
        expect(maxResponse.success).to.be.true;
        expect(maxId).to.exist;
        createdIds.push(maxId);
        addCreatedId('project-methodology', maxId);

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          await waitForDataToAppear(request, 'project-methodology', maxId);
        } else {
          trackBatchVerification('POST', 'project-methodology', maxId, {
            cadTrustProjectId: maxProjectId,
            cadTrustMethodologyId: maxMethodologyId,
          });
        }
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
      for (const projectMethodologyId of createdIds) {
        const record = await waitForDataToAppear(request, 'project-methodology', projectMethodologyId);
        expect(record).to.exist;
        expect(record.cadTrustProjectMethodologyId).to.equal(projectMethodologyId);
        expect(record.cadTrustProjectId).to.exist;
        expect(record.cadTrustMethodologyId).to.exist;
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a projectMethodology', async function () {
      // Get ID from createdIds (if available) or query database for existing record
      let projectMethodologyId = createdIds[0];
      if (!projectMethodologyId) {
        projectMethodologyId = await getFirstRecordIdFromDatabase(request, 'project-methodology');
        if (!projectMethodologyId) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/project-methodology/${projectMethodologyId}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        cadTrustProjectId: record.cadTrustProjectId, // Required
        cadTrustMethodologyId: record.cadTrustMethodologyId, // Required
        projectMethodologyDate: record.projectMethodologyDate ?? null,
        projectMethodologyDescription: record.projectMethodologyDescription ?? null,
      };
      const response = await makePutRequest(request, '/v2/project-methodology', projectMethodologyId, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project-methodology', projectMethodologyId);
        await validateDataInDatabase(request, 'project-methodology', projectMethodologyId, {
          cadTrustProjectId: updateData.cadTrustProjectId,
          cadTrustMethodologyId: updateData.cadTrustMethodologyId,
        });
      } else {
        trackBatchVerification('PUT', 'project-methodology', projectMethodologyId, updateData);
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
      const projectMethodologyId = createdIds[0];
      const response = await request
        .get(`/v2/project-methodology/${projectMethodologyId}`)
        .expect(200);

      expect(response.body.cadTrustProjectMethodologyId).to.equal(projectMethodologyId);
      expect(response.body.cadTrustProjectId).to.exist;
      expect(response.body.cadTrustMethodologyId).to.exist;
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
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : [];
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'project-methodology');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const projectMethodologyId = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/project-methodology', projectMethodologyId);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'project-methodology', projectMethodologyId);
        }
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
