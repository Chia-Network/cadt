import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, UnitV2, IssuanceV2, VerificationV2, MethodologyV2, ProjectV2, ValidationV2, ProgramV2 } from '../../../src/models/v2/index.js';
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

describe('V2 Unit API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testIssuance;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create a test program, project, validation, verification, methodology, and issuance for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Unit',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Unit',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    }));

    const testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));

    const testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
      verificationId: 'TEST-VERIFICATION-001',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustValidationId: testValidation.cadTrustValidationId,
    }));

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHODOLOGY-001',
      methodologyName: 'Test Methodology for Unit',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    testIssuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
      issuanceId: 'TEST-ISSUANCE-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification.cadTrustVerificationId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
    }));
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();

    // Recreate test data after cleanup
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Unit',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Unit',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
    }));

    const testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-001',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));

    const testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
      verificationId: 'TEST-VERIFICATION-001',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustValidationId: testValidation.cadTrustValidationId,
    }));

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHODOLOGY-001',
      methodologyName: 'Test Methodology for Unit',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    testIssuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
      issuanceId: 'TEST-ISSUANCE-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification.cadTrustVerificationId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
    }));
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    await resetV2StagingTable();
  });

  describe('POST /v2/unit (Create)', function () {
    it('should create a new unit record', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100.5,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Issued and active',
        unitStatusDate: '2024-01-01',
        unitRetirementDetail: 'Retired for compliance',
        unitRetirementBeneficiary: 'Test Beneficiary',
        unitRetirementBeneficiaryId: 'BEN-001',
        unitLink: 'https://example.com/unit',
        unitMetric: 'tCO2e',
        unitCurrentOwner: 'Test Owner',
        unitItmosReferenceId: 'ITMO-001',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit staged successfully');
      expect(response.body.uuid).to.exist;

      // Verify the record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('unit');
      expect(stagingRecord.action).to.equal('INSERT');
    });

    it('should create unit with minimal data', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-MINIMAL',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit staged successfully');
    });

    it('should reject unit without required unitSerialId', async function () {
      const unitData = {
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitSerialId');
    });

    it('should reject unit without required unitStartBlock', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitStartBlock');
    });

    it('should reject unit without required unitEndBlock', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitEndBlock');
    });

    it('should reject unit without required unitVintageYear', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitVintageYear');
    });

    it('should reject unit without required cadTrustIssuanceId', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustIssuanceId');
    });

    it('should reject unit with invalid cadTrustIssuanceId (non-existent)', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent issuance
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('IssuanceV2 does not have a record');
    });

    it('should reject unit with invalid unitVintageYear format', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 'invalid-year',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitVintageYear');
    });

    it('should reject unit with invalid unitStatusDate format', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitStatusDate: 'invalid-date',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitStatusDate');
    });

    it('should reject unit with invalid unitType (not in V2 picklist)', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitType: 'Invalid Unit Type',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Unit Type does not include a valid option');
    });

    it('should accept unit with valid V2 unitType', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-VALID-TYPE',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitType: 'Avoidance - nature',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit staged successfully');
    });

    it('should reject unit with invalid unitStatus (not in V2 picklist)', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitStatus: 'Invalid Status',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Unit Status does not include a valid option');
    });

    it('should accept unit with valid V2 unitStatus', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-VALID-STATUS',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit staged successfully');
    });

    it('should reject unit with invalid unitMetric (not in V2 picklist)', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitMetric: 'Invalid Metric',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('Unit Metric does not include a valid option');
    });

    it('should accept unit with valid V2 unitMetric', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-VALID-METRIC',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit staged successfully');
    });

    it('should reject unit with forbidden createdAt field', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt" is not allowed');
    });

    it('should reject unit with forbidden updatedAt field', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt" is not allowed');
    });

    it('should reject unit with invalid unitLink format', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitLink: 'invalid-url',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitLink');
    });

    it('should accept unit with valid unitLink format', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-VALID-LINK',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitLink: 'https://example.com/unit',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit staged successfully');
    });
  });

  describe('GET /v2/unit (List)', function () {
    it('should return empty array when no units exist', async function () {
      const response = await supertest(app)
        .get('/v2/unit')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return units from database', async function () {
      // Create a unit directly in the database
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-DB-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      }));

      const response = await supertest(app)
        .get('/v2/unit')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].unitSerialId).to.equal('TEST-UNIT-DB-001');
    });
  });

  describe('GET /v2/unit/:id (Get One)', function () {
    it('should return 404 for non-existent unit', async function () {
      const response = await supertest(app)
        .get('/v2/unit/99999')
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal('Unit not found');
    });

    it('should return unit by ID', async function () {
      // Create a unit directly in the database
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-GET-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      }));

      const response = await supertest(app)
        .get(`/v2/unit/${unit.cadTrustUnitId}`)
        .expect(200);

      expect(response.body.unitSerialId).to.equal('TEST-UNIT-GET-001');
      expect(response.body.cadTrustUnitId).to.equal(unit.cadTrustUnitId);
    });
  });

  describe('PUT /v2/unit/:id (Update)', function () {
    it('should return 404 for non-existent unit', async function () {
      const updateData = {
        unitSerialId: 'UPDATED-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .put('/v2/unit/99999')
        .send(updateData)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal('Unit not found');
    });

    it('should stage unit update', async function () {
      // Create a unit directly in the database
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-UPDATE-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      }));

      const updateData = {
        unitSerialId: 'UPDATED-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .put(`/v2/unit/${unit.cadTrustUnitId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit update staged successfully');

      // Verify the update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'unit',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
    });
  });

  describe('DELETE /v2/unit/:id (Delete)', function () {
    it('should return 404 for non-existent unit', async function () {
      const response = await supertest(app)
        .delete('/v2/unit/99999')
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.equal('Unit not found');
    });

    it('should stage unit deletion', async function () {
      // Create a unit directly in the database
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-DELETE-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      }));

      const response = await supertest(app)
        .delete(`/v2/unit/${unit.cadTrustUnitId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Unit delete staged successfully');

      // Verify the delete was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'unit',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
    });
  });
});
