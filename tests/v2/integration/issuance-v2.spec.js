import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, IssuanceV2, VerificationV2, MethodologyV2, ProjectV2, ValidationV2, ProgramV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
} from '../utils/v2-test-helpers.js';

describe('V2 Issuance API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testVerification;
  let testMethodology;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create a test program, project, validation, verification, and methodology for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Issuance',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const testProject = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Issuance',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    const testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));

    testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
      verificationId: 'TEST-VERIFICATION-001',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustValidationId: testValidation.cadTrustValidationId,
    }));

    testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHOD-001',
      methodologyName: 'Test Methodology for Issuance',
      methodologyType: 'Methodology for Afforestation and Reforestation',
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
      programName: 'Test Program for Issuance',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const testProject = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Issuance',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    });

    const testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));

    testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
      verificationId: 'TEST-VERIFICATION-001',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustValidationId: testValidation.cadTrustValidationId,
    }));

    testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHODOLOGY-001',
      methodologyName: 'Test Methodology for Issuance',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });
  });

  describe('POST /v2/issuance (Create)', function () {
    it('should create a new issuance record', async function () {
      const issuanceData = {
        issuanceId: 'TEST-ISSUANCE-001',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(issuanceData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Issuance staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('issuance');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].issuance_id).to.equal('TEST-ISSUANCE-001');
      expect(stagedData[0].issuance_date).to.equal('2024-01-01');
      expect(stagedData[0].cad_trust_verification_id).to.equal(testVerification.cadTrustVerificationId);
      expect(stagedData[0].cad_trust_methodology_id).to.equal(testMethodology.cadTrustMethodologyId);
    });

    it('should create issuance with minimal required data', async function () {
      const minimalData = {
        issuanceId: 'MIN-ISSUANCE-001',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    // Validation tests
    it('should reject issuance without required issuanceId', async function () {
      const invalidData = {
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('issuanceId');
    });

    it('should reject issuance without required cadTrustVerificationId', async function () {
      const invalidData = {
        issuanceId: 'MISSING-VERIFICATION-FK',
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustVerificationId');
    });

    it('should reject issuance without required cadTrustMethodologyId', async function () {
      const invalidData = {
        issuanceId: 'MISSING-METHODOLOGY-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustMethodologyId');
    });

    it('should reject issuance with invalid issuanceDate format', async function () {
      const invalidData = {
        issuanceId: 'INVALID-DATE',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
        issuanceDate: 'not-a-date',
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('issuanceDate');
    });

    // Foreign key validation tests
    it('should reject issuance with invalid cadTrustVerificationId', async function () {
      const invalidData = {
        issuanceId: 'INVALID-VERIFICATION-FK',
        cadTrustVerificationId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('VerificationV2 does not have a record');
    });

    it('should accept issuance with valid cadTrustVerificationId', async function () {
      const validData = {
        issuanceId: 'VALID-VERIFICATION-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject issuance with invalid cadTrustMethodologyId', async function () {
      const invalidData = {
        issuanceId: 'INVALID-METHODOLOGY-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: 'INVALID-METHODOLOGY-ID',
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('MethodologyV2 does not have a record');
    });

    it('should accept issuance with valid cadTrustMethodologyId', async function () {
      const validData = {
        issuanceId: 'VALID-METHODOLOGY-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject issuance with forbidden createdAt field', async function () {
      const invalidData = {
        issuanceId: 'FORBIDDEN-FIELD',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt');
    });

    it('should reject issuance with forbidden updatedAt field', async function () {
      const invalidData = {
        issuanceId: 'FORBIDDEN-FIELD',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt');
    });
  });

  describe('GET /v2/issuance (List)', function () {
    it('should return empty array when no issuances exist', async function () {
      const response = await supertest(app)
        .get('/v2/issuance')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });
  });

  describe('GET /v2/issuance/:id (Get One)', function () {
    it('should return 404 for non-existent issuance', async function () {
      const response = await supertest(app)
        .get('/v2/issuance/999999')
        .expect(404);

      expect(response.body.message).to.equal('Issuance not found');
      expect(response.body.success).to.be.false;
    });
  });

  describe('PUT /v2/issuance/:id (Update)', function () {
    it('should return 404 for non-existent issuance', async function () {
      const updateData = {
        issuanceId: 'Updated ID',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      };

      const response = await supertest(app)
        .put('/v2/issuance/999999')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Issuance not found');
      expect(response.body.success).to.be.false;
    });
  });

  describe('DELETE /v2/issuance/:id (Delete)', function () {
    it('should return 404 for non-existent issuance', async function () {
      const response = await supertest(app)
        .delete('/v2/issuance/999999')
        .expect(404);

      expect(response.body.message).to.equal('Issuance not found');
      expect(response.body.success).to.be.false;
    });
  });
});
