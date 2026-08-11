import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  ProjectMethodologyV2,
  ProjectV2,
  ProgramV2,
  MethodologyV2,
  StagingV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
} from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId, addUuidIfNeeded } from '../utils/v2-test-helpers.js';

describe('Project-Methodology V2 Join Table Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testProjectId;
  let testProgramId;
  let testMethodologyId;
  let homeOrgId;

  before(async function () {
    console.log('Setting up Project-Methodology V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for Project-Methodology',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-PROJMETH-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for Project-Methodology',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-PROJMETH-001',
      projectSector: ['Energy industries (renewable-/ non renewable sources)'],
      projectType: ['Energy efficiency'],
      projectStatus: 'Registered',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgramId,
    });
    testProjectId = project.cadTrustProjectId;

    // Create test methodology
    const methodology = await MethodologyV2.create({
      cadTrustMethodologyId: uuidv4(),
      methodologyName: 'Test Methodology for Project-Methodology',
      methodologyCode: 'TEST-METH-001',
      methodologyType: 'Methodology for energy efficiency',
      methodologyDescription: 'Test methodology description',
    });
    testMethodologyId = methodology.cadTrustMethodologyId;
  });

  after(async function () {
    console.log('Project-Methodology V2 test cleanup completed');
  });

  describe('Project-Methodology Validation Tests', function () {
    it('should reject project-methodology with missing required fields', async function () {
      try {
        await ProjectMethodologyV2.create({
          // Missing cadTrustProjectMethodologyId, cadTrustProjectId, cadTrustMethodologyId
          projectMethodologyDate: '2024-01-01',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should accept project-methodology with optional fields null', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Null Test',
        methodologyCode: 'TEST-METH-NULL-001',
        methodologyType: 'Methodology for null test',
        methodologyDescription: 'Test methodology description for null test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: null,
        projectMethodologyDescription: null,
      };

      const projectMethodology = await ProjectMethodologyV2.create(projectMethodologyData);

      expect(projectMethodology).to.exist;
      expect(projectMethodology.projectMethodologyDate).to.be.null;
      expect(projectMethodology.projectMethodologyDescription).to.be.null;
    });
  });

  describe('Project-Methodology Foreign Key Tests', function () {
    it('should accept project-methodology with valid foreign keys', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Valid FK Test',
        methodologyCode: 'TEST-METH-VALIDFK-001',
        methodologyType: 'Methodology for valid FK test',
        methodologyDescription: 'Test methodology description for valid FK test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
      };

      const projectMethodology = await ProjectMethodologyV2.create(projectMethodologyData);

      expect(projectMethodology).to.exist;
      expect(projectMethodology.cadTrustProjectId).to.equal(testProjectId);
      expect(projectMethodology.cadTrustMethodologyId).to.equal(newMethodology.cadTrustMethodologyId);
    });
  });

  describe('Project-Methodology Association Tests', function () {
    it('should load project-methodology with project and methodology associations', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Association Test',
        methodologyCode: 'TEST-METH-ASSOC-001',
        methodologyType: 'Methodology for association test',
        methodologyDescription: 'Test methodology description for association test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-06-15',
        projectMethodologyDescription: 'Test association relationship',
      };

      const projectMethodologyId = uuidv4();
      const projectMethodologyDataWithId = {
        ...projectMethodologyData,
        cadTrustProjectMethodologyId: projectMethodologyId,
      };
      const createdProjectMethodology = await ProjectMethodologyV2.create(projectMethodologyDataWithId);

      const projectMethodologyWithAssociations = await ProjectMethodologyV2.findOne({
        where: {
          cadTrustProjectMethodologyId: projectMethodologyId,
        },
        include: [
          {
            model: ProjectV2,
            as: 'project',
            attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
          },
          {
            model: MethodologyV2,
            as: 'methodology',
            attributes: ['cadTrustMethodologyId', 'methodologyName', 'methodologyCode'],
          },
        ],
      });

      expect(projectMethodologyWithAssociations).to.exist;
      expect(projectMethodologyWithAssociations.project).to.exist;
      expect(projectMethodologyWithAssociations.project.cadTrustProjectId).to.equal(testProjectId);
      expect(projectMethodologyWithAssociations.project.projectName).to.equal('Test Project for Project-Methodology');
      expect(projectMethodologyWithAssociations.methodology).to.exist;
      expect(projectMethodologyWithAssociations.methodology.cadTrustMethodologyId).to.equal(newMethodology.cadTrustMethodologyId);
      expect(projectMethodologyWithAssociations.methodology.methodologyName).to.equal('Test Methodology for Association Test');
    });
  });

  describe('Project-Methodology Primary Key Tests', function () {
    it('should enforce uniqueness of primary key', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Uniqueness Test',
        methodologyCode: 'TEST-METH-UNIQUE-001',
        methodologyType: 'Methodology for uniqueness test',
        methodologyDescription: 'Test methodology description for uniqueness test',
      });

      const projectMethodologyId = uuidv4();
      const projectMethodologyData = {
        cadTrustProjectMethodologyId: projectMethodologyId,
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-07-15',
        projectMethodologyDescription: 'First relationship',
      };

      // Create first relationship
      await ProjectMethodologyV2.create(projectMethodologyData);

      // Try to create duplicate with same UUID (should fail)
      try {
        await ProjectMethodologyV2.create(projectMethodologyData);
        expect.fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeUniqueConstraintError');
      }
    });

    it('should allow same project with different methodologies', async function () {
      // Create two different methodologies for this test
      const methodology1 = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology 1',
        methodologyCode: 'TEST-METH-DIFF1-001',
        methodologyType: 'Methodology type 1',
        methodologyDescription: 'Test methodology description 1',
      });

      const methodology2 = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology 2',
        methodologyCode: 'TEST-METH-DIFF2-001',
        methodologyType: 'Methodology type 2',
        methodologyDescription: 'Test methodology description 2',
      });

      const projectMethodologyData1 = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: methodology1.cadTrustMethodologyId,
        projectMethodologyDate: '2024-08-15',
        projectMethodologyDescription: 'First methodology',
      };

      const projectMethodologyData2 = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: methodology2.cadTrustMethodologyId,
        projectMethodologyDate: '2024-08-16',
        projectMethodologyDescription: 'Second methodology',
      };

      const projectMethodology1 = await ProjectMethodologyV2.create(projectMethodologyData1);
      const projectMethodology2 = await ProjectMethodologyV2.create(projectMethodologyData2);

      expect(projectMethodology1.cadTrustProjectId).to.equal(projectMethodology2.cadTrustProjectId);
      expect(projectMethodology1.cadTrustMethodologyId).to.not.equal(projectMethodology2.cadTrustMethodologyId);
    });

    it('should allow same methodology with different projects', async function () {
      // Create another project
      const anotherProject = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectName: 'Another Test Project',
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-PROJMETH-002',
        projectSector: ['Energy industries (renewable-/ non renewable sources)'],
        projectType: ['Energy efficiency'],
        projectStatus: 'Registered',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgramId,
      });

      // Create a new methodology for this test
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Different Projects',
        methodologyCode: 'TEST-METH-DIFFPROJ-001',
        methodologyType: 'Methodology for different projects',
        methodologyDescription: 'Test methodology description for different projects',
      });

      const projectMethodologyData1 = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-09-15',
        projectMethodologyDescription: 'First project',
      };

      const projectMethodologyData2 = {
        cadTrustProjectId: anotherProject.cadTrustProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-09-16',
        projectMethodologyDescription: 'Second project',
      };

      const projectMethodology1 = await ProjectMethodologyV2.create(projectMethodologyData1);
      const projectMethodology2 = await ProjectMethodologyV2.create(projectMethodologyData2);

      expect(projectMethodology1.cadTrustProjectId).to.not.equal(projectMethodology2.cadTrustProjectId);
      expect(projectMethodology1.cadTrustMethodologyId).to.equal(projectMethodology2.cadTrustMethodologyId);
    });
  });

  describe('Project-Methodology Edge Cases', function () {
    it('should handle long descriptions', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Long Description',
        methodologyCode: 'TEST-METH-LONG-001',
        methodologyType: 'Methodology for long description',
        methodologyDescription: 'Test methodology description for long description',
      });

      const longDescription = 'A'.repeat(10000); // Maximum length
      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDescription: longDescription,
      };

      const projectMethodology = await ProjectMethodologyV2.create(projectMethodologyData);

      expect(projectMethodology.projectMethodologyDescription).to.equal(longDescription);
      expect(projectMethodology.projectMethodologyDescription).to.have.length(10000);
    });

    it('should handle various date formats', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Date Format',
        methodologyCode: 'TEST-METH-DATE-001',
        methodologyType: 'Methodology for date format',
        methodologyDescription: 'Test methodology description for date format',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-12-31',
      };

      const projectMethodology = await ProjectMethodologyV2.create(projectMethodologyData);

      expect(projectMethodology.projectMethodologyDate).to.equal('2024-12-31');
    });
  });

  describe('GET /v2/project-methodology/:cadTrustProjectMethodologyId', function () {
    it('should return timestamp fields in camelCase only', async function () {
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Timestamp API Test',
        methodologyCode: 'TEST-METH-TIMESTAMP-001',
        methodologyType: 'Methodology for timestamp API test',
      });

      const projectMethodology = await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      });

      const response = await supertest(app)
        .get(`/v2/project-methodology/${projectMethodology.cadTrustProjectMethodologyId}`)
        .expect(200);

      expect(response.body.createdAt).to.exist;
      expect(response.body.updatedAt).to.exist;
      expect(response.body).to.not.have.property('created_at');
      expect(response.body).to.not.have.property('updated_at');
    });
  });

  describe('POST /v2/project-methodology (Create)', function () {
    it('should create a new project-methodology relationship via API', async function () {
      // Create a new methodology for this test to avoid conflicts with previous tests
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for API Test',
        methodologyCode: 'TEST-METH-API-001',
        methodologyType: 'Methodology for API test',
        methodologyDescription: 'Test methodology description for API test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
        projectMethodologyDescription: 'API Test Project-Methodology Relationship',
      };

      const response = await supertest(app)
        .post('/v2/project-methodology')
        .send(projectMethodologyData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Project-Methodology relationship staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('project_methodology');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_project_id).to.equal(testProjectId);
      expect(stagedData[0].cad_trust_methodology_id).to.equal(newMethodology.cadTrustMethodologyId);
      expect(stagedData[0].project_methodology_date).to.equal('2024-01-01');
      expect(stagedData[0].project_methodology_description).to.equal('API Test Project-Methodology Relationship');
    });

    it('should reject project-methodology with invalid cadTrustProjectId (non-existent)', async function () {
      const projectMethodologyData = {
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999',
        cadTrustMethodologyId: testMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/project-methodology')
        .send(projectMethodologyData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject project-methodology with missing required fields', async function () {
      const invalidData = {
        cadTrustProjectId: testProjectId,
        // Missing cadTrustMethodologyId
      };

      const response = await supertest(app)
        .post('/v2/project-methodology')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustMethodologyId');
    });
  });

  describe('PUT /v2/project-methodology/:cadTrustProjectMethodologyId (Update)', function () {
    let createdProjectId;
    let createdMethodologyId;
    let createdProjectMethodologyId;

    before(async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Update Test',
        methodologyCode: 'TEST-METH-UPDATE-001',
        methodologyType: 'Methodology for update test',
        methodologyDescription: 'Test methodology description for update test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      };

      const response = await supertest(app)
        .post('/v2/project-methodology')
        .send(projectMethodologyData);

      createdProjectId = testProjectId;
      createdMethodologyId = newMethodology.cadTrustMethodologyId;
      createdProjectMethodologyId = response.body.uuid || response.body.cadTrustProjectMethodologyId;

      if (!createdProjectMethodologyId) {
        throw new Error('Failed to create project-methodology relationship for update test');
      }

      const stagingUuid = response.body.uuid || response.body.cadTrustProjectMethodologyId;
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: stagingUuid },
      });
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await ProjectMethodologyV2.create({
          cadTrustProjectMethodologyId: createdProjectMethodologyId,
          cadTrustProjectId: createdProjectId,
          cadTrustMethodologyId: createdMethodologyId,
          projectMethodologyDate: '2024-01-01',
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should update a project-methodology relationship via API', async function () {
      const updateData = {
        cadTrustProjectId: createdProjectId,
        cadTrustMethodologyId: createdMethodologyId,
        projectMethodologyDate: '2024-12-31',
        projectMethodologyDescription: 'Updated Description',
      };

      const response = await supertest(app)
        .put(`/v2/project-methodology/${createdProjectMethodologyId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Project-Methodology relationship update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/project-methodology/:cadTrustProjectMethodologyId (Delete)', function () {
    let createdProjectId;
    let createdMethodologyId;
    let createdProjectMethodologyId;

    before(async function () {
      // Clean up any existing project-methodology relationships for test isolation
      await ProjectMethodologyV2.destroy({ where: { cadTrustProjectId: testProjectId, cadTrustMethodologyId: testMethodologyId } });
      await StagingV2.destroy({ where: { table: 'project_methodology' } });

      // Create record directly in main table for DELETE test
      createdProjectId = testProjectId;
      createdMethodologyId = testMethodologyId;
      createdProjectMethodologyId = uuidv4();

      await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: createdProjectMethodologyId,
        cadTrustProjectId: createdProjectId,
        cadTrustMethodologyId: createdMethodologyId,
      });
    });

    it('should return 409 when issuance still references project-methodology', async function () {
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: `VAL-PM-GUARD-${uuidv4().slice(0, 8)}`,
        validationType: 'Validation of Project Design Document',
        validationBody: 'Guard validator',
        cadTrustProjectId: testProjectId,
      }));
      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: `VER-PM-GUARD-${uuidv4().slice(0, 8)}`,
        verificationBody: 'Guard verifier',
        cadTrustProjectId: testProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));
      const pmId = uuidv4();
      await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: pmId,
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: testMethodologyId,
      });
      await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: `ISS-PM-GUARD-${uuidv4().slice(0, 8)}`,
        issuanceDate: '2024-06-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: pmId,
      }));

      const response = await supertest(app)
        .delete(`/v2/project-methodology/${pmId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.equal('Referenced records must be removed before deletion');
      expect(response.body.references).to.deep.include({ table: 'issuance', count: 1 });

      const stagingForPm = await StagingV2.findAll({
        where: { table: 'project_methodology', action: 'DELETE' },
        raw: true,
      });
      const blockedRow = stagingForPm.find((row) => {
        const data = JSON.parse(row.data);
        return data[0]?.cad_trust_project_methodology_id === pmId;
      });
      expect(blockedRow).to.be.undefined;
    });

    it('should delete a project-methodology relationship via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/project-methodology/${createdProjectMethodologyId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Project-Methodology relationship delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
