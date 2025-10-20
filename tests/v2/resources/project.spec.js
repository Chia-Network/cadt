import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import newProject from '../test-data/new-project.js';
import newProgram from '../test-data/new-program.js';
import newValidation from '../test-data/new-validation.js';
import newVerification from '../test-data/new-verification.js';
import newIssuance from '../test-data/new-issuance.js';
import newUnit from '../test-data/new-unit.js';
import newMethodology from '../test-data/new-methodology.js';
import newLocation from '../test-data/new-location.js';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  validateV2Pagination,
  validateV2RecordStructure,
  validateV2TimestampFields,
  validateV2PrimaryKey,
  cleanupV2TestData,
  getV2TestTimeout,
} from '../test-fixtures';
import {
  createV2TestProject,
  createV2TestProjectWithChildren,
  validateV2ProjectStructure,
  validateV2ProjectRelationships,
  validateV2ProjectPicklists,
  searchV2Projects,
  paginateV2Projects,
} from '../test-fixtures/v2-project-fixtures';

describe('V2 Project Resource CRUD', function () {
  let homeOrgUid;
  let programId;

  before(async function () {
    homeOrgUid = await createV2TestHomeOrg();

    // Create a program first for foreign key reference
    const programResponse = await supertest(app)
      .post('/v2/program')
      .send(newProgram);
    programId = programResponse.body.uuid;
  });

  beforeEach(async function () {
    await resetV2StagingTable();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('POST - Create Project', function () {
    it('creates a new project successfully', async function () {
      const projectData = {
        ...newProject,
        cadTrustProgramId: programId,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(projectData);

      validateV2SuccessResponse(response, 'Project staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body.uuid).to.be.a('string');
    }).timeout(getV2TestTimeout());

    it('rejects project creation with missing required fields', async function () {
      const invalidProject = {
        projectRegistryName: 'Test Registry',
        // Missing projectId, projectName, etc.
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidProject);

      validateV2ErrorResponse(response, 'Error creating new project');
    }).timeout(getV2TestTimeout());

    it('rejects project creation with timestamp fields', async function () {
      const projectWithTimestamps = {
        ...newProject,
        cadTrustProgramId: programId,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(projectWithTimestamps);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('validates picklist fields', async function () {
      const projectWithInvalidPicklist = {
        ...newProject,
        cadTrustProgramId: programId,
        projectSector: 'Invalid Sector',
        projectType: 'Invalid Type',
        projectStatus: 'Invalid Status',
        projectUnitMetric: 'Invalid Metric',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(projectWithInvalidPicklist);

      validateV2ErrorResponse(response, 'does not include a valid option');
    }).timeout(getV2TestTimeout());

    it('creates project with all optional fields', async function () {
      const fullProject = {
        ...newProject,
        cadTrustProgramId: programId,
        projectCreditingProgram: 'V2 Carbon Credits',
        projectDescription: 'A comprehensive V2 solar farm project',
        projectSubtype: 'Utility Scale',
        projectStatusDate: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(fullProject);

      validateV2SuccessResponse(response, 'Project staged successfully');
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find All Projects', function () {
    beforeEach(async function () {
      // Create test projects
      await supertest(app).post('/v2/project').send({
        ...newProject,
        cadTrustProgramId: programId,
      });

      await supertest(app).post('/v2/project').send({
        ...newProject,
        projectId: 'V2-PROJ-002',
        projectName: 'V2 Wind Farm Project',
        cadTrustProgramId: programId,
      });
    });

    it('retrieves all projects successfully', async function () {
      const response = await supertest(app).get('/v2/project');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    }).timeout(getV2TestTimeout());

    it('retrieves projects with pagination', async function () {
      const response = await supertest(app)
        .get('/v2/project')
        .query({ page: 1, limit: 1 });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.lessThanOrEqual(1);
    }).timeout(getV2TestTimeout());

    it('filters projects by search criteria', async function () {
      const response = await supertest(app)
        .get('/v2/project')
        .query({ search: 'Wind' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      const windProject = response.body.find(p => p.projectName.includes('Wind'));
      expect(windProject).to.be.ok;
    }).timeout(getV2TestTimeout());

    it('filters projects by organization', async function () {
      const response = await supertest(app)
        .get('/v2/project')
        .query({ orgUid: homeOrgUid });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      response.body.forEach(project => {
        expect(project.orgUid).to.equal(homeOrgUid);
      });
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find Project by ID', function () {
    let projectId;

    beforeEach(async function () {
      const response = await supertest(app).post('/v2/project').send({
        ...newProject,
        cadTrustProgramId: programId,
      });
      projectId = response.body.uuid;
    });

    it('retrieves a specific project by ID', async function () {
      const response = await supertest(app).get(`/v2/project/${projectId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('projectName', newProject.projectName);
      expect(response.body).to.have.property('projectRegistryName', newProject.projectRegistryName);
      expect(response.body).to.have.property('projectId', newProject.projectId);
    }).timeout(getV2TestTimeout());

    it('returns 404 for non-existent project ID', async function () {
      const response = await supertest(app).get('/v2/project/999999');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Project not found');
      expect(response.body).to.have.property('success', false);
    }).timeout(getV2TestTimeout());
  });

  describe('PUT - Update Project', function () {
    let projectId;

    beforeEach(async function () {
      const response = await supertest(app).post('/v2/project').send({
        ...newProject,
        cadTrustProgramId: programId,
      });
      projectId = response.body.uuid;
    });

    it('updates a project successfully', async function () {
      const updateData = {
        projectName: 'Updated V2 Project Name',
        projectDescription: 'Updated description',
      };

      const response = await supertest(app)
        .put(`/v2/project/${projectId}`)
        .send(updateData);

      validateV2SuccessResponse(response, 'Project update staged successfully');
    }).timeout(getV2TestTimeout());

    it('rejects update with timestamp fields', async function () {
      const updateData = {
        projectName: 'Updated Name',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .put(`/v2/project/${projectId}`)
        .send(updateData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('validates picklist fields in updates', async function () {
      const updateData = {
        projectSector: 'Invalid Sector',
      };

      const response = await supertest(app)
        .put(`/v2/project/${projectId}`)
        .send(updateData);

      validateV2ErrorResponse(response, 'does not include a valid option');
    }).timeout(getV2TestTimeout());

    it('returns 404 for update of non-existent project', async function () {
      const updateData = { projectName: 'Updated Name' };

      const response = await supertest(app)
        .put('/v2/project/999999')
        .send(updateData);

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Project not found');
    }).timeout(getV2TestTimeout());
  });

  describe('DELETE - Delete Project', function () {
    let projectId;

    beforeEach(async function () {
      const response = await supertest(app).post('/v2/project').send({
        ...newProject,
        cadTrustProgramId: programId,
      });
      projectId = response.body.uuid;
    });

    it('deletes a project successfully', async function () {
      const response = await supertest(app).delete(`/v2/project/${projectId}`);

      validateV2SuccessResponse(response, 'Project delete staged successfully');
    }).timeout(getV2TestTimeout());

    it('returns 404 for deletion of non-existent project', async function () {
      const response = await supertest(app).delete('/v2/project/999999');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Project not found');
    }).timeout(getV2TestTimeout());
  });

  describe('Validation Tests', function () {
    it('validates project registry name is required', async function () {
      const invalidProject = {
        projectId: 'TEST-001',
        projectName: 'Test Project',
        // Missing projectRegistryName
        cadTrustProgramId: programId,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidProject);

      validateV2ErrorResponse(response, 'projectRegistryName is required');
    }).timeout(getV2TestTimeout());

    it('validates project ID is required', async function () {
      const invalidProject = {
        projectRegistryName: 'Test Registry',
        projectName: 'Test Project',
        // Missing projectId
        cadTrustProgramId: programId,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidProject);

      validateV2ErrorResponse(response, 'projectId is required');
    }).timeout(getV2TestTimeout());

    it('validates project name is required', async function () {
      const invalidProject = {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-001',
        // Missing projectName
        cadTrustProgramId: programId,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidProject);

      validateV2ErrorResponse(response, 'projectName is required');
    }).timeout(getV2TestTimeout());

    it('validates project sector picklist', async function () {
      const validSectors = ['Energy', 'Transport', 'Agriculture', 'Forestry', 'Waste'];

      for (const sector of validSectors) {
        const project = {
          ...newProject,
          cadTrustProgramId: programId,
          projectSector: sector,
        };

        const response = await supertest(app)
          .post('/v2/project')
          .send(project);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());

    it('validates project type picklist', async function () {
      const validTypes = ['Renewable Energy', 'Energy Efficiency', 'Forest Conservation'];

      for (const type of validTypes) {
        const project = {
          ...newProject,
          cadTrustProgramId: programId,
          projectType: type,
        };

        const response = await supertest(app)
          .post('/v2/project')
          .send(project);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());

    it('validates project status picklist', async function () {
      const validStatuses = ['Registered', 'Under Validation', 'Validated', 'Under Verification'];

      for (const status of validStatuses) {
        const project = {
          ...newProject,
          cadTrustProgramId: programId,
          projectStatus: status,
        };

        const response = await supertest(app)
          .post('/v2/project')
          .send(project);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());

    it('validates project unit metric picklist', async function () {
      const validMetrics = ['tCO2e', 'tCO2', 'tCH4', 'tN2O'];

      for (const metric of validMetrics) {
        const project = {
          ...newProject,
          cadTrustProgramId: programId,
          projectUnitMetric: metric,
        };

        const response = await supertest(app)
          .post('/v2/project')
          .send(project);

        expect(response.status).to.equal(200);
      }
    }).timeout(getV2TestTimeout());
  });

  describe('Edge Cases', function () {
    it('handles very long project names', async function () {
      const longNameProject = {
        ...newProject,
        cadTrustProgramId: programId,
        projectName: 'A'.repeat(1000), // Very long name
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(longNameProject);

      // Should either succeed or fail gracefully
      expect([200, 400]).to.include(response.status);
    }).timeout(getV2TestTimeout());

    it('handles special characters in project data', async function () {
      const specialCharProject = {
        ...newProject,
        cadTrustProgramId: programId,
        projectName: 'Project with Special Chars: !@#$%^&*()',
        projectDescription: 'Description with émojis 🚀 and unicode 中文',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(specialCharProject);

      validateV2SuccessResponse(response, 'Project staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles empty optional fields', async function () {
      const minimalProject = {
        projectRegistryName: 'Minimal Registry',
        projectId: 'MIN-001',
        projectName: 'Minimal Project',
        projectSector: 'Energy',
        projectType: 'Renewable Energy',
        projectStatus: 'Registered',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: programId,
        projectCreditingProgram: '',
        projectDescription: '',
        projectSubtype: '',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(minimalProject);

      validateV2SuccessResponse(response, 'Project staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles duplicate project IDs gracefully', async function () {
      const project1 = {
        ...newProject,
        cadTrustProgramId: programId,
      };

      const project2 = {
        ...newProject,
        projectName: 'Duplicate ID Project',
        cadTrustProgramId: programId,
        // Same projectId as project1
      };

      const response1 = await supertest(app)
        .post('/v2/project')
        .send(project1);

      const response2 = await supertest(app)
        .post('/v2/project')
        .send(project2);

      expect(response1.status).to.equal(200);
      // Second project should either succeed or fail gracefully
      expect([200, 400]).to.include(response2.status);
    }).timeout(getV2TestTimeout());
  });

  describe('Performance Tests', function () {
    it('handles large number of projects efficiently', async function () {
      const startTime = Date.now();

      // Create 50 projects
      const promises = Array.from({ length: 50 }, (_, i) =>
        supertest(app).post('/v2/project').send({
          ...newProject,
          projectId: `V2-PROJ-${i.toString().padStart(3, '0')}`,
          projectName: `V2 Project ${i}`,
          cadTrustProgramId: programId,
        })
      );

      await Promise.all(promises);

      const response = await supertest(app).get('/v2/project');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(response.status).to.equal(200);
      expect(response.body.length).to.be.greaterThanOrEqual(50);
      expect(executionTime).to.be.lessThan(15000); // Should complete within 15 seconds
    }).timeout(getV2TestTimeout() * 3);
  });
});
