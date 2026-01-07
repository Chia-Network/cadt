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
  const createdIds = []; // Track all created IDs (warehouseProjectId)

  before(async function () {
    request = getSharedRequest();
    homeOrgId = getSharedHomeOrgId();
  });

  describe('Step 3: Validation Failure Tests', function () {
    it('should reject POST with forbidden fields (createdAt, updatedAt, warehouseProjectId)', async function () {
      const forbiddenData = generateProjectForbiddenFields();
      const response = await request
        .post('/v1/projects')
        .send(forbiddenData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      const invalidData = generateProjectMinimal();
      invalidData.sector = getInvalidPicklistValue('sector');
      const response = await request
        .post('/v1/projects')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { projectName: 'Incomplete' }; // Missing projectId and other required fields
      const response = await request
        .post('/v1/projects')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateProjectLongStrings();
      const response = await request
        .post('/v1/projects')
        .send(longData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const invalidTypeData = generateProject();
      invalidTypeData.projectStatusDate = 'not-a-date';
      const response = await request
        .post('/v1/projects')
        .send(invalidTypeData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    after(async function () {
      await clearStagingTable(request);
    });
  });

  describe('Step 4: POST Request Tests', function () {
    it('should create projects with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateProject();
      const { id, response } = await makePostRequest(request, '/v1/projects', data);
      expect(response.success).to.be.true;
      expect(id).to.exist;
      createdIds.push(id); // id is warehouseProjectId (same as uuid in V1)
      addCreatedId('project', id);

      // Check record is in staging table
      const inStaging = await checkRecordInStaging(request, '/v1/projects', id, {
        projectId: data.projectId,
        projectName: data.projectName,
      });
      expect(inStaging).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'project', id);
      } else {
        // Track ALL fields from the request data for comprehensive verification
        // Exclude nested child records (labels, issuances, etc.) as they're stored separately
        const { labels, issuances, coBenefits, projectLocations, projectRatings, estimations, relatedProjects, ...fieldsToVerify } = data;
        trackBatchVerification('POST', 'project', id, fieldsToVerify);
      }

      // Create 1 minimal record
      const minimalData = generateProjectMinimal();
      const { id: minId, response: minResponse } = await makePostRequest(request, '/v1/projects', minimalData);
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
        // Exclude nested child records (labels, issuances, etc.) as they're stored separately
        const { labels, issuances, coBenefits, projectLocations, projectRatings, estimations, relatedProjects, ...fieldsToVerify } = minimalData;
        trackBatchVerification('POST', 'project', minId, fieldsToVerify);
      }

      // Create 1 maximal record (with nested child records)
      const maximalData = generateProjectMaximal();
      const { id: maxId, response: maxResponse } = await makePostRequest(request, '/v1/projects', maximalData);
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
        // Exclude nested child records (labels, issuances, etc.) as they're stored separately
        const { labels, issuances, coBenefits, projectLocations, projectRatings, estimations, relatedProjects, ...fieldsToVerify } = maximalData;
        trackBatchVerification('POST', 'project', maxId, fieldsToVerify);
      }
    });
  });

  describe('Step 5: Staging Commit (if short mode)', function () {
    it('should commit all staged records in batch', async function () {
      if (!shouldAutoCommit()) {
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
        expect(record.warehouseProjectId).to.equal(id);
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
          const response = await request.get(`/v1/projects?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = response.body?.data || [];

          // Find first test record (projectId starts with "TEST-")
          const testRecord = data.find(record =>
            record.projectId && record.projectId.startsWith('TEST-')
          );

          if (testRecord) {
            id = testRecord.warehouseProjectId;
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

      // Get current record to include all fields (V1 PUT requires ALL fields)
      const currentResponse = await request.get(`/v1/projects?warehouseProjectId=${id}`).expect(200);
      const currentData = currentResponse.body?.data || currentResponse.body;
      const record = Array.isArray(currentData) ? currentData[0] : currentData;

      if (!record) {
        this.skip(); // Skip if record not found
      }

      // Verify record belongs to home org and is a test record
      if (record.orgUid !== homeOrgId) {
        this.skip(); // Skip if record doesn't belong to home org
      }
      if (!record.projectId || !record.projectId.startsWith('TEST-')) {
        this.skip(); // Skip if not a test record
      }

      // Create update data with ALL fields (V1 requirement)
      const updateData = {
        warehouseProjectId: id,
        projectId: `UPDATED-${Date.now()}`,
        originProjectId: record.originProjectId || 'UPDATED-ORIG',
        registryOfOrigin: record.registryOfOrigin || 'Verra',
        projectName: 'Updated Project Name',
        projectLink: record.projectLink || 'http://testurl.com',
        projectDeveloper: record.projectDeveloper || 'Updated Developer',
        sector: record.sector || 'Agriculture Forestry and Other Land Use (AFOLU)',
        projectType: record.projectType || 'Afforestation',
        coveredByNDC: record.coveredByNDC || 'Inside NDC',
        projectStatus: record.projectStatus || 'Registered',
        projectStatusDate: record.projectStatusDate || new Date().toISOString().split('T')[0],
        unitMetric: record.unitMetric || 'tCO2e',
        methodology: record.methodology || 'ACR - Truck Stop Electrification',
        program: record.program || null,
        projectTags: record.projectTags || null,
        ndcInformation: record.ndcInformation || null,
        validationBody: record.validationBody || null,
        validationDate: record.validationDate || null,
      };

      const response = await makePutRequest(request, '/v1/projects', id, updateData);
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

  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created projects', async function () {
      // Query for all test projects (those with projectId starting with "TEST-")
      // This works even when DELETE runs in a separate process
      let idsToDelete = [];

      // First try to use createdIds if available (when running in same process)
      if (createdIds.length > 0) {
        idsToDelete = createdIds.filter(id => id != null);
      } else {
        // Query database for test records by filtering by home org, then filtering for TEST- prefix
        // Using orgUid filter is much faster than paginating through all projects
        let page = 1;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          // Filter by home org to only get projects belonging to our organization
          const response = await request.get(`/v1/projects?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = response.body?.data || [];

          // Filter for test records (projectId starts with "TEST-")
          const testRecords = data.filter(record =>
            record.projectId && record.projectId.startsWith('TEST-')
          );

          idsToDelete.push(...testRecords.map(r => r.warehouseProjectId));

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
          const response = await makeDeleteRequest(request, '/v1/projects', id);
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
            const checkResponse = await request.get(`/v1/projects?warehouseProjectId=${id}`);
            const checkData = checkResponse.body?.data || [];
            expect(checkData.length).to.equal(0, `Project ${id} should be deleted but still exists`);
          } catch (error) {
            // 404 or empty is expected - record is deleted
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
          const response = await request.get(`/v1/projects?page=${page}&limit=${limit}&orgUid=${homeOrgId}`).expect(200);
          const data = response.body?.data || [];

          // Filter for test records (projectId starts with "TEST-")
          const testRecords = data.filter(record =>
            record.projectId && record.projectId.startsWith('TEST-')
          );

          testProjectIds.push(...testRecords.map(r => r.warehouseProjectId));

          // Check if there are more pages
          const totalPages = response.body?.pageCount || 1;
          hasMore = page < totalPages && data.length === limit;
          page++;
        }
      }

      // Verify all test projects are deleted
      for (const id of testProjectIds) {
        try {
          const checkResponse = await request.get(`/v1/projects?warehouseProjectId=${id}`);
          const checkData = checkResponse.body?.data || [];
          expect(checkData.length).to.equal(0, `Test project ${id} should be deleted but still exists`);
        } catch (error) {
          // 404 or empty is expected - record is deleted
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
