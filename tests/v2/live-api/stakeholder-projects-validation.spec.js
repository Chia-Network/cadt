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
  generateStakeholderProjects,
  generateStakeholderProjectsInvalidForeignKey,
  generateStakeholderProjectsForbiddenFields,
} from './data/test-data-generators.js';

describe('StakeholderProjects Live API Validation Tests', function () {
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
      const stakeholderId = getFirstCreatedId('stakeholder');
      const projectId = getFirstCreatedId('project');
      if (!stakeholderId || !projectId) {
        this.skip(); // Skip if prerequisites not available
      }
      const forbiddenData = generateStakeholderProjectsForbiddenFields(stakeholderId, projectId);
      const response = await request
        .post('/v2/stakeholder-projects')
        .send(forbiddenData);
      expect(response.status).to.not.equal(200);
    });
    it('should reject POST with invalid foreign keys', async function () {
      const invalidData = generateStakeholderProjectsInvalidForeignKey();
      const response = await request
        .post('/v2/stakeholder-projects')
        .send(invalidData);

      expect(response.status).to.not.equal(200);
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { cadTrustStakeholderId: 'test-id' }; // Missing cadTrustProjectId
      const response = await request
        .post('/v2/stakeholder-projects')
        .send(incompleteData);

      expect(response.status).to.not.equal(200);
    });

    after(async function () {
      // Batch clear staging table after all validation tests
      await clearStagingTable(request);
    });
  });
  describe('Step 4: POST Request Tests', function () {
    it('should create stakeholderProjects relationships', async function () {
      // Get stakeholder and project IDs from earlier tests
      const stakeholderIds = getCreatedIds('stakeholder');
      const projectIds = getCreatedIds('project');
      if (stakeholderIds.length === 0 || projectIds.length === 0) {
        throw new Error('Stakeholder or Project IDs not found. Ensure stakeholder-validation.spec.js and project-validation.spec.js run before stakeholder-projects-validation.spec.js');
      }

      // Create up to 10 stakeholder-project relationships
      // Use unique combinations to avoid duplicate composite keys (unique constraint on stakeholder+project)
      const usedCombinations = new Set();
      let created = 0;
      const maxRecords = Math.min(10, stakeholderIds.length * projectIds.length);

      for (let stakeIdx = 0; stakeIdx < stakeholderIds.length && created < maxRecords; stakeIdx++) {
        for (let projIdx = 0; projIdx < projectIds.length && created < maxRecords; projIdx++) {
          const stakeholderId = stakeholderIds[stakeIdx];
          const projectId = projectIds[projIdx];
          const combinationKey = `${stakeholderId}-${projectId}`;

          // Skip if we've already used this combination
          if (usedCombinations.has(combinationKey)) {
            continue;
          }

          usedCombinations.add(combinationKey);
          const data = generateStakeholderProjects(stakeholderId, projectId);
          const { id, response } = await makePostRequest(request, '/v2/stakeholder-projects', data);
          expect(response.success).to.be.true;
          expect(id).to.exist;
          // Stakeholder-projects has unique constraint on stakeholder+project combination
          createdIds.push(id);
          addCreatedId('stakeholder-projects', id);
          // Check record is in staging table
          const inStaging = await checkRecordInStaging(request, '/v2/stakeholder-projects', id, {
            cadTrustStakeholderId: data.cadTrustStakeholderId,
            cadTrustProjectId: data.cadTrustProjectId,
          });
          expect(inStaging).to.be.true;
          // Commit if in extended mode
          if (shouldAutoCommit()) {
            await commitStagedRecords(request, []);
            await waitForPendingCommits(request);
            await waitForStagingEmpty(request);
            await waitForDataToAppear(request, 'stakeholder-projects', id);
          } else {
            trackBatchVerification('POST', 'stakeholder-projects', id, {
              cadTrustStakeholderId: data.cadTrustStakeholderId,
              cadTrustProjectId: data.cadTrustProjectId,
            });
          }
          created++;
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
        const recordsToWaitFor = createdIds.map(id => ({ type: 'stakeholder-projects', id }));
        await waitForBatchToAppear(request, recordsToWaitFor);
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      for (const id of createdIds) {
        const record = await waitForDataToAppear(request, 'stakeholder-projects', id);
        expect(record).to.exist;
        expect(record.cadTrustStakeholderProjectsId).to.equal(id);
      }
    });
  });
  describe('Step 7: PUT Request Tests', function () {
    it('should update a stakeholderProjects relationship', async function () {
      const id = createdIds[0];
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/stakeholder-projects/${id}`).expect(200);
      // Create update data with ALL fields (must include both IDs)
      const updateData = {
        cadTrustStakeholderId: currentRecord.body.cadTrustStakeholderId,
        cadTrustProjectId: currentRecord.body.cadTrustProjectId,
      };
      const response = await makePutRequest(request, '/v2/stakeholder-projects', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'stakeholder-projects', id);
        await validateDataInDatabase(request, 'stakeholder-projects', id, {
          cadTrustStakeholderId: updateData.cadTrustStakeholderId,
          cadTrustProjectId: updateData.cadTrustProjectId,
        });
      } else {
        trackBatchVerification('PUT', 'stakeholder-projects', id, updateData);
      }
    });
  });
  describe('Step 8: GET Request Tests', function () {
    it('should list all stakeholder-projects with pagination', async function () {
      const response = await request
        .get('/v2/stakeholder-projects?page=1&limit=5')
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('page');
      expect(response.body).to.have.property('pageCount');
    });

    it('should get a specific stakeholder-projects by ID', async function () {
      const id = createdIds[0];
      const response = await request
        .get(`/v2/stakeholder-projects/${id}`)
        .expect(200);

      expect(response.body.cadTrustStakeholderProjectsId).to.equal(id);
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/stakeholder-projects')
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete all created stakeholder-projects', async function () {
      // Delete in reverse order
      for (let i = createdIds.length - 1; i >= 0; i--) {
        const id = createdIds[i];
        const response = await makeDeleteRequest(request, '/v2/stakeholder-projects', id);
        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'stakeholder-projects', id);
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
    it('should verify all stakeholder-projects are deleted', async function () {
      const response = await request.get('/v2/stakeholder-projects').expect(200);
      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      // Should only have stakeholder-projects that existed before tests
      expect(data.length).to.equal(0);
    });
  });
});
