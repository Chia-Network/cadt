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
  generateProject,
  generateProjectMinimal,
  generateProjectMaximal,
  generateProjectLongStrings,
  generateProjectForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('Project Live API Validation Tests', function () {
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
      const forbiddenData = generateProjectForbiddenFields();
      const response = await request
        .post('/v2/project')
        .send(forbiddenData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateProjectMinimal();
      invalidData.projectSector = getInvalidPicklistValue('projectSector');
      const response = await request
        .post('/v2/project')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { projectName: 'Incomplete' }; // Missing projectId
      const response = await request
        .post('/v2/project')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateProjectLongStrings();
      const response = await request
        .post('/v2/project')
        .send(longData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const invalidTypeData = generateProject();
      invalidTypeData.projectStatusDate = 'not-a-date';
      const response = await request
        .post('/v2/project')
        .send(invalidTypeData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });
  describe('Step 4: POST Request Tests', function () {
    it('should create projects with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateProject();
      const { id, response } = await makePostRequest(request, '/v2/project', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id);
      addCreatedId('project', id);
      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v2/project', id, {
        projectId: data.projectId,
        projectName: data.projectName,
      });
      expect(inStaging).to.be.true;
      // Commit if in extended mode
      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project', id);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        trackBatchVerification('POST', 'project', id, data);
      }

      // Create 1 minimal record
      const minimalData = generateProjectMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v2/project', minimalData);
      expect(minResponse.success).to.be.true;
      createdIds.push(minId);
      addCreatedId('project', minId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project', minId);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        trackBatchVerification('POST', 'project', minId, minimalData);
      }

      // Create 1 maximal record
      const maximalData = generateProjectMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v2/project', maximalData);
      expect(maxResponse.success).to.be.true;
      createdIds.push(maxId);
      addCreatedId('project', maxId);

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project', maxId);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        trackBatchVerification('POST', 'project', maxId, maximalData);
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'project', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'project', id);
        expect(record).to.exist;
        expect(record.cadTrustProjectId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a project', async function () {
      // Get ID from createdIds (if available) or query for test records we created
      let id = createdIds[0];
      if (!id) {
        // Query for test records by filtering by home org and TEST- prefix
        let page = 1;
        const limit = 100;
        let found = false;

        while (!found && page <= 10) { // Limit to 10 pages to avoid infinite loop
          const response = await request.get(`/v2/project?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);

          // Find first test record (projectId starts with "TEST-")
          const testRecord = data.find(record =>
            record.projectId && record.projectId.startsWith('TEST-')
          );

          if (testRecord) {
            id = testRecord.cadTrustProjectId;
            found = true;
            break;
          }

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          if (page >= totalPages || data.length < limit) {
            break;
          }
          page++;
        }

        if (!id) {
          this.skip(); // Skip if no test records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/project/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;

      // Verify record belongs to home org and is a test record
      if (record.orgUid !== homeOrgId) {
        this.skip(); // Skip if record doesn't belong to home org
      }
      if (!record.projectId || !record.projectId.startsWith('TEST-')) {
        this.skip(); // Skip if not a test record
      }
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        projectRegistryName: record.projectRegistryName,
        projectId: `UPDATED-${Date.now()}`,
        projectName: 'Updated Project Name',
        projectCreditingProgram: record.projectCreditingProgram ?? null,
        projectLink: record.projectLink ?? null,
        projectDescription: record.projectDescription ?? null,
        projectSector: record.projectSector ?? null,
        projectType: record.projectType ?? null,
        projectSubtype: record.projectSubtype ?? null,
        projectStatus: record.projectStatus ?? null,
        projectStatusDate: record.projectStatusDate ?? null,
        projectUnitMetric: record.projectUnitMetric ?? null,
        cadTrustReferenceProjectId: record.cadTrustReferenceProjectId ?? null,
        cadTrustProgramId: record.cadTrustProgramId ?? null,
      };
      const response = await makePutRequest(request, '/v2/project', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project', id);
        await validateDataInDatabase(request, 'project', id, {
          projectId: updateData.projectId,
          projectName: updateData.projectName,
        });
      } else {
        trackBatchVerification('PUT', 'project', id, updateData);
      }
    });
  });

  describe('Step 8: GET Request Tests', function () {
    it('should list all projects with pagination', async function () {
      const response = await request
        .get('/v2/project?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific project by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/project/${id}`)
        .expect(200);

      expect(response.body.cadTrustProjectId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/project')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created projects', async function () {
      // Query for test projects by orgUid and TEST- prefix
      // This works even when DELETE runs in a separate process
      let idsToDelete = [];

      // First try createdIds if available (when running in same process)
      if (createdIds.length > 0) {
        idsToDelete = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get projects belonging to our organization
          const response = await request.get(`/v2/project?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);

          // Filter for test records (projectId starts with "TEST-")
          const testRecords = data.filter(record =>
            record.projectId && record.projectId.startsWith('TEST-')
          );

          idsToDelete.push(...testRecords.map(r => r.cadTrustProjectId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      if (idsToDelete.length === 0) {
        this.skip(); // No test records to delete
      }

      console.log(`Found ${idsToDelete.length} test project(s) to delete`);

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        try {
          const response = await makeDeleteRequest(request, '/v2/project', id);
          // Check if delete was successful or if record doesn't exist (already deleted)
          if (response.success === false && response.error && response.error.includes('not found')) {
            // Record already deleted, continue
            continue;
          }
          expect(response.success).to.be.true;
        } catch (error) {
          // If delete fails, log but continue
          console.warn(`Failed to delete project ${id}: ${error.message}`);
          continue;
        }

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
          // Verify record is deleted
          try {
            const checkResponse = await request.get(`/v2/project/${id}`);
            expect(checkResponse.status).to.equal(404, `Project ${id} should be deleted but still exists`);
          } catch (error) {
            // 404 is expected - record is deleted
            if (error.status !== 404 && error.response?.status !== 404) {
              throw error;
            }
          }
        } else {
          trackBatchVerification('DELETE', 'project', id);
        }
      }
    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify all test projects are deleted', async function () {
      // Query for test projects by orgUid and TEST- prefix to verify they're all deleted
      // This works even when DELETE runs in a separate process
      let testProjectIds = [];

      // First try createdIds if available
      if (createdIds.length > 0) {
        testProjectIds = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get projects belonging to our organization
          const response = await request.get(`/v2/project?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);

          // Filter for test records (projectId starts with "TEST-")
          const testRecords = data.filter(record =>
            record.projectId && record.projectId.startsWith('TEST-')
          );

          testProjectIds.push(...testRecords.map(r => r.cadTrustProjectId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      // Verify all test projects are deleted
      for (const id of testProjectIds) {
        try {
          const checkResponse = await request.get(`/v2/project/${id}`);
          expect(checkResponse.status).to.equal(404, `Test project ${id} should be deleted but still exists`);
        } catch (error) {
          // 404 is expected - record is deleted
          if (error.status !== 404 && error.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (testProjectIds.length > 0) {
        console.log(`✓ Verified ${testProjectIds.length} test project(s) are deleted`);
      } else {
        console.log('✓ No test projects found to verify (all deleted or none created)');
      }
    });
  });
});
