import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ProjectV2, ProgramV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
  verifyTestDatabaseConfiguration,
} from '../utils/v2-test-helpers.js';

describe('V2 Project API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testProgram;
  let homeOrg;

  before(async function () {
    // Safety check: Verify test databases are being used
    await verifyTestDatabaseConfiguration();

    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    homeOrg = await createV2TestHomeOrg();

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
    await resetV2StagingTable();
    await resetV2DataTables();

    // Recreate test program after cleanup
    testProgram = await ProgramV2.create({
      programName: 'Test Program for Project',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });
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
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
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
      expect(response.body).to.have.property('uuid');
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('project');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].project_name).to.equal('Test Project');
      expect(stagedData[0].project_registry_name).to.equal('Test Registry');
      expect(stagedData[0].project_sector).to.deep.equal(['Agriculture']);
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
        projectSector: ['InvalidSector'],
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectSector');
    });

    it('should accept project with valid V2 projectSector array', async function () {
      const validData = {
        projectRegistryName: 'VALID-SECTOR',
        projectId: 'VALID-SECTOR-001',
        projectName: 'Valid Sector Project',
        projectSector: ['Agriculture'],
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should accept project with multiple valid V2 projectSectors', async function () {
      const validData = {
        projectRegistryName: 'VALID-MULTI-SECTOR',
        projectId: 'VALID-MULTI-SECTOR-001',
        projectName: 'Valid Multi-Sector Project',
        projectSector: ['Agriculture', 'Energy demand'],
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
        projectType: ['InvalidType'],
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectType');
    });

    it('should accept project with valid V2 projectType array', async function () {
      const validData = {
        projectRegistryName: 'VALID-TYPE',
        projectId: 'VALID-TYPE-001',
        projectName: 'Valid Type Project',
        projectType: ['Landfill gas'],
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should accept project with multiple valid V2 projectTypes', async function () {
      const validData = {
        projectRegistryName: 'VALID-MULTI-TYPE',
        projectId: 'VALID-MULTI-TYPE-001',
        projectName: 'Valid Multi-Type Project',
        projectType: ['Landfill gas', 'Solar', 'Wind'],
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
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProgramId');
      expect(response.body.error).to.include('does not exist');
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

    it('should reject project with forbidden orgUid field', async function () {
      const invalidData = {
        projectRegistryName: 'FORBIDDEN-ORGUID',
        projectId: 'FORBIDDEN-ORGUID-001',
        projectName: 'Forbidden orgUid Project',
        orgUid: 'some-org-uid',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('orgUid');
      expect(response.body.error).to.include('automatically set');
    });

    it('should automatically set orgUid from home organization when creating project', async function () {
      const projectData = {
        projectRegistryName: 'Auto OrgUid Registry',
        projectId: 'AUTO-ORGUID-001',
        projectName: 'Auto OrgUid Project',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(projectData)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Verify staged data includes org_uid from home organization
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;

      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0]).to.have.property('org_uid');
      // Verify org_uid matches the actual home organization
      const actualHomeOrgId = await getV2HomeOrgId();
      expect(stagedData[0].org_uid).to.equal(actualHomeOrgId);
    });
  });

  describe('GET /v2/project (List)', function () {
    it('should return empty array when no projects exist', async function () {
      const response = await supertest(app)
        .get('/v2/project')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return projects from database with program association', async function () {
      // Create a project directly in database
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Database Registry',
        projectId: 'DB-PROJECT-001',
        projectName: 'Database Project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      const response = await supertest(app)
        .get('/v2/project?columns=program')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].projectName).to.equal('Database Project');
      expect(response.body[0].projectRegistryName).to.equal('Database Registry');
      expect(response.body[0].projectSector).to.deep.equal(['Agriculture']);
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
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Get Test Registry',
        projectId: 'GET-TEST-001',
        projectName: 'Get Test Project',
        projectSector: ['Energy industries (renewable-/ non renewable sources)'],
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      const response = await supertest(app)
        .get(`/v2/project/${project.cadTrustProjectId}?columns=program`)
        .expect(200);

      expect(response.body.projectName).to.equal('Get Test Project');
      expect(response.body.projectRegistryName).to.equal('Get Test Registry');
      expect(response.body.projectSector).to.deep.equal(['Energy industries (renewable-/ non renewable sources)']);
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
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Original Registry',
        projectId: 'ORIGINAL-001',
        projectName: 'Original Name',
        projectSector: ['Agriculture'],
        orgUid: homeOrgId,
      }));

      const updateData = {
        projectRegistryName: 'Updated Registry',
        projectId: 'UPDATED-001',
        projectCreditingProgram: 'Updated Crediting Program',
        projectName: 'Updated Name',
        projectLink: 'https://example.com/updated',
        projectDescription: 'Updated description',
        projectSector: ['Energy industries (renewable-/ non renewable sources)'],
        projectType: ['Wind'],
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
      expect(stagingRecord.committed).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_project_id).to.equal(project.cadTrustProjectId);
      expect(stagedData[0].project_name).to.equal('Updated Name');
      expect(stagedData[0].project_registry_name).to.equal('Updated Registry');
      expect(stagedData[0].project_sector).to.deep.equal(['Energy industries (renewable-/ non renewable sources)']);
      expect(stagedData[0].cad_trust_program_id).to.equal(testProgram.cadTrustProgramId);
      // Verify org_uid is automatically set in update
      expect(stagedData[0]).to.have.property('org_uid');
      const actualHomeOrgId = await getV2HomeOrgId();
      expect(stagedData[0].org_uid).to.equal(actualHomeOrgId);
    });

    it('should reject project update with forbidden orgUid field', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Original Registry',
        projectId: 'ORIGINAL-002',
        projectName: 'Original Name',
        projectSector: ['Agriculture'],
        orgUid: homeOrgId,
      }));

      const updateData = {
        projectRegistryName: 'Updated Registry',
        projectId: 'UPDATED-002',
        projectName: 'Updated Name',
        orgUid: 'some-other-org-uid',
      };

      const response = await supertest(app)
        .put(`/v2/project/${project.cadTrustProjectId}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('orgUid');
      expect(response.body.error).to.include('automatically set');
    });

    it('should automatically set orgUid from home organization when updating project', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Original Registry',
        projectId: 'ORIGINAL-003',
        projectName: 'Original Name',
        projectSector: ['Agriculture'],
        orgUid: homeOrgId,
      }));

      const updateData = {
        projectRegistryName: 'Updated Registry',
        projectId: 'UPDATED-003',
        projectName: 'Updated Name',
      };

      const response = await supertest(app)
        .put(`/v2/project/${project.cadTrustProjectId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Verify staged update data includes org_uid from home organization
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'project',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;

      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0]).to.have.property('org_uid');
      // Verify org_uid matches the actual home organization
      const actualHomeOrgId = await getV2HomeOrgId();
      expect(stagedData[0].org_uid).to.equal(actualHomeOrgId);
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
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'To Be Deleted',
        projectId: 'DELETE-001',
        projectName: 'To Be Deleted Project',
        orgUid: homeOrgId,
      }));

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
      expect(stagingRecord.committed).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_project_id).to.equal(project.cadTrustProjectId);
    });
  });

  describe('Phase 20.5: Advanced Features Tests', function () {
    describe('PUT /v2/project/transfer', function () {
      it('should transfer a project successfully', async function () {
        // Create a project in the database
        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Transfer Test Registry',
          projectId: 'TRANSFER-001',
          projectName: 'Transfer Test Project',
          projectSector: ['Agriculture'],
          projectType: ['Landfill gas'],
          projectStatus: 'Listed',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: homeOrgId,
        }));

        // Clear staging table before transfer
        await resetV2StagingTable();

        const response = await supertest(app)
          .put('/v2/project/transfer')
          .send({ cadTrustProjectId: project.cadTrustProjectId })
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('transfer staged successfully');

        // Verify transfer record was created with is_transfer flag
        const stagingRecord = await StagingV2.findOne({
          where: {
            uuid: project.cadTrustProjectId,
            table: 'project',
            is_transfer: true,
          },
        });

        expect(stagingRecord).to.exist;
        expect(stagingRecord.action).to.equal('UPDATE');
        expect(stagingRecord.is_transfer).to.be.true;
        expect(stagingRecord.committed).to.be.true; // Transfer records are marked as committed
      });

      it('should return error if staging table is not empty', async function () {
        // Create a staging record
        await StagingV2.create({
          uuid: uuidv4(),
          table: 'project',
          action: 'INSERT',
          data: JSON.stringify([{ project_name: 'Test' }]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'TRANSFER-002',
          projectName: 'Test Project',
          projectSector: ['Agriculture'],
          projectType: ['Landfill gas'],
          projectStatus: 'Listed',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: homeOrgId,
        }));

        const response = await supertest(app)
          .put('/v2/project/transfer')
          .send({ cadTrustProjectId: project.cadTrustProjectId })
          .expect(400);

        // Response should have error information
        expect(response.body).to.exist;
        // Error response format may vary - check all possible fields
        const errorMessage = response.body.error || response.body.message || JSON.stringify(response.body);
        expect(errorMessage).to.exist;
        expect(errorMessage).to.include('Staging table is not empty');
      });

      it('should return error if project does not exist', async function () {
        await resetV2StagingTable();

        const response = await supertest(app)
          .put('/v2/project/transfer')
          .send({ cadTrustProjectId: 'non-existent-id' })
          .expect(400);

        // Response should have error information
        expect(response.body).to.exist;
        // Error response format may vary - check all possible fields
        const errorMessage = response.body.error || response.body.message || JSON.stringify(response.body);
        expect(errorMessage).to.exist;
        expect(errorMessage).to.include('does not exist');
      });

      it('should return error if cadTrustProjectId is missing', async function () {
        await resetV2StagingTable();

        const response = await supertest(app)
          .put('/v2/project/transfer')
          .send({})
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('cadTrustProjectId is required');
      });
    });

    describe('PUT /v2/project/xlsx', function () {
      it('should update projects from XLSX file', async function () {
        // Create a simple XLSX file buffer
        // For testing, we'll create a minimal XLSX structure
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const testData = [
          ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName', 'projectSector', 'projectType', 'projectStatus', 'projectUnitMetric'],
          ['test-uuid-1', 'Test Registry', 'XLSX-001', 'XLSX Test Project', 'Agriculture', 'Landfill gas', 'Listed', 'tCO2e'],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'project', data: testData }]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('Updates from xlsx added to staging');
      });

      it('should return error if no file is provided', async function () {
        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('File Not Received');
      });
    });

    describe('POST /v2/project/batch', function () {
      it('should batch upload new projects from CSV file (INSERT)', async function () {
        // Create a CSV file buffer without cadTrustProjectId to trigger INSERT
        const csvContent = `projectRegistryName,projectId,projectName,projectSector,projectType,projectStatus,projectUnitMetric,cadTrustProgramId
Test Registry,CSV-001,CSV Test Project 1,Agriculture,Landfill gas,Listed,tCO2e,${testProgram.cadTrustProgramId}
Test Registry,CSV-002,CSV Test Project 2,Energy,Energy efficiency,Registered,tCO2e,${testProgram.cadTrustProgramId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('CSV processing complete');

        // Verify records were staged
        const stagingRecords = await StagingV2.findAll({
          where: {
            table: 'project',
            action: 'INSERT',
          },
        });

        expect(stagingRecords.length).to.be.at.least(2);
      });

      it('should batch update existing projects from CSV file (UPDATE)', async function () {
        // Create projects first
        const homeOrgId = await getV2HomeOrgId();
        const project1 = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'CSV-UPDATE-001',
          projectName: 'Original Name 1',
          projectSector: ['Agriculture'],
          projectType: ['Landfill gas'],
          projectStatus: 'Listed',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: homeOrgId,
        }));

        const project2 = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'CSV-UPDATE-002',
          projectName: 'Original Name 2',
          projectSector: ['Energy'],
          projectType: ['Energy efficiency'],
          projectStatus: 'Registered',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: homeOrgId,
        }));

        // Create a CSV file buffer with cadTrustProjectId to trigger UPDATE
        const csvContent = `cadTrustProjectId,projectRegistryName,projectId,projectName,projectSector,projectType,projectStatus,projectUnitMetric,cadTrustProgramId
${project1.cadTrustProjectId},Test Registry,CSV-UPDATE-001,Updated Name 1,Agriculture,Landfill gas,Listed,tCO2e,${testProgram.cadTrustProgramId}
${project2.cadTrustProjectId},Test Registry,CSV-UPDATE-002,Updated Name 2,Energy,Energy efficiency,Registered,tCO2e,${testProgram.cadTrustProgramId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('CSV processing complete');

        // Verify records were staged as UPDATE
        const stagingRecords = await StagingV2.findAll({
          where: {
            table: 'project',
            action: 'UPDATE',
          },
        });

        expect(stagingRecords.length).to.be.at.least(2);
      });

      it('should return error if no CSV file is provided', async function () {
        const response = await supertest(app)
          .post('/v2/project/batch')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('Cannot find the required csv file');
      });
    });

    describe('GET /v2/project - Advanced Query Features', function () {
      beforeEach(async function () {
        // Create multiple test projects for query testing
        const homeOrgId = await getV2HomeOrgId();
        await ProjectV2.bulkCreate([
          addUuidIfNeeded('ProjectV2', {
            projectRegistryName: 'Query Test Registry',
            projectId: 'QUERY-001',
            projectName: 'Query Test Project 1',
            projectSector: ['Agriculture'],
            projectType: ['Landfill gas'],
            projectStatus: 'Listed',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: testProgram.cadTrustProgramId,
            orgUid: homeOrgId,
          }),
          addUuidIfNeeded('ProjectV2', {
            projectRegistryName: 'Query Test Registry',
            projectId: 'QUERY-002',
            projectName: 'Query Test Project 2',
            projectSector: ['Energy'],
            projectType: ['Energy efficiency'],
            projectStatus: 'Registered',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: testProgram.cadTrustProgramId,
            orgUid: homeOrgId,
          }),
          addUuidIfNeeded('ProjectV2', {
            projectRegistryName: 'Query Test Registry',
            projectId: 'QUERY-003',
            projectName: 'Query Test Project 3',
            projectSector: ['Manufacturing'],
            projectType: ['Renewable energy'],
            projectStatus: 'Listed',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: testProgram.cadTrustProgramId,
            orgUid: homeOrgId,
          }),
        ]);
      });

      it('should filter by orgUid', async function () {
        const homeOrgId = await getV2HomeOrgId();
        // Create projects with the home org UID
        await ProjectV2.bulkCreate([
          addUuidIfNeeded('ProjectV2', {
            projectRegistryName: 'Org Filter Registry',
            projectId: 'ORG-FILTER-001',
            projectName: 'Org Filter Project 1',
            projectSector: ['Agriculture'],
            projectType: ['Landfill gas'],
            projectStatus: 'Listed',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: testProgram.cadTrustProgramId,
            orgUid: homeOrgId,
          }),
        ]);

        const response = await supertest(app)
          .get('/v2/project')
          .query({ orgUid: homeOrgId, page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
        // All returned projects should have the matching orgUid
        response.body.data.forEach(project => {
          expect(project.orgUid).to.equal(homeOrgId);
        });
      });

      it('should filter by projectIds', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const projects = await ProjectV2.findAll({
          where: { orgUid: homeOrgId },
          limit: 2
        });
        const projectIds = projects.map(p => p.cadTrustProjectId);

        const response = await supertest(app)
          .get('/v2/project')
          .query({ projectIds: projectIds.join(','), page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.equal(2);
        expect(response.body.data.map(p => p.cadTrustProjectId)).to.have.members(projectIds);
      });

      it('should filter by single field using generic filter', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: 'projectStatus:Listed:eq', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        response.body.data.forEach(project => {
          expect(project.projectStatus).to.equal('Listed');
        });
      });

      it('should filter by multiple values using generic filter', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: 'projectStatus:["Listed","Registered"]:in', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        response.body.data.forEach(project => {
          const allowedStatuses = ['Listed', 'Registered'];
          expect(allowedStatuses).to.include(project.projectStatus);
        });
      });

      it('should select specific columns', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({
            columns: ['cadTrustProjectId', 'projectName', 'projectSector'].join(','),
            page: 1,
            limit: 10,
          })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        if (response.body.data.length > 0) {
          const project = response.body.data[0];
          expect(project).to.have.property('cadTrustProjectId');
          expect(project).to.have.property('projectName');
          expect(project).to.have.property('projectSector');
          // Should not have other fields
          expect(project).to.not.have.property('projectLink');
        }
      });

      it('should sort by field in ascending order', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: 'projectName:ASC', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        if (response.body.data.length > 1) {
          const names = response.body.data.map(p => p.projectName);
          const sortedNames = [...names].sort();
          expect(names).to.deep.equal(sortedNames);
        }
      });

      it('should sort by field in descending order', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: 'projectName:DESC', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        if (response.body.data.length > 1) {
          const names = response.body.data.map(p => p.projectName);
          const sortedNames = [...names].sort().reverse();
          expect(names).to.deep.equal(sortedNames);
        }
      });

      it('should export to Excel format', async function () {
        // XLS export doesn't require pagination
        const response = await supertest(app)
          .get('/v2/project')
          .query({ xls: 'true' })
          .expect(200);

        // Excel export should return binary data
        expect(response.headers['content-disposition']).to.include('attachment');
        expect(response.headers['content-disposition']).to.include('.xlsx');
        expect(response.headers['content-type']).to.exist;
      });

      it('should combine multiple query parameters', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const projects = await ProjectV2.findAll({
          where: { orgUid: homeOrgId },
          limit: 1
        });
        const projectId = projects[0].cadTrustProjectId;

        const response = await supertest(app)
          .get('/v2/project')
          .query({
            projectIds: projectId,
            columns: ['cadTrustProjectId', 'projectName'].join(','),
            order: 'projectName:ASC',
            page: 1,
            limit: 10,
          })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.equal(1);
        expect(response.body.data[0].cadTrustProjectId).to.equal(projectId);
        expect(response.body.data[0]).to.have.property('projectName');
      });

      it('should reject invalid order column name (SQL injection prevention)', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: 'invalidColumn:ASC', page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid sort column');
        expect(response.body.error).to.include('invalidColumn');
      });

      it('should reject SQL injection attempt in order column name', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: "projectName'; DROP TABLE project; --:ASC", page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid sort column');
      });

      it('should reject invalid sort direction', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: 'projectName:INVALID', page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid sort direction');
        expect(response.body.error).to.include('Must be ASC or DESC');
      });

      it('should reject filter parameter exceeding maximum length (ReDoS prevention)', async function () {
        const longFilter = 'projectName:' + 'x'.repeat(10001) + ':eq';
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: longFilter, page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Filter parameter exceeds maximum length');
      });

      it('should reject filter value exceeding maximum length (ReDoS prevention)', async function () {
        const longValue = 'x'.repeat(5001);
        const filter = `projectName:${longValue}:eq`;
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter, page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Filter value exceeds maximum length');
      });

      it('should accept filter parameter at maximum allowed length', async function () {
        const maxLengthFilter = 'projectName:' + 'x'.repeat(5000) + ':eq';
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: maxLengthFilter, page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
      });

      it('should reject filter parameter when it is an array (type confusion prevention)', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: ['field:value:eq', 'field2:value2:eq'], page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Filter parameter must be a string');
      });

      it('should ignore filter parameter with extra characters (anchored regex validation)', async function () {
        // Anchored regex requires exact match - filter with extra characters won't match
        // This is safe behavior: invalid filters are ignored rather than causing errors
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: 'projectName:Test:eq extra', page: 1, limit: 10 })
          .expect(200);

        // The filter won't match due to anchoring, so filter is ignored
        // Response should still be valid (may return all results or empty if no projects exist)
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
      });

      it('should accept valid filter parameter format (anchored regex)', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ filter: 'projectStatus:Listed:eq', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        // Filter should work correctly with anchored regex
        response.body.data.forEach(project => {
          expect(project.projectStatus).to.equal('Listed');
        });
      });

      it('should reject order parameter when it is an array (type confusion prevention)', async function () {
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: ['projectName:ASC', 'projectName:DESC'], page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Order parameter must be a string');
      });

      it('should reject order parameter exceeding maximum length (ReDoS prevention)', async function () {
        const longOrder = 'a'.repeat(201) + ':ASC'; // Exceeds 200 character limit
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: longOrder, page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Order parameter exceeds maximum length');
      });

      it('should accept order parameter at maximum allowed length', async function () {
        const maxLengthOrder = 'a'.repeat(190) + ':ASC'; // Within 200 character limit
        const response = await supertest(app)
          .get('/v2/project')
          .query({ order: maxLengthOrder, page: 1, limit: 10 })
          .expect(400); // Will fail validation because column name is invalid, but length check passes

        // Should fail on invalid column, not length
        expect(response.body.error).to.include('Invalid sort column');
      });
    });
  });
});
