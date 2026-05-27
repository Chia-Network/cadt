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
import { addCreatedId, getCreatedIds, shouldAutoCommit, trackBatchVerification, getFirstRecordIdFromDatabase, getAllRecordIdsFromDatabase } from './helpers/shared-state.js';
import {
  generateProgram,
  generateProgramMinimal,
  generateProgramMaximal,
  generateProgramLongStrings,
  generateProgramForbiddenFields,
} from './data/test-data-generators.js';

const REFERENCE_ERROR_CODE = 'Referenced records must be removed before deletion';
const deleteTargetProgramIds = new Set();

const getProjectId = (project) => project.cadTrustProjectId || project.cad_trust_project_id;
const getProgramId = (project) => project.cadTrustProgramId || project.cad_trust_program_id;

const getProjectStagingReferences = async (request) => {
  const pendingDeleteProjectIds = new Set();
  const stagedReferencedProgramIds = new Set();
  const response = await request
    .get('/v2/staging')
    .query({ page: 1, limit: 1000, table: 'project', type: 'staged' })
    .expect(200);
  const rows = response.body?.data || response.body || [];

  for (const row of rows) {
    const records = row.diff?.change || [];
    for (const record of records) {
      const projectId = getProjectId(record);
      const programId = getProgramId(record);
      if (row.action === 'DELETE' && projectId) {
        pendingDeleteProjectIds.add(projectId);
      } else if (['INSERT', 'UPDATE'].includes(row.action) && programId) {
        stagedReferencedProgramIds.add(programId);
      }
    }
  }

  return { pendingDeleteProjectIds, stagedReferencedProgramIds };
};

const getReferencedProgramIds = async (request) => {
  const referencedProgramIds = new Set();
  const { pendingDeleteProjectIds, stagedReferencedProgramIds } = await getProjectStagingReferences(request);
  for (const programId of stagedReferencedProgramIds) {
    referencedProgramIds.add(programId);
  }

  let page = 1;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const response = await request.get('/v2/project').query({ page, limit }).expect(200);
    const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
    for (const project of data) {
      const projectId = getProjectId(project);
      const programId = getProgramId(project);
      if (programId && !pendingDeleteProjectIds.has(projectId)) {
        referencedProgramIds.add(programId);
      }
    }

    const totalPages = response.body?.pageCount || 1;
    hasMore = page < totalPages && data.length === limit;
    page++;
  }

  return referencedProgramIds;
};

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

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid picklist values', async function () {
      this.skip(); // Program model has no picklist fields
    });

    it('should reject POST with missing required fields', async function () {
      const incompleteData = { programName: 'Incomplete' }; // Missing programRegistry and programRegistryActivityId
      const response = await request
        .post('/v2/program')
        .send(incompleteData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with strings that are too long', async function () {
      const longData = generateProgramLongStrings();
      const response = await request
        .post('/v2/program')
        .send(longData);

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
    });

    it('should reject POST with invalid data types', async function () {
      const invalidTypeData = generateProgram();
      invalidTypeData.programProjectCount = 'not-a-number';
      const response = await request
        .post('/v2/program')
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
    it('should create programs with typical, minimal, and maximal data', async function () {
      // Create 1 typical record
      const data = generateProgram();
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
          programName: minimalData.programName,
          programRegistry: minimalData.programRegistry,
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
          programName: maximalData.programName,
          programRegistry: maximalData.programRegistry,
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
      // Get ID from createdIds (if available) or query database for existing record
      let id = createdIds[0];
      if (!id) {
        id = await getFirstRecordIdFromDatabase(request, 'program');
        if (!id) {
          this.skip(); // Skip if no records exist
        }
      }
      // Get current record to include all fields
      const currentRecord = await request.get(`/v2/program/${id}`).expect(200);
      const record = currentRecord.body.data || currentRecord.body;
      // Create update data with ALL fields
      // Required fields must always be included; optional fields can be null (matching V1 behavior)
      const updateData = {
        programName: 'Updated Program Name',
        programRegistry: record.programRegistry, // Required
        programRegistryActivityId: record.programRegistryActivityId, // Required
        programRegistryProgramId: record.programRegistryProgramId ?? null,
        programDescription: record.programDescription ?? null,
      };
      const response = await makePutRequest(request, '/v2/program', id, updateData);
      expect(response.success).to.be.true;

      if (shouldAutoCommit()) {
        await commitStagedRecords(request, []);
        await waitForPendingCommits(request);
        await waitForStagingEmpty(request);
        await waitForDataToAppear(request, 'program', id);
        await validateDataInDatabase(request, 'program', id, {
          programName: updateData.programName,
          programRegistry: updateData.programRegistry,
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
      expect(response.body).to.have.property('orgUid');
    });

    it('should filter programs by orgUid=me', async function () {
      const response = await request
        .get('/v2/program?orgUid=me&page=1&limit=10')
        .expect(200);

      const data = Array.isArray(response.body) ? response.body : (response.body?.data || []);
      for (const p of data) {
        expect(p).to.have.property('orgUid');
        expect(p.orgUid).to.equal(homeOrgId);
      }
    });

    it('should support search functionality', async function () {
      // Test search if supported by endpoint
      const response = await request
        .get('/v2/program')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).to.exist;
    });
  });
  describe('Step 9: DELETE Request Tests', function () {
    it('should delete unreferenced programs and preserve referenced programs', async function () {
      // Get IDs from createdIds (if available) or query database for existing records
      let idsToDelete = createdIds.length > 0 ? createdIds : getCreatedIds('program');
      if (idsToDelete.length === 0) {
        // Query database to get all existing records (for DELETE tests running in separate process)
        idsToDelete = await getAllRecordIdsFromDatabase(request, 'program');
      }

      if (idsToDelete.length === 0) {
        // No records to delete, skip test
        return;
      }
      idsToDelete.forEach((id) => deleteTargetProgramIds.add(id));
      const expectedReferencedProgramIds = await getReferencedProgramIds(request);

      // Delete in reverse order
      for (let i = idsToDelete.length - 1; i >= 0; i--) {
        const id = idsToDelete[i];
        const response = await makeDeleteRequest(request, '/v2/program', id);
        if (expectedReferencedProgramIds.has(id)) {
          expect(response.success).to.be.false;
          expect(response.error).to.equal(REFERENCE_ERROR_CODE);
          expect(response.references).to.be.an('array').that.is.not.empty;
          expect(response.references.some((ref) => ref.table === 'project' && ref.count > 0)).to.be.true;
          continue;
        }

        expect(response.success).to.be.true;

        if (shouldAutoCommit()) {
          await commitStagedRecords(request, []);
          await waitForPendingCommits(request);
          await waitForStagingEmpty(request);
        } else {
          trackBatchVerification('DELETE', 'program', id);
        }
      }

    });
  });

  describe('Step 10: Final Validation', function () {
    it('should verify remaining created programs are still referenced', async function () {
      let idsToCheck = createdIds.length > 0 ? createdIds : getCreatedIds('program');
      if (idsToCheck.length === 0) {
        idsToCheck = [...deleteTargetProgramIds];
      }
      const referencedProgramIds = await getReferencedProgramIds(request);

      for (const id of idsToCheck) {
        const response = await request.get(`/v2/program/${id}`);
        if (response.status === 404) {
          continue;
        }
        expect(response.status).to.equal(200);
        expect(
          referencedProgramIds.has(id),
          `Program ${id} remains without committed or delete-time project references`,
        ).to.be.true;
      }
    });
  });
});
