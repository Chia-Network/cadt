import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ProjectV2, ProgramV2, LocationV2, EstimationV2, RatingV2, CoBenefitV2, ValidationV2, VerificationV2, MethodologyV2, ProjectMethodologyV2, StakeholderV2, StakeholderProjectV2, IssuanceV2, UnitV2, LabelV2, UnitLabelV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
  createV2TestProgramChain,
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
      expect(JSON.parse(stagedData[0].project_sector)).to.deep.equal(['Agriculture']);
      expect(stagedData[0].cad_trust_program_id).to.equal(testProgram.cadTrustProgramId);
    });

    it('should create project with all required data', async function () {
      const minimalData = {
        projectRegistryName: 'Minimal Registry',
        projectId: 'MIN-PROJECT-001',
        projectName: 'Minimal Project',
        projectLink: 'https://example.com/minimal',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    it('should reject project without required projectLink', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-LINK',
        projectId: 'MISSING-LINK-001',
        projectName: 'Missing Link Project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectLink');
    });

    it('should reject project without required projectSector', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-SECTOR',
        projectId: 'MISSING-SECTOR-001',
        projectName: 'Missing Sector Project',
        projectLink: 'https://example.com/project',
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectSector');
    });

    it('should reject project without required projectType', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-TYPE',
        projectId: 'MISSING-TYPE-001',
        projectName: 'Missing Type Project',
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectType');
    });

    it('should reject project without required projectStatus', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-STATUS',
        projectId: 'MISSING-STATUS-001',
        projectName: 'Missing Status Project',
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectStatus');
    });

    it('should reject project without required projectStatusDate', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-STATUSDATE',
        projectId: 'MISSING-STATUSDATE-001',
        projectName: 'Missing StatusDate Project',
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectUnitMetric: 'tCO2e',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectStatusDate');
    });

    it('should reject project without required projectUnitMetric', async function () {
      const invalidData = {
        projectRegistryName: 'MISSING-UNITMETRIC',
        projectId: 'MISSING-UNITMETRIC-001',
        projectName: 'Missing UnitMetric Project',
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('projectUnitMetric');
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
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
        projectLink: 'https://example.com/project',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture', 'Energy demand'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas', 'Solar', 'Wind'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Landfill gas'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(0);
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
        .get('/v2/project')
        .query({ page: 1, limit: 10, columns: 'program' })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].projectName).to.equal('Database Project');
      expect(response.body.data[0].projectRegistryName).to.equal('Database Registry');
      expect(response.body.data[0].projectSector).to.deep.equal(['Agriculture']);
      expect(response.body.data[0].program).to.exist;
      expect(response.body.data[0].program.programName).to.equal('Test Program for Project');
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
      expect(JSON.parse(stagedData[0].project_sector)).to.deep.equal(['Energy industries (renewable-/ non renewable sources)']);
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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
        projectLink: 'https://example.com/project',
        projectSector: ['Agriculture'],
        projectType: ['Solar'],
        projectStatus: 'Listed',
        projectStatusDate: '2024-01-01',
        projectUnitMetric: 'tCO2e',
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

    it('should cascade-stage deletes for project child records', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const chain = await createV2TestProgramChain({ testId: 'PROJ-CASCADE-001' });
      const { project, verification, issuance, methodology } = chain;

      const location = await LocationV2.create({
        cadTrustLocationId: uuidv4(),
        locationCountry: 'US',
        locationRegion: 'CA',
        cadTrustProjectId: project.cadTrustProjectId,
      });
      const estimation = await EstimationV2.create({
        cadTrustEstimationId: uuidv4(),
        estimationUnitCount: 25,
        estimationStartDate: '2024-01-01',
        estimationEndDate: '2024-12-31',
        cadTrustProjectId: project.cadTrustProjectId,
      });
      const rating = await RatingV2.create({
        cadTrustRatingId: uuidv4(),
        ratingName: 'Integrity',
        ratingValue: 'A',
        cadTrustProjectId: project.cadTrustProjectId,
      });
      const coBenefit = await CoBenefitV2.create({
        cadTrustCoBenefitId: uuidv4(),
        coBenefitId: 'CB-1',
        cadTrustProjectId: project.cadTrustProjectId,
      });

      const secondaryValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-CASCADE-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'Cascade Validator',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const secondaryVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VERIFICATION-CASCADE-001',
        verificationBody: 'Cascade Verifier',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: secondaryValidation.cadTrustValidationId,
      }));

      const extraProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-02-01',
      }));

      const stakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Cascade Stakeholder',
      });
      const stakeholderProject = await StakeholderProjectV2.create({
        cadTrustStakeholderProjectId: uuidv4(),
        cadTrustStakeholderId: stakeholder.cadTrustStakeholderId,
        cadTrustProjectId: project.cadTrustProjectId,
      });

      const issuanceChild = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISSUANCE-CASCADE-001',
        issuanceDate: '2024-03-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: chain.projectMethodology.cadTrustProjectMethodologyId,
      }));

      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'CASCADE-UNIT-001',
        unitStartBlock: '100',
        unitEndBlock: '150',
        unitCount: 50,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Cascade test',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: issuanceChild.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Cascade Label',
      });
      const unitLabel = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustLabelId: label.cadTrustLabelId,
        cadTrustUnitId: unit.cadTrustUnitId,
      });

      const response = await supertest(app)
        .delete(`/v2/project/${project.cadTrustProjectId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.stagedChildDeletes).to.equal(15);

      const deleteRows = await StagingV2.findAll({
        where: { action: 'DELETE' },
        raw: true,
      });

      const expectedDeletes = [
        ['project', 'cad_trust_project_id', project.cadTrustProjectId],
        ['location', 'cad_trust_location_id', location.cadTrustLocationId],
        ['estimation', 'cad_trust_estimation_id', estimation.cadTrustEstimationId],
        ['rating', 'cad_trust_rating_id', rating.cadTrustRatingId],
        ['co_benefit', 'cad_trust_co_benefit_id', coBenefit.cadTrustCoBenefitId],
        ['validation', 'cad_trust_validation_id', chain.validation.cadTrustValidationId],
        ['validation', 'cad_trust_validation_id', secondaryValidation.cadTrustValidationId],
        ['verification', 'cad_trust_verification_id', verification.cadTrustVerificationId],
        ['verification', 'cad_trust_verification_id', secondaryVerification.cadTrustVerificationId],
        ['project_methodology', 'cad_trust_project_methodology_id', chain.projectMethodology.cadTrustProjectMethodologyId],
        ['project_methodology', 'cad_trust_project_methodology_id', extraProjectMethodology.cadTrustProjectMethodologyId],
        ['stakeholder_projects', 'cad_trust_stakeholder_project_id', stakeholderProject.cadTrustStakeholderProjectId],
        ['issuance', 'cad_trust_issuance_id', issuance.cadTrustIssuanceId],
        ['issuance', 'cad_trust_issuance_id', issuanceChild.cadTrustIssuanceId],
        ['unit', 'cad_trust_unit_id', unit.cadTrustUnitId],
        ['unit_label', 'cad_trust_unit_label_id', unitLabel.cadTrustUnitLabelId],
      ];

      for (const [table, key, id] of expectedDeletes) {
        const matching = deleteRows.find((row) => {
          if (row.table !== table) {
            return false;
          }
          const data = JSON.parse(row.data);
          return data[0]?.[key] === id;
        });
        expect(matching, `missing staged delete for ${table}:${id}`).to.exist;
      }
    });

    it('should stage only project delete when there are no child records', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'No Child Registry',
        projectId: 'NO-CHILD-PROJECT-001',
        projectName: 'No Child Project',
        projectSector: ['Agriculture'],
        orgUid: homeOrgId,
      }));

      const response = await supertest(app)
        .delete(`/v2/project/${project.cadTrustProjectId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.stagedChildDeletes).to.equal(0);

      const deleteRows = await StagingV2.findAll({
        where: { action: 'DELETE' },
      });
      expect(deleteRows).to.have.lengthOf(1);
      expect(deleteRows[0].table).to.equal('project');
    });

    it('should create duplicate staging rows on double delete before commit', async function () {
      await waitForV2DataLayerSync();
      const homeOrgId = await getV2HomeOrgId();
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Double Delete Registry',
        projectId: 'DOUBLE-DEL-001',
        projectName: 'Double Delete Project',
        orgUid: homeOrgId,
      }));

      const location = await LocationV2.create({
        cadTrustLocationId: uuidv4(),
        locationCountry: 'US',
        cadTrustProjectId: project.cadTrustProjectId,
      });

      const res1 = await supertest(app)
        .delete(`/v2/project/${project.cadTrustProjectId}`)
        .expect(200);
      expect(res1.body.success).to.be.true;
      expect(res1.body.stagedChildDeletes).to.equal(1);

      const res2 = await supertest(app)
        .delete(`/v2/project/${project.cadTrustProjectId}`)
        .expect(200);
      expect(res2.body.success).to.be.true;
      expect(res2.body.stagedChildDeletes).to.equal(1);

      const deleteRows = await StagingV2.findAll({
        where: { action: 'DELETE', table: 'project' },
      });
      expect(deleteRows).to.have.lengthOf(2);
    });

    it('should cascade multiple units per issuance', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const chain = await createV2TestProgramChain({ testId: 'MULTI-UNIT-001' });

      const unit1 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'MULTI-UNIT-A',
        unitStartBlock: '1',
        unitEndBlock: '50',
        unitCount: 50,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: chain.issuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const unit2 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'MULTI-UNIT-B',
        unitStartBlock: '51',
        unitEndBlock: '100',
        unitCount: 50,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: chain.issuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Multi-Unit Label',
      });

      const unitLabel1 = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: unit1.cadTrustUnitId,
        cadTrustLabelId: label.cadTrustLabelId,
      });

      const unitLabel2a = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: unit2.cadTrustUnitId,
        cadTrustLabelId: label.cadTrustLabelId,
      });

      const response = await supertest(app)
        .delete(`/v2/project/${chain.project.cadTrustProjectId}`)
        .expect(200);

      expect(response.body.success).to.be.true;

      const deleteRows = await StagingV2.findAll({
        where: { action: 'DELETE' },
        raw: true,
      });

      const unitDeletes = deleteRows.filter((r) => r.table === 'unit');
      const unitLabelDeletes = deleteRows.filter((r) => r.table === 'unit_label');

      expect(unitDeletes).to.have.lengthOf(2);
      expect(unitLabelDeletes).to.have.lengthOf(2);

      for (const [table, key, id] of [
        ['unit', 'cad_trust_unit_id', unit1.cadTrustUnitId],
        ['unit', 'cad_trust_unit_id', unit2.cadTrustUnitId],
        ['unit_label', 'cad_trust_unit_label_id', unitLabel1.cadTrustUnitLabelId],
        ['unit_label', 'cad_trust_unit_label_id', unitLabel2a.cadTrustUnitLabelId],
      ]) {
        const matching = deleteRows.find((row) => {
          if (row.table !== table) return false;
          const data = JSON.parse(row.data);
          return data[0]?.[key] === id;
        });
        expect(matching, `missing staged delete for ${table}:${id}`).to.exist;
      }
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
      it('should stage INSERT for a new project from XLSX', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const newProjectId = uuidv4();
        const testData = [
          ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName', 'projectSector', 'projectType', 'projectStatus', 'projectUnitMetric'],
          [newProjectId, 'Test Registry', 'XLSX-001', 'XLSX Test Project', '["Agriculture"]', '["Landfill gas"]', 'Listed', 'tCO2e'],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'projects', data: testData }]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('Updates from xlsx added to staging');

        // Verify a staging record was actually created
        const stagingRecords = await StagingV2.findAll({
          where: { table: 'project' },
        });
        expect(stagingRecords.length).to.be.at.least(1);

        const record = stagingRecords.find((r) => r.uuid === newProjectId);
        expect(record).to.exist;
        expect(record.action).to.equal('INSERT');

        const data = JSON.parse(record.data);
        expect(data[0].project_name).to.equal('XLSX Test Project');
      });

      it('should stage UPDATE for an existing project from XLSX', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;

        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Original Registry',
          projectId: 'XLSX-UPD-001',
          projectName: 'Original Name',
          projectSector: ['Agriculture'],
          orgUid: homeOrgId,
        }));

        const testData = [
          ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName', 'projectSector', 'projectUnitMetric'],
          [project.cadTrustProjectId, 'Updated Registry', 'XLSX-UPD-001', 'Updated Name', '["Energy"]', 'tCO2e'],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'projects', data: testData }]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;

        const stagingRecords = await StagingV2.findAll({
          where: { table: 'project', uuid: project.cadTrustProjectId },
        });
        expect(stagingRecords.length).to.equal(1);
        expect(stagingRecords[0].action).to.equal('UPDATE');

        const data = JSON.parse(stagingRecords[0].data);
        expect(data[0].project_name).to.equal('Updated Name');
      });

      it('should accept singular sheet name "project"', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const newProjectId = uuidv4();
        const testData = [
          ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName'],
          [newProjectId, 'Singular Sheet', 'SING-001', 'Singular Test'],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'project', data: testData }]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;

        const record = await StagingV2.findOne({
          where: { table: 'project', uuid: newProjectId },
        });
        expect(record).to.exist;
        expect(record.action).to.equal('INSERT');
      });

      it('should return error if no file is provided', async function () {
        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('File Not Received');
      });

      it('should import multi-sheet XLSX with project + locations + estimations', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const projectId = uuidv4();
        const locationId = uuidv4();
        const estimationId = uuidv4();

        const xlsxBuffer = xlsx.build([
          {
            name: 'projects',
            data: [
              ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName', 'projectSector'],
              [projectId, 'Multi Sheet Registry', 'MULTI-001', 'Multi Sheet Project', '["Agriculture"]'],
            ],
          },
          {
            name: 'locations',
            data: [
              ['cadTrustLocationId', 'locationCountry', 'locationRegion', 'cadTrustProjectId'],
              [locationId, 'US', 'California', projectId],
            ],
          },
          {
            name: 'estimations',
            data: [
              ['cadTrustEstimationId', 'estimationUnitCount', 'estimationStartDate', 'estimationEndDate', 'cadTrustProjectId'],
              [estimationId, '5000', '2024-01-01', '2024-12-31', projectId],
            ],
          },
        ]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;

        const projectStaging = await StagingV2.findOne({
          where: { table: 'project', uuid: projectId },
        });
        expect(projectStaging).to.exist;
        expect(projectStaging.action).to.equal('INSERT');
        const projectData = JSON.parse(projectStaging.data);
        expect(projectData[0].project_name).to.equal('Multi Sheet Project');

        const locationStaging = await StagingV2.findOne({
          where: { table: 'location', uuid: locationId },
        });
        expect(locationStaging).to.exist;
        expect(locationStaging.action).to.equal('INSERT');
        const locationData = JSON.parse(locationStaging.data);
        expect(locationData[0].location_country).to.equal('US');
        expect(locationData[0].location_region).to.equal('California');

        const estimationStaging = await StagingV2.findOne({
          where: { table: 'estimation', uuid: estimationId },
        });
        expect(estimationStaging).to.exist;
        expect(estimationStaging.action).to.equal('INSERT');
        const estimationData = JSON.parse(estimationStaging.data);
        expect(estimationData[0].estimation_unit_count).to.equal('5000');
      });

      it('should handle XLSX with empty data rows gracefully', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const xlsxBuffer = xlsx.build([
          {
            name: 'projects',
            data: [
              ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName'],
            ],
          },
        ]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;
        const records = await StagingV2.findAll({ where: { table: 'project' } });
        expect(records).to.have.lengthOf(0);
      });

      it('should skip unrecognized sheet names without error', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const projectId = uuidv4();

        const xlsxBuffer = xlsx.build([
          {
            name: 'projects',
            data: [
              ['cadTrustProjectId', 'projectRegistryName', 'projectId', 'projectName'],
              [projectId, 'Test', 'UNKNOWN-001', 'Valid Project'],
            ],
          },
          {
            name: 'foobar',
            data: [
              ['col1', 'col2'],
              ['val1', 'val2'],
            ],
          },
        ]);

        const response = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;
        const record = await StagingV2.findOne({
          where: { table: 'project', uuid: projectId },
        });
        expect(record).to.exist;
      });

      it('should round-trip: export then re-import produces matching staging records', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsxLib = xlsxModule.default || xlsxModule;

        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'RT Registry',
          projectId: 'RT-001',
          projectName: 'Round Trip Project',
          projectSector: ['Agriculture'],
          projectType: ['Forestry'],
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: homeOrgId,
        }));

        await LocationV2.create({
          cadTrustLocationId: uuidv4(),
          locationCountry: 'DE',
          locationRegion: 'Bavaria',
          cadTrustProjectId: project.cadTrustProjectId,
        });

        const exportResponse = await supertest(app)
          .get('/v2/project')
          .query({ xls: 'true' })
          .buffer(true)
          .parse((res, callback) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => callback(null, Buffer.concat(chunks)));
          })
          .expect(200);

        const importResponse = await supertest(app)
          .put('/v2/project/xlsx')
          .attach('xlsx', exportResponse.body, 'roundtrip.xlsx')
          .expect(200);

        expect(importResponse.body.success).to.be.true;

        const stagingRecords = await StagingV2.findAll({
          where: { table: 'project', uuid: project.cadTrustProjectId },
        });
        expect(stagingRecords).to.have.lengthOf(1);
        expect(stagingRecords[0].action).to.equal('UPDATE');

        const data = JSON.parse(stagingRecords[0].data);
        expect(data[0].project_name).to.equal('Round Trip Project');
        expect(data[0].project_registry_name).to.equal('RT Registry');
      });
    });

    describe('POST /v2/project/batch', function () {
      it('should batch upload new projects from CSV file (INSERT) with snake_case staging data and counts', async function () {
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
        expect(response.body.stagedCount).to.equal(2);
        expect(response.body.errorCount).to.equal(0);

        const stagingRecords = await StagingV2.findAll({
          where: { table: 'project', action: 'INSERT' },
        });

        expect(stagingRecords.length).to.equal(2);

        const data = JSON.parse(stagingRecords[0].data)[0];
        expect(data).to.have.property('project_registry_name');
        expect(data).to.have.property('project_name');
        expect(data).to.have.property('org_uid');
      });

      it('should batch update existing projects from CSV file (UPDATE) and merge with existing data', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const project1 = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'CSV-UPDATE-001',
          projectName: 'Original Name 1',
          projectSector: ['Agriculture'],
          projectType: ['Landfill gas'],
          projectStatus: 'Listed',
          projectUnitMetric: 'tCO2e',
          projectDescription: 'Original description that should be preserved',
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

        // CSV only updates projectName — other fields should be merged from DB
        const csvContent = `cadTrustProjectId,projectName
${project1.cadTrustProjectId},Updated Name 1
${project2.cadTrustProjectId},Updated Name 2`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('CSV processing complete');

        const stagingRecords = await StagingV2.findAll({
          where: { table: 'project', action: 'UPDATE' },
        });

        expect(stagingRecords.length).to.be.at.least(2);

        // Verify merge: staged data should contain ALL project fields
        const staged1 = stagingRecords.find(r => r.uuid === project1.cadTrustProjectId);
        expect(staged1).to.exist;
        const data1 = JSON.parse(staged1.data)[0];
        expect(data1.project_name).to.equal('Updated Name 1');
        // Fields NOT in CSV should be preserved from the DB
        expect(data1.project_registry_name).to.equal('Test Registry');
        expect(data1.project_description).to.equal('Original description that should be preserved');
        expect(data1.project_unit_metric).to.equal('tCO2e');
        expect(data1.org_uid).to.equal(homeOrgId);
      });

      it('should return error if no CSV file is provided', async function () {
        const response = await supertest(app)
          .post('/v2/project/batch')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('Cannot find the required csv file');
      });

      it('should reject UPDATE for project belonging to another org (400 when all rows fail)', async function () {
        const otherOrgProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Other Org Registry',
          projectId: 'OTHER-ORG-001',
          projectName: 'Other Org Project',
          orgUid: 'other-org-uid-12345',
        }));

        const csvContent = `cadTrustProjectId,projectName
${otherOrgProject.cadTrustProjectId},Should Not Update`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.stagedCount).to.equal(0);
        expect(response.body.errorCount).to.equal(1);
        expect(response.body.errors[0].error).to.include('belongs to a different organization');

        const staged = await StagingV2.findAll({ where: { uuid: otherOrgProject.cadTrustProjectId } });
        expect(staged).to.have.lengthOf(0);
      });

      it('should handle duplicate PK in same CSV gracefully (upsert)', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'DUP-001',
          projectName: 'Duplicate Test',
          orgUid: homeOrgId,
        }));

        // Same PK appears twice — second row should win
        const csvContent = `cadTrustProjectId,projectName
${project.cadTrustProjectId},First Update
${project.cadTrustProjectId},Second Update`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;

        const staged = await StagingV2.findAll({ where: { uuid: project.cadTrustProjectId } });
        expect(staged).to.have.lengthOf(1);
        const data = JSON.parse(staged[0].data)[0];
        expect(data.project_name).to.equal('Second Update');
      });

      it('should merge CSV updates into an already-staged project update instead of creating duplicate staged rows', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'STAGED-MERGE-001',
          projectName: 'Original Name',
          projectDescription: 'Original description',
          orgUid: homeOrgId,
        }));

        await StagingV2.create({
          uuid: uuidv4(),
          table: 'project',
          action: 'UPDATE',
          data: JSON.stringify([{
            cad_trust_project_id: project.cadTrustProjectId,
            project_description: 'Already staged description',
          }]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        const csvContent = `cadTrustProjectId,projectName
${project.cadTrustProjectId},CSV Updated Name`;
        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.stagedCount).to.equal(1);

        const staged = await StagingV2.findAll({
          where: { table: 'project', committed: false, failed_commit: false },
        });
        expect(staged.filter((row) => {
          const data = JSON.parse(row.data)[0];
          return data.cad_trust_project_id === project.cadTrustProjectId;
        })).to.have.lengthOf(1);

        const merged = JSON.parse(staged[0].data)[0];
        expect(merged.project_name).to.equal('CSV Updated Name');
        expect(merged.project_description).to.equal('Already staged description');
        expect(merged.project_registry_name).to.equal('Test Registry');
      });

      it('should merge CSV updates into an already-staged project INSERT and keep it as INSERT', async function () {
        const stagedProjectId = uuidv4();
        await StagingV2.create({
          uuid: stagedProjectId,
          table: 'project',
          action: 'INSERT',
          data: JSON.stringify([{
            cad_trust_project_id: stagedProjectId,
            org_uid: await getV2HomeOrgId(),
            project_registry_name: 'Staged Registry',
            project_id: 'STAGED-INSERT-001',
            project_name: 'Staged Insert Name',
            project_description: 'Staged insert description',
          }]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        const csvContent = `cadTrustProjectId,projectName
${stagedProjectId},CSV Updated Insert Name`;
        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.stagedCount).to.equal(1);

        const staged = await StagingV2.findAll({
          where: { table: 'project', committed: false, failed_commit: false },
        });
        const matching = staged.filter((row) => {
          const data = JSON.parse(row.data)[0];
          return data.cad_trust_project_id === stagedProjectId;
        });
        expect(matching).to.have.lengthOf(1);
        expect(matching[0].action).to.equal('INSERT');

        const data = JSON.parse(matching[0].data)[0];
        expect(data.project_name).to.equal('CSV Updated Insert Name');
        expect(data.project_description).to.equal('Staged insert description');
      });

      it('should reject CSV update when the project already has a pending staged delete', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'PENDING-DELETE-001',
          projectName: 'Delete Pending Project',
          orgUid: homeOrgId,
        }));

        await StagingV2.create({
          uuid: uuidv4(),
          table: 'project',
          action: 'DELETE',
          data: JSON.stringify([{
            cad_trust_project_id: project.cadTrustProjectId,
          }]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        const csvContent = `cadTrustProjectId,projectName
${project.cadTrustProjectId},Should Fail`;
        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.stagedCount).to.equal(0);
        expect(response.body.errorCount).to.equal(1);
        expect(response.body.errors[0].error).to.include('pending staged delete');
      });

      it('should strip unknown/child columns from staged data', async function () {
        const csvContent = `projectRegistryName,projectId,projectName,locations,estimations,foobar,cadTrustProgramId
Test Registry,STRIP-001,Strip Test,"[{""country"":""US""}]","[{""count"":100}]",garbage,${testProgram.cadTrustProgramId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;

        const staged = await StagingV2.findAll({ where: { table: 'project', action: 'INSERT' } });
        expect(staged.length).to.be.at.least(1);

        const data = JSON.parse(staged[0].data)[0];
        // Child/unknown columns must NOT appear in staged data
        expect(data).to.not.have.property('locations');
        expect(data).to.not.have.property('estimations');
        expect(data).to.not.have.property('foobar');
        // Real columns should be present
        expect(data).to.have.property('project_name', 'Strip Test');
      });

      it('should report error for non-existent cadTrustProgramId (FK check, 400 when all rows fail)', async function () {
        const csvContent = `projectRegistryName,projectId,projectName,cadTrustProgramId
Test Registry,FK-001,FK Test,non-existent-program-id`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.stagedCount).to.equal(0);
        expect(response.body.errorCount).to.equal(1);
        expect(response.body.errors[0].error).to.include('does not exist');
      });

      it('should accept cadTrustProgramId that exists only in pending staging', async function () {
        const stagedProgramId = uuidv4();
        await StagingV2.create({
          uuid: stagedProgramId,
          table: 'program',
          action: 'INSERT',
          data: JSON.stringify([{
            cad_trust_program_id: stagedProgramId,
          }]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        });

        const csvContent = `projectRegistryName,projectId,projectName,cadTrustProgramId
Test Registry,FK-STAGED-001,Uses Staged Program,${stagedProgramId}`;
        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;

        const staged = await StagingV2.findAll({ where: { table: 'project', action: 'INSERT' } });
        expect(staged).to.have.lengthOf(1);
      });

      it('should handle large batch (15+ rows) without race condition', async function () {
        const rows = [];
        for (let i = 1; i <= 15; i++) {
          rows.push(`Test Registry,RACE-${String(i).padStart(3, '0')},Race Test Project ${i},Agriculture,tCO2e,${testProgram.cadTrustProgramId}`);
        }
        const csvContent = `projectRegistryName,projectId,projectName,projectSector,projectUnitMetric,cadTrustProgramId\n${rows.join('\n')}`;
        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;

        const staged = await StagingV2.findAll({ where: { table: 'project', action: 'INSERT' } });
        expect(staged.length).to.equal(15);
      });

      it('should handle mixed INSERT + UPDATE in same CSV', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const existingProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'MIX-EXISTING',
          projectName: 'Existing Project',
          orgUid: homeOrgId,
        }));

        const csvContent = `cadTrustProjectId,projectRegistryName,projectId,projectName,cadTrustProgramId
${existingProject.cadTrustProjectId},Test Registry,MIX-EXISTING,Updated Existing,${testProgram.cadTrustProgramId}
,Test Registry,MIX-NEW,New Project,${testProgram.cadTrustProgramId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;

        const updates = await StagingV2.findAll({ where: { table: 'project', action: 'UPDATE' } });
        expect(updates.length).to.equal(1);

        const inserts = await StagingV2.findAll({ where: { table: 'project', action: 'INSERT' } });
        expect(inserts.length).to.equal(1);
      });

      it('should accept snake_case CSV headers', async function () {
        const csvContent = `project_registry_name,project_id,project_name,cad_trust_program_id
Test Registry,SNAKE-001,Snake Case Test,${testProgram.cadTrustProgramId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;

        const staged = await StagingV2.findAll({ where: { table: 'project', action: 'INSERT' } });
        expect(staged.length).to.be.at.least(1);
        const data = JSON.parse(staged[0].data)[0];
        expect(data.project_name).to.equal('Snake Case Test');
        expect(data.project_registry_name).to.equal('Test Registry');
      });

      it('should return 400 when all rows fail validation (all-rows-invalid)', async function () {
        const csvContent = `cadTrustProjectId,projectName
non-existent-id-1,Bad Project 1
non-existent-id-2,Bad Project 2`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.stagedCount).to.equal(0);
        expect(response.body.errorCount).to.equal(2);
        expect(response.body.errors).to.have.lengthOf(2);
        expect(response.body.message).to.include('No rows were staged');

        const staged = await StagingV2.findAll({ where: { table: 'project' } });
        expect(staged).to.have.lengthOf(0);
      });

      it('should reject INSERT rows missing required fields', async function () {
        // Missing projectName (required)
        const csvContent = `projectRegistryName,projectId,cadTrustProgramId
Test Registry,REQ-001,${testProgram.cadTrustProgramId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.stagedCount).to.equal(0);
        expect(response.body.errorCount).to.equal(1);
        expect(response.body.errors[0].error).to.include('Missing required field(s)');
        expect(response.body.errors[0].error).to.include('projectName');
      });

      it('should accept UPDATE rows that omit required INSERT fields (merged from DB)', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'UPD-REQ-001',
          projectName: 'Full Project',
          orgUid: homeOrgId,
        }));

        // CSV omits projectName — fine for UPDATE since it merges from DB
        const csvContent = `cadTrustProjectId,projectStatus
${project.cadTrustProjectId},Listed`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.stagedCount).to.equal(1);
        expect(response.body.errorCount).to.equal(0);
      });

      it('should return partial success with correct counts for mixed valid/invalid rows', async function () {
        // Row 1: valid INSERT, Row 2: bad FK
        const csvContent = `projectRegistryName,projectId,projectName,cadTrustProgramId
Test Registry,PARTIAL-001,Valid Project,${testProgram.cadTrustProgramId}
Test Registry,PARTIAL-002,Invalid FK Project,non-existent-program-id`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.stagedCount).to.equal(1);
        expect(response.body.errorCount).to.equal(1);
        expect(response.body.errors).to.have.lengthOf(1);
        expect(response.body.message).to.include('1 row(s) staged');
        expect(response.body.message).to.include('1 row(s) skipped');

        const staged = await StagingV2.findAll({ where: { table: 'project', action: 'INSERT' } });
        expect(staged).to.have.lengthOf(1);
      });

      it('should return partial success when a valid update is mixed with a wrong-owner update', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const ownedProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'PARTIAL-UPD-OK',
          projectName: 'Owned Project',
          orgUid: homeOrgId,
        }));
        const otherOrgProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Other Registry',
          projectId: 'PARTIAL-UPD-BAD',
          projectName: 'Other Org Project',
          orgUid: 'other-org-uid-12345',
        }));

        const csvContent = `cadTrustProjectId,projectName
${ownedProject.cadTrustProjectId},Updated Owned Project
${otherOrgProject.cadTrustProjectId},Should Fail`;
        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.stagedCount).to.equal(1);
        expect(response.body.errorCount).to.equal(1);
        expect(response.body.errors[0].error).to.include('belongs to a different organization');

        const staged = await StagingV2.findAll({ where: { table: 'project', action: 'UPDATE' } });
        expect(staged).to.have.lengthOf(1);
        expect(staged[0].uuid).to.equal(ownedProject.cadTrustProjectId);
      });

      it('should upsert over existing staging record on re-upload', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'REUPL-001',
          projectName: 'Original',
          orgUid: homeOrgId,
        }));

        // First upload
        let csvContent = `cadTrustProjectId,projectName
${project.cadTrustProjectId},First Upload`;
        let csvBuffer = Buffer.from(csvContent, 'utf8');

        await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        // Second upload of same PK
        csvContent = `cadTrustProjectId,projectName
${project.cadTrustProjectId},Second Upload`;
        csvBuffer = Buffer.from(csvContent, 'utf8');

        await supertest(app)
          .post('/v2/project/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        // Should have exactly 1 staging record (upsert, not duplicate)
        const staged = await StagingV2.findAll({ where: { uuid: project.cadTrustProjectId } });
        expect(staged).to.have.lengthOf(1);
        const data = JSON.parse(staged[0].data)[0];
        expect(data.project_name).to.equal('Second Upload');
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

      it('should filter projects by orgUid=me', async function () {
        await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'ME-PROJ-001',
          projectName: 'My Project',
          projectSector: ['Agriculture'],
          projectType: ['Landfill gas'],
          projectStatus: 'Listed',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: 'test-home-org-v2',
        }));
        await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
          projectRegistryName: 'Test Registry',
          projectId: 'OTHER-PROJ-001',
          projectName: 'Other Project',
          projectSector: ['Agriculture'],
          projectType: ['Landfill gas'],
          projectStatus: 'Listed',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: testProgram.cadTrustProgramId,
          orgUid: 'other-org',
        }));

        const response = await supertest(app)
          .get('/v2/project')
          .query({ orgUid: 'me', page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
        response.body.data.forEach(project => {
          expect(project.orgUid).to.equal('test-home-org-v2');
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
        const response = await supertest(app)
          .get('/v2/project')
          .query({ xls: 'true' })
          .expect(200);

        expect(response.headers['content-disposition']).to.include('attachment');
        expect(response.headers['content-disposition']).to.include('.xlsx');
        expect(response.headers['content-type']).to.exist;
      });

      it('should export XLSX with correct sheet names, columns, and row data', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsxLib = xlsxModule.default || xlsxModule;

        const response = await supertest(app)
          .get('/v2/project')
          .query({ xls: 'true' })
          .buffer(true)
          .parse((res, callback) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => callback(null, Buffer.concat(chunks)));
          })
          .expect(200);

        const parsed = xlsxLib.parse(response.body);
        const sheetNames = parsed.map((s) => s.name);
        expect(sheetNames).to.include('projects');

        const mainSheet = parsed.find((s) => s.name === 'projects');
        const headers = mainSheet.data[0];

        expect(headers).to.include('cadTrustProjectId');
        expect(headers).to.include('projectName');
        expect(headers).to.include('projectRegistryName');
        expect(headers).to.include('projectId');

        const dbProjects = await ProjectV2.findAll({ raw: true });
        const dataRows = mainSheet.data.slice(1);
        expect(dataRows.length).to.equal(dbProjects.length);

        const projectNameIdx = headers.indexOf('projectName');
        const exportedNames = dataRows.map((r) => r[projectNameIdx]).sort();
        const dbNames = dbProjects.map((p) => p.projectName).sort();
        expect(exportedNames).to.deep.equal(dbNames);

        const pkIdx = headers.indexOf('cadTrustProjectId');
        for (const dbProject of dbProjects) {
          const row = dataRows.find((r) => r[pkIdx] === dbProject.cadTrustProjectId);
          expect(row, `Row for project ${dbProject.cadTrustProjectId} not found`).to.exist;
          const registryIdx = headers.indexOf('projectRegistryName');
          expect(row[registryIdx]).to.equal(dbProject.projectRegistryName);
        }
      });

      it('should export XLSX with child sheets when children exist', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsxLib = xlsxModule.default || xlsxModule;

        const projects = await ProjectV2.findAll({ limit: 1 });
        const project = projects[0];

        await LocationV2.create({
          cadTrustLocationId: uuidv4(),
          locationCountry: 'US',
          locationRegion: 'California',
          cadTrustProjectId: project.cadTrustProjectId,
        });
        await EstimationV2.create({
          cadTrustEstimationId: uuidv4(),
          estimationUnitCount: 5000,
          estimationStartDate: '2024-01-01',
          estimationEndDate: '2024-12-31',
          cadTrustProjectId: project.cadTrustProjectId,
        });

        const response = await supertest(app)
          .get('/v2/project')
          .query({ xls: 'true' })
          .buffer(true)
          .parse((res, callback) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => callback(null, Buffer.concat(chunks)));
          })
          .expect(200);

        const parsed = xlsxLib.parse(response.body);
        const sheetNames = parsed.map((s) => s.name);
        expect(sheetNames).to.include('projects');
        expect(sheetNames).to.include('locations');
        expect(sheetNames).to.include('estimations');

        const locSheet = parsed.find((s) => s.name === 'locations');
        expect(locSheet.data.length).to.be.at.least(2);
        const locHeaders = locSheet.data[0];
        expect(locHeaders).to.include('locationCountry');

        const countryIdx = locHeaders.indexOf('locationCountry');
        const locRow = locSheet.data[1];
        expect(locRow[countryIdx]).to.equal('US');

        const estSheet = parsed.find((s) => s.name === 'estimations');
        expect(estSheet.data.length).to.be.at.least(2);
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
        await supertest(app)
          .get('/v2/project')
          .query({ filter: ['field:value:eq', 'field2:value2:eq'], page: 1, limit: 10 })
          .expect(400);
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
        await supertest(app)
          .get('/v2/project')
          .query({ order: ['projectName:ASC', 'projectName:DESC'], page: 1, limit: 10 })
          .expect(400);
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
