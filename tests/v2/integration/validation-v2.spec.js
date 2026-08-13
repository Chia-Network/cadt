import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ValidationV2, ProjectV2, ProgramV2, VerificationV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
} from '../utils/v2-test-helpers.js';
import { runCrudStagingSuite } from '../utils/crud-suite-factory.js';

describe('V2 Validation API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testProject;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create a test program and project for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Validation',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Validation',
      projectSector: ['Agriculture'],
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });
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
      programName: 'Test Program for Validation',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      orgUid: homeOrgId,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Validation',
      projectSector: ['Agriculture'],
      cadTrustProgramId: testProgram.cadTrustProgramId,
    }));
  });

  runCrudStagingSuite({
    resource: 'validation',
    label: 'Validation',
    pk: 'cadTrustValidationId',
    pkColumn: 'cad_trust_validation_id',
    missingId: '999999',
    requiredFields: ['validationType', 'validationBody', 'validationId', 'cadTrustProjectId'],
    picklists: [
      {
        field: 'validationType',
        invalid: 'InvalidType',
        valid: 'Validation of Project Design Document',
      },
      {
        field: 'validationBody',
        invalid: 'InvalidBody',
        valid: 'AENOR International S.A.U.',
      },
    ],
    context: () => ({ testProject }),
    validPayload: (ctx) => ({
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      validationDate: '2024-01-01',
      validationCreditPeriodStartDate: '2024-01-01',
      validationCreditPeriodEndDate: '2024-12-31',
      cadTrustProjectId: ctx.testProject.cadTrustProjectId,
    }),
    expectStagedInsert: (staged, ctx) => {
      expect(staged.validation_id).to.equal('TEST-VALIDATION-001');
      expect(staged.validation_type).to.equal('Validation of Project Design Document');
      expect(staged.validation_body).to.equal('AENOR International S.A.U.');
      expect(staged.cad_trust_project_id).to.equal(ctx.testProject.cadTrustProjectId);
    },
    list: {
      title: 'should return validations from database with project association',
      query: { columns: 'project' },
      seed: (ctx) =>
        ValidationV2.create(addUuidIfNeeded('ValidationV2', {
          validationId: 'Database Validation',
          validationType: 'Validation of Project Design Document',
          validationBody: 'AENOR International S.A.U.',
          cadTrustProjectId: ctx.testProject.cadTrustProjectId,
        })),
      expectRow: (row) => {
        expect(row.validationId).to.equal('Database Validation');
        expect(row.validationType).to.equal('Validation of Project Design Document');
        expect(row.project).to.exist;
        expect(row.project.projectName).to.equal('Test Project for Validation');
      },
    },
    seed: (ctx) =>
      ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'Original ID',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: ctx.testProject.cadTrustProjectId,
      })),
    updatePayload: (ctx) => ({
      validationId: 'Updated ID',
      validationType: 'Validation of Post Registration Change',
      validationBody: 'AENOR International S.A.U.',
      validationDate: '2024-02-01',
      validationCreditPeriodStartDate: '2024-02-01',
      validationCreditPeriodEndDate: '2024-12-31',
      cadTrustProjectId: ctx.testProject.cadTrustProjectId,
    }),
    expectStagedUpdate: (staged, ctx) => {
      expect(staged.validation_id).to.equal('Updated ID');
      expect(staged.validation_type).to.equal('Validation of Post Registration Change');
      expect(staged.cad_trust_project_id).to.equal(ctx.testProject.cadTrustProjectId);
    },
  });

  describe('POST /v2/validation (Create)', function () {
    it('should create validation with all required data', async function () {
      const minimalData = {
        validationId: 'MIN-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    it('should reject validation with invalid validationDate format', async function () {
      const invalidData = {
        validationId: 'INVALID-DATE',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        validationDate: 'not-a-date',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('validationDate');
    });

    // Foreign key validation tests
    it('should reject validation with invalid cadTrustProjectId', async function () {
      const invalidData = {
        validationId: 'INVALID-FK',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept validation with valid cadTrustProjectId', async function () {
      const validData = {
        validationId: 'VALID-FK',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

  });

  describe('GET /v2/validation/:id (Get One)', function () {
    it('should return validation by ID with project association', async function () {
      // Create a validation directly in database
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'Get Test Validation',
        validationType: 'Validation of Post Registration Change',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));

      const response = await supertest(app)
        .get(`/v2/validation/${validation.cadTrustValidationId}?columns=project`)
        .expect(200);

      expect(response.body.validationId).to.equal('Get Test Validation');
      expect(response.body.validationType).to.equal('Validation of Post Registration Change');
      expect(response.body.validationBody).to.equal('AENOR International S.A.U.');
      expect(response.body.project).to.exist;
      expect(response.body.project.projectName).to.equal('Test Project for Validation');
    });
  });

  describe('DELETE /v2/validation/:id (Delete)', function () {
    it('should return 409 when verification still references validation', async function () {
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: `VAL-DEL-GUARD-${uuidv4().slice(0, 8)}`,
        validationType: 'Validation of Project Design Document',
        validationBody: 'Guard body',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));
      await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: `VER-VAL-GUARD-${uuidv4().slice(0, 8)}`,
        verificationBody: 'Guard verifier',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const response = await supertest(app)
        .delete(`/v2/validation/${validation.cadTrustValidationId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.equal('Referenced records must be removed before deletion');
      expect(response.body.references).to.deep.include({ table: 'verification', count: 1 });

      const stagingDelete = await StagingV2.findOne({
        where: { table: 'validation', action: 'DELETE' },
      });
      expect(stagingDelete).to.be.null;
    });
  });
});
