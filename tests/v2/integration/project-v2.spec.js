import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ProjectV2, ProgramV2 } from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  waitForV2DataLayerSync,
} from '../utils/v2-test-helpers.js';

describe('V2 Project API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testProgram;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create a test program for foreign key validation
    testProgram = await ProgramV2.create({
      programName: 'Test Program for Project',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    // Clean staging table before each test
    await resetV2StagingTable();
  });

  describe('POST /v2/project (Create)', function () {
    it('should create a new project record', async function () {
      const projectData = {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectCreditingProgram: 'Test Crediting Program',
        projectName: 'Test Project',
        projectLink: 'https://example.com/project',
        projectDescription: 'Test project description',
        projectSector: 'Agriculture',
        projectType: 'Landfill gas',
        projectSubtype: 'Test Subtype',
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
        cadTrustReferenceProjectId: 'REF-001',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(projectData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Project staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('project');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.commited).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].project_name).to.equal('Test Project');
      expect(stagedData[0].project_registry_name).to.equal('Test Registry');
      expect(stagedData[0].project_sector).to.equal('Agriculture');
      expect(stagedData[0].cad_trust_program_id).to.equal(testProgram.cadTrustProgramId);
    });

    it('should create project with minimal required data', async function () {
      const minimalData = {
        projectRegistryName: 'Minimal Registry',
        projectId: 'MIN-PROJECT-001',
        projectName: 'Minimal Project',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    // Validation tests
    it('should reject project without required projectRegistryName', async function () {
      const invalidData = {
        projectId: 'MISSING-REGISTRY',
        projectName: 'Missing Registry Project',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectRegistryName');
    });

    it('should reject project without required projectId', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-ID',
        projectName: 'Missing ID Project',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectId');
    });

    it('should reject project without required projectName', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-NAME',
        projectId: 'MISSING-NAME-001',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectName');
    });

    it('should reject project with invalid projectLink format', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-LINK',
        projectId: 'INVALID-LINK-001',
        projectName: 'Invalid Link Project',
        projectLink: 'not-a-valid-url',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectLink');
    });

    it('should reject project with invalid projectStatusDate format', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-DATE',
        projectId: 'INVALID-DATE-001',
        projectName: 'Invalid Date Project',
        projectStatusDate: 'not-a-date',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectStatusDate');
    });

    // Picklist validation tests
    it('should reject project with invalid projectSector (not in V2 picklist)', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-SECTOR',
        projectId: 'INVALID-SECTOR-001',
        projectName: 'Invalid Sector Project',
        projectSector: 'InvalidSector',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectSector');
    });

    it('should accept project with valid V2 projectSector', async function () {
      const validData = {
        projectRegistryName: 'VALID-SECTOR',
        projectId: 'VALID-SECTOR-001',
        projectName: 'Valid Sector Project',
        projectSector: 'Agriculture',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject project with invalid projectType (not in V2 picklist)', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-TYPE',
        projectId: 'INVALID-TYPE-001',
        projectName: 'Invalid Type Project',
        projectType: 'InvalidType',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectType');
    });

    it('should accept project with valid V2 projectType', async function () {
      const validData = {
        projectRegistryName: 'VALID-TYPE',
        projectId: 'VALID-TYPE-001',
        projectName: 'Valid Type Project',
        projectType: 'Landfill gas',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject project with invalid projectStatus (not in V2 picklist)', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-STATUS',
        projectId: 'INVALID-STATUS-001',
        projectName: 'Invalid Status Project',
        projectStatus: 'InvalidStatus',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectStatus');
    });

    it('should accept project with valid V2 projectStatus', async function () {
      const validData = {
        projectRegistryName: 'VALID-STATUS',
        projectId: 'VALID-STATUS-001',
        projectName: 'Valid Status Project',
        projectStatus: 'Listed',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject project with invalid projectUnitMetric (not in V2 picklist)', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-METRIC',
        projectId: 'INVALID-METRIC-001',
        projectName: 'Invalid Metric Project',
        projectUnitMetric: 'InvalidMetric',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectUnitMetric');
    });

    it('should accept project with valid V2 projectUnitMetric', async function () {
      const validData = {
        projectRegistryName: 'VALID-METRIC',
        projectId: 'VALID-METRIC-001',
        projectName: 'Valid Metric Project',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    // Foreign key validation tests
    it('should reject project with invalid cadTrustProgramId', async function () {
      const invalidData = {
        projectRegistryName: 'INVALID-FK',
        projectId: 'INVALID-FK-001',
        projectName: 'Invalid FK Project',
        cadTrustProgramId: 999999,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('ProgramV2 does not have a record');
    });

    it('should accept project with valid cadTrustProgramId', async function () {
      const validData = {
        projectRegistryName: 'VALID-FK',
        projectId: 'VALID-FK-001',
        projectName: 'Valid FK Project',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject project with forbidden createdAt field', async function () {
      const invalidData = {
        projectRegistryName: 'FORBIDDEN-FIELD',
        projectId: 'FORBIDDEN-FIELD-001',
        projectName: 'Forbidden Field Project',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt');
    });

    it('should reject project with forbidden updatedAt field', async function () {
      const invalidData = {
        projectRegistryName: 'FORBIDDEN-FIELD',
        projectId: 'FORBIDDEN-FIELD-002',
        projectName: 'Forbidden Field Project',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt');
    });
  });

  describe('GET /v2/project (List)', function () {
    it('should return empty array when no projects exist', async function () {
      // Clean up any existing data
      await ProjectV2.destroy({ where: {} });

      const response = await supertest(app)
        .get('/v2/project')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return projects from database with program association', async function () {
      // Create a project directly in database
      const project = await ProjectV2.create({
        projectRegistryName: 'Database Registry',
        projectId: 'DB-PROJECT-001',
        projectName: 'Database Project',
        projectSector: 'Agriculture',
        projectType: 'Landfill gas',
        projectStatus: 'Listed',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      });

      const response = await supertest(app)
        .get('/v2/project')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].projectName).to.equal('Database Project');
      expect(response.body[0].projectRegistryName).to.equal('Database Registry');
      expect(response.body[0].projectSector).to.equal('Agriculture');
      expect(response.body[0].program).to.exist;
      expect(response.body[0].program.programName).to.equal('Test Program for Project');
    });
  });

  describe('GET /v2/project/:id (Get One)', function () {
    it('should return 404 for non-existent project', async function () {
      const response = await supertest(app)
        .get('/v2/project/999999')
        .expect(404);

      expect(response.body.message).to.equal('Project not found');
      expect(response.body.success).to.be.false;
    });

    it('should return project by ID with program association', async function () {
      // Create a project directly in database
      const project = await ProjectV2.create({
        projectRegistryName: 'Get Test Registry',
        projectId: 'GET-TEST-001',
        projectName: 'Get Test Project',
        projectSector: 'Energy industries (renewable-/ non renewable sources)',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      });

      const response = await supertest(app)
        .get(`/v2/project/${project.cadTrustProjectId}`)
        .expect(200);

      expect(response.body.projectName).to.equal('Get Test Project');
      expect(response.body.projectRegistryName).to.equal('Get Test Registry');
      expect(response.body.projectSector).to.equal('Energy industries (renewable-/ non renewable sources)');
      expect(response.body.program).to.exist;
      expect(response.body.program.programName).to.equal('Test Program for Project');
    });
  });

  describe('PUT /v2/project/:id (Update)', function () {
    it('should return 404 for non-existent project', async function () {
      const updateData = {
        projectRegistryName: 'Updated Registry',
        projectId: 'UPDATED-001',
        projectName: 'Updated Name',
      };

      const response = await supertest(app)
        .put('/v2/project/999999')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Project not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage project update', async function () {
      // Create a project directly in database
      const project = await ProjectV2.create({
        projectRegistryName: 'Original Registry',
        projectId: 'ORIGINAL-001',
        projectName: 'Original Name',
        projectSector: 'Agriculture',
      });

      const updateData = {
        projectRegistryName: 'Updated Registry',
        projectId: 'UPDATED-001',
        projectCreditingProgram: 'Updated Crediting Program',
        projectName: 'Updated Name',
        projectLink: 'https://example.com/updated',
        projectDescription: 'Updated description',
        projectSector: 'Energy industries (renewable-/ non renewable sources)',
        projectType: 'Wind',
        projectSubtype: 'Updated Subtype',
        projectStatus: 'Registered',
        projectStatusDate: '2024-02-01',
        projectUnitMetric: 'gCO2eq/kWh',
        cadTrustReferenceProjectId: 'UPDATED-REF-001',
        cadTrustProgramId: testProgram.cadTrustProgramId,
      };

      const response = await supertest(app)
        .put(`/v2/project/${project.cadTrustProjectId}`)
        .send(updateData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Project update staged successfully');
      expect(response.body.success).to.be.true;

      // Verify update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'project',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_project_id).to.equal(project.cadTrustProjectId);
      expect(stagedData[0].project_name).to.equal('Updated Name');
      expect(stagedData[0].project_registry_name).to.equal('Updated Registry');
      expect(stagedData[0].project_sector).to.equal('Energy industries (renewable-/ non renewable sources)');
      expect(stagedData[0].cad_trust_program_id).to.equal(testProgram.cadTrustProgramId);
    });
  });

  describe('DELETE /v2/project/:id (Delete)', function () {
    it('should return 404 for non-existent project', async function () {
      const response = await supertest(app)
        .delete('/v2/project/999999')
        .expect(404);

      expect(response.body.message).to.equal('Project not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage project deletion', async function () {
      // Create a project directly in database
      const project = await ProjectV2.create({
        projectRegistryName: 'To Be Deleted',
        projectId: 'DELETE-001',
        projectName: 'To Be Deleted Project',
      });

      const response = await supertest(app)
        .delete(`/v2/project/${project.cadTrustProjectId}`)
        .expect(200);

      expect(response.body.message).to.equal('Project delete staged successfully');
      expect(response.body.success).to.be.true;

      // Verify deletion was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'project',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_project_id).to.equal(project.cadTrustProjectId);
    });
  });
});
