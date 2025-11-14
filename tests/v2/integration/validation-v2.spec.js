import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ValidationV2, ProjectV2, ProgramV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

// Helper to add UUID to model creation if needed
const addUuidIfNeeded = (modelName, data) => {
  const uuidFields = {
    ValidationV2: 'cadTrustValidationId',
    VerificationV2: 'cadTrustVerificationId',
    IssuanceV2: 'cadTrustIssuanceId',
    UnitV2: 'cadTrustUnitId',
    ProjectV2: 'cadTrustProjectId',
  };

  const uuidField = uuidFields[modelName];
  if (uuidField && !data[uuidField]) {
    data[uuidField] = uuidv4();
  }
  return data;
};

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
} from '../utils/v2-test-helpers.js';

describe('V2 Validation API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testProject;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create a test program and project for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Validation',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Validation',
      projectSector: 'Agriculture',
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

    // Recreate test data after cleanup
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Validation',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Validation',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    }));
  });

  describe('POST /v2/validation (Create)', function () {
    it('should create a new validation record', async function () {
      const validationData = {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        validationDate: '2024-01-01',
        validationCreditPeriodStartDate: '2024-01-01',
        validationCreditPeriodEndDate: '2024-12-31',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(validationData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Validation staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('validation');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].validation_id).to.equal('TEST-VALIDATION-001');
      expect(stagedData[0].validation_type).to.equal('Validation of Project Design Document');
      expect(stagedData[0].validation_body).to.equal('AENOR International S.A.U.');
      expect(stagedData[0].cad_trust_project_id).to.equal(testProject.cadTrustProjectId);
    });

    it('should create validation with minimal required data', async function () {
      const minimalData = {
        validationId: 'MIN-VALIDATION-001',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    // Validation tests
    it('should reject validation without required validationId', async function () {
      const invalidData = {
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('validationId');
    });

    it('should reject validation without required cadTrustProjectId', async function () {
      const invalidData = {
        validationId: 'MISSING-FK',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
    });

    it('should reject validation with invalid validationDate format', async function () {
      const invalidData = {
        validationId: 'INVALID-DATE',
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

    // Picklist validation tests
    it('should reject validation with invalid validationType (not in V2 picklist)', async function () {
      const invalidData = {
        validationId: 'INVALID-TYPE',
        cadTrustProjectId: testProject.cadTrustProjectId,
        validationType: 'InvalidType',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('validationType');
    });

    it('should accept validation with valid V2 validationType', async function () {
      const validData = {
        validationId: 'VALID-TYPE',
        cadTrustProjectId: testProject.cadTrustProjectId,
        validationType: 'Validation of Project Design Document',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject validation with invalid validationBody (not in V2 picklist)', async function () {
      const invalidData = {
        validationId: 'INVALID-BODY',
        cadTrustProjectId: testProject.cadTrustProjectId,
        validationBody: 'InvalidBody',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('validationBody');
    });

    it('should accept validation with valid V2 validationBody', async function () {
      const validData = {
        validationId: 'VALID-BODY',
        cadTrustProjectId: testProject.cadTrustProjectId,
        validationBody: 'AENOR International S.A.U.',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    // Foreign key validation tests
    it('should reject validation with invalid cadTrustProjectId', async function () {
      const invalidData = {
        validationId: 'INVALID-FK',
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('ProjectV2 does not have a record');
    });

    it('should accept validation with valid cadTrustProjectId', async function () {
      const validData = {
        validationId: 'VALID-FK',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject validation with forbidden createdAt field', async function () {
      const invalidData = {
        validationId: 'FORBIDDEN-FIELD',
        cadTrustProjectId: testProject.cadTrustProjectId,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt');
    });

    it('should reject validation with forbidden updatedAt field', async function () {
      const invalidData = {
        validationId: 'FORBIDDEN-FIELD',
        cadTrustProjectId: testProject.cadTrustProjectId,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt');
    });
  });

  describe('GET /v2/validation (List)', function () {
    it('should return empty array when no validations exist', async function () {
      const response = await supertest(app)
        .get('/v2/validation')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return validations from database with project association', async function () {
      // Create a validation directly in database
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'Database Validation',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));

      const response = await supertest(app)
        .get('/v2/validation')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].validationId).to.equal('Database Validation');
      expect(response.body[0].validationType).to.equal('Validation of Project Design Document');
      expect(response.body[0].project).to.exist;
      expect(response.body[0].project.projectName).to.equal('Test Project for Validation');
    });
  });

  describe('GET /v2/validation/:id (Get One)', function () {
    it('should return 404 for non-existent validation', async function () {
      const response = await supertest(app)
        .get('/v2/validation/999999')
        .expect(404);

      expect(response.body.message).to.equal('Validation not found');
      expect(response.body.success).to.be.false;
    });

    it('should return validation by ID with project association', async function () {
      // Create a validation directly in database
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'Get Test Validation',
        validationType: 'Validation of Post Registration Change',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));

      const response = await supertest(app)
        .get(`/v2/validation/${validation.cadTrustValidationId}`)
        .expect(200);

      expect(response.body.validationId).to.equal('Get Test Validation');
      expect(response.body.validationType).to.equal('Validation of Post Registration Change');
      expect(response.body.validationBody).to.equal('AENOR International S.A.U.');
      expect(response.body.project).to.exist;
      expect(response.body.project.projectName).to.equal('Test Project for Validation');
    });
  });

  describe('PUT /v2/validation/:id (Update)', function () {
    it('should return 404 for non-existent validation', async function () {
      const updateData = {
        validationId: 'Updated ID',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .put('/v2/validation/999999')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Validation not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage validation update', async function () {
      // Create a validation directly in database
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'Original ID',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));

      const updateData = {
        validationId: 'Updated ID',
        validationType: 'Validation of Post Registration Change',
        validationBody: 'AENOR International S.A.U.',
        validationDate: '2024-02-01',
        validationCreditPeriodStartDate: '2024-02-01',
        validationCreditPeriodEndDate: '2024-12-31',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .put(`/v2/validation/${validation.cadTrustValidationId}`)
        .send(updateData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Validation update staged successfully');
      expect(response.body.success).to.be.true;

      // Verify update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'validation',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.committed).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_validation_id).to.equal(validation.cadTrustValidationId);
      expect(stagedData[0].validation_id).to.equal('Updated ID');
      expect(stagedData[0].validation_type).to.equal('Validation of Post Registration Change');
      expect(stagedData[0].cad_trust_project_id).to.equal(testProject.cadTrustProjectId);
    });
  });

  describe('DELETE /v2/validation/:id (Delete)', function () {
    it('should return 404 for non-existent validation', async function () {
      const response = await supertest(app)
        .delete('/v2/validation/999999')
        .expect(404);

      expect(response.body.message).to.equal('Validation not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage validation deletion', async function () {
      // Create a validation directly in database
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'To Be Deleted',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));

      const response = await supertest(app)
        .delete(`/v2/validation/${validation.cadTrustValidationId}`)
        .expect(200);

      expect(response.body.message).to.equal('Validation delete staged successfully');
      expect(response.body.success).to.be.true;

      // Verify deletion was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'validation',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.committed).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_validation_id).to.equal(validation.cadTrustValidationId);
    });
  });
});
