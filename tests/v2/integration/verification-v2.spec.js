import { expect } from 'chai';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, VerificationV2, ProjectV2, ValidationV2, ProgramV2, IssuanceV2, MethodologyV2, ProjectMethodologyV2, UnitV2, UnitLabelV2, LabelV2 } from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
} from '../utils/v2-test-helpers.js';
import { runCrudStagingSuite } from '../utils/crud-suite-factory.js';

describe('V2 Verification API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testProject;
  let testValidation;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create a test program, project, and validation for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Verification',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Verification',
      projectSector: ['Agriculture'],
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();

    // Get home org ID for test data
    const homeOrgId = await getV2HomeOrgId();

    // Recreate test data after cleanup
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Verification',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      orgUid: homeOrgId,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Verification',
      projectSector: ['Agriculture'],
      cadTrustProgramId: testProgram.cadTrustProgramId,
    }));

    testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));
  });

  runCrudStagingSuite({
    resource: 'verification',
    label: 'Verification',
    pk: 'cadTrustVerificationId',
    pkColumn: 'cad_trust_verification_id',
    missingId: '999999',
    requiredFields: ['verificationBody', 'verificationId', 'cadTrustProjectId'],
    picklists: [
      {
        field: 'verificationBody',
        invalid: 'InvalidBody',
        valid: 'AENOR International S.A.U.',
      },
    ],
    context: () => ({ testProject, testValidation }),
    validPayload: (ctx) => ({
      verificationId: 'TEST-VERIFICATION-001',
      verificationStartDate: '2024-01-01',
      verificationEndDate: '2024-12-31',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: ctx.testProject.cadTrustProjectId,
      cadTrustValidationId: ctx.testValidation.cadTrustValidationId,
    }),
    expectStagedInsert: (staged, ctx) => {
      expect(staged.verification_id).to.equal('TEST-VERIFICATION-001');
      expect(staged.verification_start_date).to.equal('2024-01-01');
      expect(staged.verification_end_date).to.equal('2024-12-31');
      expect(staged.verification_body).to.equal('AENOR International S.A.U.');
      expect(staged.cad_trust_project_id).to.equal(ctx.testProject.cadTrustProjectId);
      expect(staged.cad_trust_validation_id).to.equal(ctx.testValidation.cadTrustValidationId);
    },
    list: {
      title: 'should return verifications from database with project and validation associations',
      query: { columns: 'project,validation' },
      seed: (ctx) =>
        VerificationV2.create(addUuidIfNeeded('VerificationV2', {
          verificationId: 'Database Verification',
          verificationBody: 'AENOR International S.A.U.',
          cadTrustProjectId: ctx.testProject.cadTrustProjectId,
          cadTrustValidationId: ctx.testValidation.cadTrustValidationId,
        })),
      expectRow: (row) => {
        expect(row.verificationId).to.equal('Database Verification');
        expect(row.verificationBody).to.equal('AENOR International S.A.U.');
        expect(row.project).to.exist;
        expect(row.project.projectName).to.equal('Test Project for Verification');
        expect(row.validation).to.exist;
        expect(row.validation.validationId).to.equal('TEST-VALIDATION-001');
      },
    },
    seed: (ctx) =>
      VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'Original ID',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: ctx.testProject.cadTrustProjectId,
        cadTrustValidationId: ctx.testValidation.cadTrustValidationId,
      })),
    updatePayload: (ctx) => ({
      verificationId: 'Updated ID',
      verificationStartDate: '2024-02-01',
      verificationEndDate: '2024-11-30',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: ctx.testProject.cadTrustProjectId,
      cadTrustValidationId: ctx.testValidation.cadTrustValidationId,
    }),
    expectStagedUpdate: (staged, ctx) => {
      expect(staged.verification_id).to.equal('Updated ID');
      expect(staged.verification_start_date).to.equal('2024-02-01');
      expect(staged.verification_end_date).to.equal('2024-11-30');
      expect(staged.cad_trust_project_id).to.equal(ctx.testProject.cadTrustProjectId);
      expect(staged.cad_trust_validation_id).to.equal(ctx.testValidation.cadTrustValidationId);
    },
    expectDeleteResponse: (body) => {
      expect(body.stagedChildDeletes).to.equal(0);
    },
  });

  describe('POST /v2/verification (Create)', function () {
    it('should create verification with all required data', async function () {
      const minimalData = {
        verificationId: 'MIN-VERIFICATION-001',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    it('should reject verification with invalid verificationStartDate format', async function () {
      const invalidData = {
        verificationId: 'INVALID-DATE',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        verificationStartDate: 'not-a-date',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('verificationStartDate');
    });

    it('should reject verification with invalid verificationEndDate format', async function () {
      const invalidData = {
        verificationId: 'INVALID-DATE',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        verificationEndDate: 'not-a-date',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('verificationEndDate');
    });

    // Foreign key validation tests
    it('should reject verification with invalid cadTrustProjectId', async function () {
      const invalidData = {
        verificationId: 'INVALID-PROJECT-FK',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept verification with valid cadTrustProjectId', async function () {
      const validData = {
        verificationId: 'VALID-PROJECT-FK',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject verification with invalid cadTrustValidationId', async function () {
      const invalidData = {
        verificationId: 'INVALID-VALIDATION-FK',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustValidationId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept verification with valid cadTrustValidationId', async function () {
      const validData = {
        verificationId: 'VALID-VALIDATION-FK',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

  });

  describe('GET /v2/verification/:id (Get One)', function () {
    it('should return verification by ID with project and validation associations', async function () {
      // Create a verification directly in database
      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'Get Test Verification',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      }));

      const response = await supertest(app)
        .get(`/v2/verification/${verification.cadTrustVerificationId}?columns=project&columns=validation`)
        .expect(200);

      expect(response.body.verificationId).to.equal('Get Test Verification');
      expect(response.body.verificationBody).to.equal('AENOR International S.A.U.');
      expect(response.body.project).to.exist;
      expect(response.body.project.projectName).to.equal('Test Project for Verification');
      expect(response.body.validation).to.exist;
      expect(response.body.validation.validationId).to.equal('TEST-VALIDATION-001');
    });
  });

  describe('DELETE /v2/verification/:id (Delete)', function () {
    it('should cascade-stage issuance, unit, and unit_label deletes when deleting a verification', async function () {
      const homeOrgId = await getV2HomeOrgId();

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'VER-CASCADE-001',
        verificationBody: 'Cascade Test Verifier',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'CASCADE-METHOD-001',
        methodologyName: 'Cascade Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const projectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      }));

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'ISS-CASCADE-001',
        issuanceDate: '2024-03-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      }));

      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'VER-CASCADE-UNIT-001',
        unitStartBlock: '100',
        unitEndBlock: '200',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Verification cascade test',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Verification Cascade Label',
      });

      const unitLabel = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: unit.cadTrustUnitId,
        cadTrustLabelId: label.cadTrustLabelId,
      });

      const response = await supertest(app)
        .delete(`/v2/verification/${verification.cadTrustVerificationId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.stagedChildDeletes).to.equal(3);

      const deleteRows = await StagingV2.findAll({
        where: { action: 'DELETE' },
        raw: true,
      });

      const expectedDeletes = [
        ['verification', 'cad_trust_verification_id', verification.cadTrustVerificationId],
        ['issuance', 'cad_trust_issuance_id', issuance.cadTrustIssuanceId],
        ['unit', 'cad_trust_unit_id', unit.cadTrustUnitId],
        ['unit_label', 'cad_trust_unit_label_id', unitLabel.cadTrustUnitLabelId],
      ];

      for (const [table, key, id] of expectedDeletes) {
        const matching = deleteRows.find((row) => {
          if (row.table !== table) return false;
          const data = JSON.parse(row.data);
          return data[0]?.[key] === id;
        });
        expect(matching, `missing staged delete for ${table}:${id}`).to.exist;
      }
    });
  });
});
