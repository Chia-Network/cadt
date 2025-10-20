import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import newProgram from '../test-data/new-program.js';
import newProject from '../test-data/new-project.js';
import newUnit from '../test-data/new-unit.js';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  cleanupV2TestData,
  getV2TestTimeout,
  waitForV2DataLayerSync,
} from '../test-fixtures';
import {
  createV2StagingRecord,
  validateV2StagingRecord,
  validateV2StagingData,
  commitV2StagingRecord,
  failV2StagingRecord,
  retryV2StagingRecord,
  getV2StagingByType,
  cleanupV2StagingTable,
} from '../test-fixtures/v2-staging-fixtures';
import {
  createV2TestProject,
  validateV2ProjectStructure,
  validateV2ProjectRelationships,
} from '../test-fixtures/v2-project-fixtures';

describe('V2 Integration Tests', function () {
  let homeOrgUid;

  before(async function () {
    homeOrgUid = await createV2TestHomeOrg();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('End-to-End Project Workflow', function () {
    it('creates, updates, and deletes a project end-to-end', async function () {
      // Step 1: Create a program
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send(newProgram);

      expect(programResponse.status).to.equal(200);
      const programId = programResponse.body.uuid;

      // Step 2: Create a project referencing the program
      const projectData = {
        ...newProject,
        cadTrustProgramId: programId,
      };

      const projectResponse = await supertest(app)
        .post('/v2/project')
        .send(projectData);

      expect(projectResponse.status).to.equal(200);
      const projectId = projectResponse.body.uuid;

      // Step 3: Verify project was staged
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);
      expect(stagingResponse.body).to.be.an('array');
      expect(stagingResponse.body.length).to.be.greaterThan(0);

      const projectStaging = stagingResponse.body.find(s => s.table === 'project');
      expect(projectStaging).to.be.ok;
      expect(projectStaging.action).to.equal('INSERT');

      // Step 4: Update the project
      const updateData = {
        projectName: 'Updated V2 Project Name',
        projectDescription: 'Updated project description',
      };

      const updateResponse = await supertest(app)
        .put(`/v2/project/${projectId}`)
        .send(updateData);

      expect(updateResponse.status).to.equal(200);

      // Step 5: Verify update was staged
      const updatedStagingResponse = await supertest(app).get('/v2/staging');
      expect(updatedStagingResponse.status).to.equal(200);

      const updateStaging = updatedStagingResponse.body.find(s =>
        s.table === 'project' && s.action === 'UPDATE'
      );
      expect(updateStaging).to.be.ok;

      // Step 6: Delete the project
      const deleteResponse = await supertest(app).delete(`/v2/project/${projectId}`);
      expect(deleteResponse.status).to.equal(200);

      // Step 7: Verify delete was staged
      const deleteStagingResponse = await supertest(app).get('/v2/staging');
      expect(deleteStagingResponse.status).to.equal(200);

      const deleteStaging = deleteStagingResponse.body.find(s =>
        s.table === 'project' && s.action === 'DELETE'
      );
      expect(deleteStaging).to.be.ok;
    }).timeout(getV2TestTimeout() * 3);
  });

  describe('Staging Workflow Integration', function () {
    it('handles complete staging workflow with commit and retry', async function () {
      // Step 1: Create multiple staging records
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      const programId = programResponse.body.uuid;

      const projectResponse = await supertest(app)
        .post('/v2/project')
        .send({
          ...newProject,
          cadTrustProgramId: programId,
        });
      const projectId = projectResponse.body.uuid;

      // Step 2: Verify staging records exist
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);
      expect(stagingResponse.body.length).to.equal(2);

      // Step 3: Check for pending commits
      const pendingResponse = await supertest(app).get('/v2/staging/offer');
      expect(pendingResponse.status).to.equal(200);
      expect(pendingResponse.body.message).to.include('pending commits');

      // Step 4: Commit staging records
      const commitData = {
        comment: 'Test commit for integration',
        author: 'integration-test',
        ids: [],
      };

      const commitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send(commitData);

      expect(commitResponse.status).to.equal(200);

      // Step 5: Verify records are committed
      const committedStagingResponse = await supertest(app)
        .get('/v2/staging')
        .query({ type: 'pending' });

      expect(committedStagingResponse.status).to.equal(200);
      expect(committedStagingResponse.body.length).to.equal(2);

      // Step 6: Simulate failed commit and retry
      const stagingRecords = await supertest(app).get('/v2/staging');
      const firstRecord = stagingRecords.body[0];

      // Mark as failed
      await failV2StagingRecord(firstRecord.uuid);

      // Verify failed status
      const failedStagingResponse = await supertest(app)
        .get('/v2/staging')
        .query({ type: 'failed' });

      expect(failedStagingResponse.status).to.equal(200);
      expect(failedStagingResponse.body.length).to.equal(1);

      // Retry the failed record
      const retryData = {
        uuid: firstRecord.uuid,
      };

      const retryResponse = await supertest(app)
        .put('/v2/staging/retry')
        .send(retryData);

      expect(retryResponse.status).to.equal(200);

      // Verify retry worked
      const retriedStagingResponse = await supertest(app)
        .get('/v2/staging')
        .query({ type: 'staged' });

      expect(retriedStagingResponse.status).to.equal(200);
      expect(retriedStagingResponse.body.length).to.equal(1);
    }).timeout(getV2TestTimeout() * 4);
  });

  describe('Cross-Resource Relationships', function () {
    it('maintains referential integrity across related resources', async function () {
      // Step 1: Create program
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      const programId = programResponse.body.uuid;

      // Step 2: Create project referencing program
      const projectResponse = await supertest(app)
        .post('/v2/project')
        .send({
          ...newProject,
          cadTrustProgramId: programId,
        });
      const projectId = projectResponse.body.uuid;

      // Step 3: Create issuance referencing project
      const issuanceResponse = await supertest(app)
        .post('/v2/issuance')
        .send({
          ...require('../test-data/new-issuance.js').default,
          cadTrustProjectId: projectId,
        });
      const issuanceId = issuanceResponse.body.uuid;

      // Step 4: Create unit referencing issuance
      const unitResponse = await supertest(app)
        .post('/v2/unit')
        .send({
          ...newUnit,
          cadTrustIssuanceId: issuanceId,
        });
      const unitId = unitResponse.body.uuid;

      // Step 5: Verify all resources exist and are properly linked
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);
      expect(stagingResponse.body.length).to.equal(4);

      // Verify each resource type exists
      const programStaging = stagingResponse.body.find(s => s.table === 'program');
      const projectStaging = stagingResponse.body.find(s => s.table === 'project');
      const issuanceStaging = stagingResponse.body.find(s => s.table === 'issuance');
      const unitStaging = stagingResponse.body.find(s => s.table === 'unit');

      expect(programStaging).to.be.ok;
      expect(projectStaging).to.be.ok;
      expect(issuanceStaging).to.be.ok;
      expect(unitStaging).to.be.ok;

      // Verify foreign key relationships in staging data
      const projectData = JSON.parse(projectStaging.data)[0];
      const issuanceData = JSON.parse(issuanceStaging.data)[0];
      const unitData = JSON.parse(unitStaging.data)[0];

      expect(projectData.cadTrustProgramId).to.equal(programId);
      expect(issuanceData.cadTrustProjectId).to.equal(projectId);
      expect(unitData.cadTrustIssuanceId).to.equal(issuanceId);
    }).timeout(getV2TestTimeout() * 3);
  });

  describe('Error Handling Integration', function () {
    it('handles cascading errors gracefully', async function () {
      // Step 1: Try to create project without required program
      const invalidProjectResponse = await supertest(app)
        .post('/v2/project')
        .send({
          ...newProject,
          cadTrustProgramId: 999999, // Non-existent program ID
        });

      // Should either succeed (if FK validation is deferred) or fail gracefully
      expect([200, 400, 404]).to.include(invalidProjectResponse.status);

      // Step 2: Try to create unit without required issuance
      const invalidUnitResponse = await supertest(app)
        .post('/v2/unit')
        .send({
          ...newUnit,
          cadTrustIssuanceId: 999999, // Non-existent issuance ID
        });

      // Should either succeed (if FK validation is deferred) or fail gracefully
      expect([200, 400, 404]).to.include(invalidUnitResponse.status);

      // Step 3: Verify staging table is in consistent state
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);
      expect(stagingResponse.body).to.be.an('array');
    }).timeout(getV2TestTimeout() * 2);
  });

  describe('Performance Integration', function () {
    it('handles bulk operations efficiently', async function () {
      const startTime = Date.now();

      // Step 1: Create program
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      const programId = programResponse.body.uuid;

      // Step 2: Create multiple projects in parallel
      const projectPromises = Array.from({ length: 20 }, (_, i) =>
        supertest(app).post('/v2/project').send({
          ...newProject,
          projectId: `V2-PROJ-${i.toString().padStart(3, '0')}`,
          projectName: `V2 Project ${i}`,
          cadTrustProgramId: programId,
        })
      );

      await Promise.all(projectPromises);

      // Step 3: Verify all projects were staged
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);
      expect(stagingResponse.body.length).to.equal(21); // 1 program + 20 projects

      // Step 4: Test pagination with large dataset
      const paginatedResponse = await supertest(app)
        .get('/v2/staging')
        .query({ page: 1, limit: 10 });

      expect(paginatedResponse.status).to.equal(200);
      expect(paginatedResponse.body.data.length).to.equal(10);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).to.be.lessThan(30000); // Should complete within 30 seconds
    }).timeout(getV2TestTimeout() * 6);
  });

  describe('Data Consistency Integration', function () {
    it('maintains data consistency across operations', async function () {
      // Step 1: Create initial resources
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      const programId = programResponse.body.uuid;

      const projectResponse = await supertest(app)
        .post('/v2/project')
        .send({
          ...newProject,
          cadTrustProgramId: programId,
        });
      const projectId = projectResponse.body.uuid;

      // Step 2: Update project
      const updateResponse = await supertest(app)
        .put(`/v2/project/${projectId}`)
        .send({
          projectName: 'Updated Project Name',
        });
      expect(updateResponse.status).to.equal(200);

      // Step 3: Verify staging consistency
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);

      const projectStaging = stagingResponse.body.filter(s => s.table === 'project');
      expect(projectStaging.length).to.equal(2); // INSERT + UPDATE

      // Step 4: Verify diff objects are consistent
      projectStaging.forEach(staging => {
        expect(staging).to.have.property('diff');
        expect(staging.diff).to.be.an('object');
        expect(staging.diff).to.have.property('original');
        expect(staging.diff).to.have.property('change');
      });

      // Step 5: Clean staging and verify consistency
      const cleanResponse = await supertest(app).delete('/v2/staging/clean');
      expect(cleanResponse.status).to.equal(200);

      const emptyStagingResponse = await supertest(app).get('/v2/staging');
      expect(emptyStagingResponse.status).to.equal(200);
      expect(emptyStagingResponse.body.length).to.equal(0);
    }).timeout(getV2TestTimeout() * 3);
  });

  describe('Concurrent Operations Integration', function () {
    it('handles concurrent operations safely', async function () {
      // Step 1: Create program
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      const programId = programResponse.body.uuid;

      // Step 2: Perform concurrent operations
      const concurrentPromises = [
        // Create multiple projects concurrently
        supertest(app).post('/v2/project').send({
          ...newProject,
          projectId: 'V2-PROJ-CONCURRENT-1',
          projectName: 'Concurrent Project 1',
          cadTrustProgramId: programId,
        }),
        supertest(app).post('/v2/project').send({
          ...newProject,
          projectId: 'V2-PROJ-CONCURRENT-2',
          projectName: 'Concurrent Project 2',
          cadTrustProgramId: programId,
        }),
        supertest(app).post('/v2/project').send({
          ...newProject,
          projectId: 'V2-PROJ-CONCURRENT-3',
          projectName: 'Concurrent Project 3',
          cadTrustProgramId: programId,
        }),
        // Update program concurrently
        supertest(app).put(`/v2/program/${programId}`).send({
          programName: 'Updated Program Name',
        }),
      ];

      const results = await Promise.all(concurrentPromises);

      // Step 3: Verify all operations succeeded
      results.forEach(result => {
        expect(result.status).to.equal(200);
      });

      // Step 4: Verify staging consistency
      const stagingResponse = await supertest(app).get('/v2/staging');
      expect(stagingResponse.status).to.equal(200);
      expect(stagingResponse.body.length).to.equal(5); // 1 program + 3 projects + 1 program update

      // Step 5: Verify no duplicate records
      const projectStaging = stagingResponse.body.filter(s => s.table === 'project');
      const projectIds = projectStaging.map(s => {
        const data = JSON.parse(s.data)[0];
        return data.projectId;
      });

      const uniqueProjectIds = [...new Set(projectIds)];
      expect(uniqueProjectIds.length).to.equal(projectIds.length); // No duplicates
    }).timeout(getV2TestTimeout() * 4);
  });
});
