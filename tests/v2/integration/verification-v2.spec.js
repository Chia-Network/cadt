import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, VerificationV2, ProjectV2, ValidationV2, ProgramV2 } from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
} from '../utils/v2-test-helpers.js';

describe('V2 Verification API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testProject;
  let testValidation;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create a test program, project, and validation for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Verification',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create({
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Verification',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    testValidation = await ValidationV2.create({
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
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
      programName: 'Test Program for Verification',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    testProject = await ProjectV2.create({
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Verification',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    testValidation = await ValidationV2.create({
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    });
  });

  describe('POST /v2/verification (Create)', function () {
    it('should create a new verification record', async function () {
      const verificationData = {
        verificationId: 'TEST-VERIFICATION-001',
        verificationStartDate: '2024-01-01',
        verificationEndDate: '2024-12-31',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(verificationData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Verification staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('verification');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.commited).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].verification_id).to.equal('TEST-VERIFICATION-001');
      expect(stagedData[0].verification_start_date).to.equal('2024-01-01');
      expect(stagedData[0].verification_end_date).to.equal('2024-12-31');
      expect(stagedData[0].verification_body).to.equal('AENOR International S.A.U.');
      expect(stagedData[0].cad_trust_project_id).to.equal(testProject.cadTrustProjectId);
      expect(stagedData[0].cad_trust_validation_id).to.equal(testValidation.cadTrustValidationId);
    });

    it('should create verification with minimal required data', async function () {
      const minimalData = {
        verificationId: 'MIN-VERIFICATION-001',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    // Validation tests
    it('should reject verification without required verificationId', async function () {
      const invalidData = {
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('verificationId');
    });

    it('should reject verification without required cadTrustProjectId', async function () {
      const invalidData = {
        verificationId: 'MISSING-FK',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
    });

    it('should reject verification with invalid verificationStartDate format', async function () {
      const invalidData = {
        verificationId: 'INVALID-DATE',
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

    // Picklist validation tests
    it('should reject verification with invalid verificationBody (not in V2 picklist)', async function () {
      const invalidData = {
        verificationId: 'INVALID-BODY',
        cadTrustProjectId: testProject.cadTrustProjectId,
        verificationBody: 'InvalidBody',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('verificationBody');
    });

    it('should accept verification with valid V2 verificationBody', async function () {
      const validData = {
        verificationId: 'VALID-BODY',
        cadTrustProjectId: testProject.cadTrustProjectId,
        verificationBody: 'AENOR International S.A.U.',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    // Foreign key validation tests
    it('should reject verification with invalid cadTrustProjectId', async function () {
      const invalidData = {
        verificationId: 'INVALID-PROJECT-FK',
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('ProjectV2 does not have a record');
    });

    it('should accept verification with valid cadTrustProjectId', async function () {
      const validData = {
        verificationId: 'VALID-PROJECT-FK',
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
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('ValidationV2 does not have a record');
    });

    it('should accept verification with valid cadTrustValidationId', async function () {
      const validData = {
        verificationId: 'VALID-VALIDATION-FK',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject verification with forbidden createdAt field', async function () {
      const invalidData = {
        verificationId: 'FORBIDDEN-FIELD',
        cadTrustProjectId: testProject.cadTrustProjectId,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt');
    });

    it('should reject verification with forbidden updatedAt field', async function () {
      const invalidData = {
        verificationId: 'FORBIDDEN-FIELD',
        cadTrustProjectId: testProject.cadTrustProjectId,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/verification')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt');
    });
  });

  describe('GET /v2/verification (List)', function () {
    it('should return empty array when no verifications exist', async function () {
      const response = await supertest(app)
        .get('/v2/verification')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return verifications from database with project and validation associations', async function () {
      // Create a verification directly in database
      const verification = await VerificationV2.create({
        verificationId: 'Database Verification',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      });

      const response = await supertest(app)
        .get('/v2/verification')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].verificationId).to.equal('Database Verification');
      expect(response.body[0].verificationBody).to.equal('AENOR International S.A.U.');
      expect(response.body[0].project).to.exist;
      expect(response.body[0].project.projectName).to.equal('Test Project for Verification');
      expect(response.body[0].validation).to.exist;
      expect(response.body[0].validation.validationId).to.equal('TEST-VALIDATION-001');
    });
  });

  describe('GET /v2/verification/:id (Get One)', function () {
    it('should return 404 for non-existent verification', async function () {
      const response = await supertest(app)
        .get('/v2/verification/999999')
        .expect(404);

      expect(response.body.message).to.equal('Verification not found');
      expect(response.body.success).to.be.false;
    });

    it('should return verification by ID with project and validation associations', async function () {
      // Create a verification directly in database
      const verification = await VerificationV2.create({
        verificationId: 'Get Test Verification',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      });

      const response = await supertest(app)
        .get(`/v2/verification/${verification.cadTrustVerificationId}`)
        .expect(200);

      expect(response.body.verificationId).to.equal('Get Test Verification');
      expect(response.body.verificationBody).to.equal('AENOR International S.A.U.');
      expect(response.body.project).to.exist;
      expect(response.body.project.projectName).to.equal('Test Project for Verification');
      expect(response.body.validation).to.exist;
      expect(response.body.validation.validationId).to.equal('TEST-VALIDATION-001');
    });
  });

  describe('PUT /v2/verification/:id (Update)', function () {
    it('should return 404 for non-existent verification', async function () {
      const updateData = {
        verificationId: 'Updated ID',
        cadTrustProjectId: testProject.cadTrustProjectId,
      };

      const response = await supertest(app)
        .put('/v2/verification/999999')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Verification not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage verification update', async function () {
      // Create a verification directly in database
      const verification = await VerificationV2.create({
        verificationId: 'Original ID',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      });

      const updateData = {
        verificationId: 'Updated ID',
        verificationStartDate: '2024-02-01',
        verificationEndDate: '2024-11-30',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      };

      const response = await supertest(app)
        .put(`/v2/verification/${verification.cadTrustVerificationId}`)
        .send(updateData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Verification update staged successfully');
      expect(response.body.success).to.be.true;

      // Verify update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'verification',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_verification_id).to.equal(verification.cadTrustVerificationId);
      expect(stagedData[0].verification_id).to.equal('Updated ID');
      expect(stagedData[0].verification_start_date).to.equal('2024-02-01');
      expect(stagedData[0].verification_end_date).to.equal('2024-11-30');
      expect(stagedData[0].cad_trust_project_id).to.equal(testProject.cadTrustProjectId);
      expect(stagedData[0].cad_trust_validation_id).to.equal(testValidation.cadTrustValidationId);
    });
  });

  describe('DELETE /v2/verification/:id (Delete)', function () {
    it('should return 404 for non-existent verification', async function () {
      const response = await supertest(app)
        .delete('/v2/verification/999999')
        .expect(404);

      expect(response.body.message).to.equal('Verification not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage verification deletion', async function () {
      // Create a verification directly in database
      const verification = await VerificationV2.create({
        verificationId: 'To Be Deleted',
        cadTrustProjectId: testProject.cadTrustProjectId,
      });

      const response = await supertest(app)
        .delete(`/v2/verification/${verification.cadTrustVerificationId}`)
        .expect(200);

      expect(response.body.message).to.equal('Verification delete staged successfully');
      expect(response.body.success).to.be.true;

      // Verify deletion was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'verification',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_verification_id).to.equal(verification.cadTrustVerificationId);
    });
  });
});
