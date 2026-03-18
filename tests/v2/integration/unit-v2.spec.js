import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, UnitV2, IssuanceV2, VerificationV2, MethodologyV2, ProjectMethodologyV2, ProjectV2, ValidationV2, ProgramV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import TaskManager from '../../../src/tasks/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
  createV2TestProgramChain,
} from '../utils/v2-test-helpers.js';

describe('V2 Unit API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testIssuance;
  let homeOrg;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Stop background tasks to prevent interference
    TaskManager.stopAll();

    // Create test home organization
    homeOrg = await createV2TestHomeOrg();

    // Create a test program, project, validation, verification, methodology, and issuance for foreign key validation
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Unit',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const homeOrgId = await getV2HomeOrgId();
    const testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Unit',
      projectSector: ['Agriculture'],
      cadTrustProgramId: testProgram.cadTrustProgramId,
      orgUid: homeOrgId,
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

    const testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      projectMethodologyDate: '2024-01-01',
    }));

    testIssuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
      issuanceId: 'TEST-ISSUANCE-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification.cadTrustVerificationId,
      cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
    }));
  });

  after(async function () {
    // Restart background tasks
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    TaskManager.start(configV1?.ENABLE !== false, configV2?.ENABLE !== false);
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

    const homeOrgId = await getV2HomeOrgId();
    const testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-001',
      projectName: 'Test Project for Unit',
      projectSector: ['Agriculture'],
      cadTrustProgramId: testProgram.cadTrustProgramId,
      orgUid: homeOrgId,
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

    const testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      projectMethodologyDate: '2024-01-01',
    }));

    testIssuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
      issuanceId: 'TEST-ISSUANCE-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification.cadTrustVerificationId,
      cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
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

    it('should create unit with all required data', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-MINIMAL',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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

    it('should reject unit without required unitCount', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-NOCOUNT',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitCount');
    });

    it('should reject unit without required unitType', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-NOTYPE',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitType');
    });

    it('should reject unit without required unitStatus', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-NOSTATUS',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitStatus');
    });

    it('should reject unit without required unitStatusReason', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-NOREASON',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitStatusReason');
    });

    it('should reject unit without required unitMetric', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-NOMETRIC',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('unitMetric');
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent issuance
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustIssuanceId');
      expect(response.body.error).to.include('does not exist');
      expect(response.body.error).to.include('550e8400-e29b-41d4-a716-446655440999');
    });

    it('should reject unit with invalid unitVintageYear format', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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
        unitCount: 100,
        unitType: 'Invalid Unit Type',
        unitVintageYear: 2024,
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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

    it('should reject unit with invalid unitStatus (not in V2 picklist)', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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

    it('should reject unit with invalid unitMetric (not in V2 picklist)', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
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

    it('should reject unit with forbidden orgUid field', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-ORGUID',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: 'some-org-uid',
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('orgUid');
      expect(response.body.error).to.include('automatically set');
    });

    it('should automatically set orgUid from home organization when creating unit', async function () {
      const unitData = {
        unitSerialId: 'AUTO-ORGUID-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
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

    it('should reject unit with invalid unitLink format', async function () {
      const unitData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
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
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitLink: 'https://example.com/unit',
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
  });

  describe('GET /v2/unit (List)', function () {
    it('should return empty array when no units exist', async function () {
      const response = await supertest(app)
        .get('/v2/unit')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(0);
    });

    it('should return units from database', async function () {
      // Create a unit directly in the database
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-DB-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const response = await supertest(app)
        .get('/v2/unit')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].unitSerialId).to.equal('TEST-UNIT-DB-001');
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
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-GET-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
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
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-UPDATE-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const updateData = {
        unitSerialId: 'UPDATED-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
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

      // Verify staged update data includes org_uid from home organization
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0]).to.have.property('org_uid');
      // Verify org_uid matches the actual home organization
      const actualHomeOrgId = await getV2HomeOrgId();
      expect(stagedData[0].org_uid).to.equal(actualHomeOrgId);
    });

    it('should reject unit update with forbidden orgUid field', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-UPDATE-002',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const updateData = {
        unitSerialId: 'UPDATED-UNIT-002',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: 'some-other-org-uid',
      };

      const response = await supertest(app)
        .put(`/v2/unit/${unit.cadTrustUnitId}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('orgUid');
      expect(response.body.error).to.include('automatically set');
    });

    it('should automatically set orgUid from home organization when updating unit', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-UPDATE-003',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const updateData = {
        unitSerialId: 'UPDATED-UNIT-003',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitStatusReason: 'Test reason',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
      };

      const response = await supertest(app)
        .put(`/v2/unit/${unit.cadTrustUnitId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Verify staged update data includes org_uid from home organization
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'unit',
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
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'TEST-UNIT-DELETE-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
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

  describe('Phase 21.5: Advanced Features Tests', function () {
    let testProgram;
    let testProject;
    let testValidation;
    let testVerification;
    let testMethodology;
    let testIssuanceForAdvanced;

    beforeEach(async function () {
      await resetV2StagingTable();

      // Create test data for advanced features
      testProgram = await ProgramV2.create({
        programName: 'Test Program for Advanced',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-ADV-001',
      });

      const homeOrgId = await getV2HomeOrgId();
      testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-ADV-PROJECT',
        projectName: 'Test Project for Advanced',
        projectSector: ['Agriculture'],
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-ADV-VALIDATION',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
      }));

      testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-ADV-VERIFICATION',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustValidationId: testValidation.cadTrustValidationId,
      }));

      testMethodology = await MethodologyV2.create({
        methodologyCode: 'TEST-ADV-METHODOLOGY',
        methodologyName: 'Test Methodology for Advanced',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
        cadTrustProjectId: testProject.cadTrustProjectId,
        cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      }));

      testIssuanceForAdvanced = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ADV-ISSUANCE',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      }));
    });

    describe('POST /v2/unit/split', function () {
      it('should split a unit successfully', async function () {
        // Create a unit to split
        const homeOrgId = await getV2HomeOrgId();
        const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'SPLIT-UNIT-001',
          unitStartBlock: '1000',
          unitEndBlock: '2000',
          unitCount: 100,
          unitType: 'Avoidance - nature',
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: homeOrgId,
        }));

        const splitData = {
          cadTrustUnitId: unit.cadTrustUnitId,
          records: [
            {
              unitCount: 30,
              unitBlockStart: '1000',
              unitBlockEnd: '1029',
              unitCurrentOwner: 'Owner 1',
              unitStatus: 'Issued',
            },
            {
              unitCount: 40,
              unitBlockStart: '1030',
              unitBlockEnd: '1069',
              unitCurrentOwner: 'Owner 2',
              unitStatus: 'Held',
            },
            {
              unitCount: 30,
              unitBlockStart: '1070',
              unitBlockEnd: '1099',
              unitCurrentOwner: 'Owner 3',
              unitStatus: 'Retired',
            },
          ],
        };

        const response = await supertest(app)
          .post('/v2/unit/split')
          .send(splitData)
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.equal('Unit split successful');
        expect(response.body.uuid).to.exist;

        // Verify staging record was created
        const stagingRecord = await StagingV2.findOne({
          where: {
            uuid: response.body.uuid,
            table: 'unit',
            action: 'UPDATE',
            committed: false,
          },
        });
        expect(stagingRecord).to.exist;

        // Verify split records in staging data
        const stagedData = JSON.parse(stagingRecord.data);
        expect(stagedData).to.be.an('array');
        expect(stagedData.length).to.equal(3);
        expect(stagedData[0].cadTrustUnitId).to.equal(unit.cadTrustUnitId); // First keeps original ID
        expect(stagedData[1].cadTrustUnitId).to.not.equal(unit.cadTrustUnitId); // Others get new IDs
      });

      it('should return error if cadTrustUnitId is missing', async function () {
        const response = await supertest(app)
          .post('/v2/unit/split')
          .send({
            records: [
              {
                unitCount: 50,
                unitBlockStart: '1000',
                unitBlockEnd: '1049',
              },
            ],
          })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('cadTrustUnitId is required');
      });

      it('should return error if records array is missing', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'SPLIT-UNIT-002',
          unitStartBlock: '1000',
          unitEndBlock: '2000',
          unitCount: 100,
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: homeOrgId,
        }));

        const response = await supertest(app)
          .post('/v2/unit/split')
          .send({
            cadTrustUnitId: unit.cadTrustUnitId,
          })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('records array is required');
      });

      it('should return error if split count does not match original', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'SPLIT-UNIT-003',
          unitStartBlock: '1000',
          unitEndBlock: '2000',
          unitCount: 100,
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: homeOrgId,
        }));

        const splitData = {
          cadTrustUnitId: unit.cadTrustUnitId,
          records: [
            {
              unitCount: 50,
              unitBlockStart: '1000',
              unitBlockEnd: '1049',
            },
            {
              unitCount: 40,
              unitBlockStart: '1050',
              unitBlockEnd: '1089',
            },
            // Total is 90, but original is 100 - should fail
          ],
        };

        const response = await supertest(app)
          .post('/v2/unit/split')
          .send(splitData)
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('does not match original unit count');
      });

      it('should return error if unit does not exist', async function () {
        const response = await supertest(app)
          .post('/v2/unit/split')
          .send({
            cadTrustUnitId: 'non-existent-id',
            records: [
              {
                unitCount: 50,
                unitBlockStart: '1000',
                unitBlockEnd: '1049',
              },
            ],
          })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('does not exist');
      });
    });

    describe('PUT /v2/unit/xlsx', function () {
      it('should stage INSERT for a new unit from XLSX', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const newUnitId = uuidv4();
        const testData = [
          ['cadTrustUnitId', 'unitSerialId', 'unitStartBlock', 'unitEndBlock', 'unitCount', 'unitType', 'unitVintageYear', 'unitStatus', 'cadTrustIssuanceId'],
          [newUnitId, 'XLSX-UNIT-001', '1000', '2000', '50', 'Avoidance - nature', '2024', 'Issued', testIssuanceForAdvanced.cadTrustIssuanceId],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'units', data: testData }]);

        const response = await supertest(app)
          .put('/v2/unit/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('Updates from xlsx added to staging');

        // Verify a staging record was actually created
        const stagingRecords = await StagingV2.findAll({
          where: { table: 'unit' },
        });
        expect(stagingRecords.length).to.be.at.least(1);

        const record = stagingRecords.find((r) => r.uuid === newUnitId);
        expect(record).to.exist;
        expect(record.action).to.equal('INSERT');

        const data = JSON.parse(record.data);
        expect(data[0].unitSerialId).to.equal('XLSX-UNIT-001');
      });

      it('should stage UPDATE for an existing unit from XLSX', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;

        // Create a unit to update
        const homeOrgId = await getV2HomeOrgId();
        const unit = await UnitV2.create({
          cadTrustUnitId: uuidv4(),
          orgUid: homeOrgId,
          unitSerialId: 'XLSX-UPD-001',
          unitStartBlock: '500',
          unitEndBlock: '600',
          unitCount: 25,
          unitType: 'Avoidance - nature',
          unitVintageYear: 2024,
          unitStatus: 'Held',
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
        });

        const testData = [
          ['cadTrustUnitId', 'unitSerialId', 'unitStartBlock', 'unitEndBlock', 'unitCount', 'unitType', 'unitVintageYear', 'unitStatus', 'cadTrustIssuanceId'],
          [unit.cadTrustUnitId, 'XLSX-UPD-001-UPDATED', '500', '600', '30', 'Reduction - technical', '2024', 'Issued', testIssuanceForAdvanced.cadTrustIssuanceId],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'units', data: testData }]);

        const response = await supertest(app)
          .put('/v2/unit/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;

        const stagingRecords = await StagingV2.findAll({
          where: { table: 'unit', uuid: unit.cadTrustUnitId },
        });
        expect(stagingRecords.length).to.equal(1);
        expect(stagingRecords[0].action).to.equal('UPDATE');

        const data = JSON.parse(stagingRecords[0].data);
        expect(data[0].unitSerialId).to.equal('XLSX-UPD-001-UPDATED');
      });

      it('should accept singular sheet name "unit"', async function () {
        const xlsxModule = await import('node-xlsx');
        const xlsx = xlsxModule.default || xlsxModule;
        const newUnitId = uuidv4();
        const testData = [
          ['cadTrustUnitId', 'unitSerialId', 'unitStartBlock', 'unitEndBlock', 'unitCount', 'unitVintageYear', 'cadTrustIssuanceId'],
          [newUnitId, 'SING-UNIT-001', '100', '200', '10', '2024', testIssuanceForAdvanced.cadTrustIssuanceId],
        ];
        const xlsxBuffer = xlsx.build([{ name: 'unit', data: testData }]);

        const response = await supertest(app)
          .put('/v2/unit/xlsx')
          .attach('xlsx', xlsxBuffer, 'test.xlsx')
          .expect(200);

        expect(response.body.success).to.be.true;

        const record = await StagingV2.findOne({
          where: { table: 'unit', uuid: newUnitId },
        });
        expect(record).to.exist;
        expect(record.action).to.equal('INSERT');
      });

      it('should return error if no file is provided', async function () {
        const response = await supertest(app)
          .put('/v2/unit/xlsx')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('File Not Received');
      });
    });

    describe('POST /v2/unit/batch', function () {
      it('should batch upload new units from CSV file (INSERT)', async function () {
        // Create a CSV file buffer without cadTrustUnitId to trigger INSERT
        const csvContent = `unitSerialId,unitStartBlock,unitEndBlock,unitCount,unitType,unitVintageYear,unitStatus,cadTrustIssuanceId
CSV-UNIT-001,1000,2000,50,Avoidance - nature,2024,Issued,${testIssuanceForAdvanced.cadTrustIssuanceId}
CSV-UNIT-002,2000,3000,75,Reduction - technical,2024,Held,${testIssuanceForAdvanced.cadTrustIssuanceId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/unit/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('CSV processing complete');

        // Verify records were staged
        const stagingRecords = await StagingV2.findAll({
          where: {
            table: 'unit',
            action: 'INSERT',
          },
        });

        expect(stagingRecords.length).to.be.at.least(2);
      });

      it('should batch update existing units from CSV file (UPDATE)', async function () {
        // Create units first
        const homeOrgId = await getV2HomeOrgId();
        const unit1 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'CSV-UPDATE-001',
          unitStartBlock: '1000',
          unitEndBlock: '2000',
          unitCount: 50,
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: homeOrgId,
        }));

        const unit2 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'CSV-UPDATE-002',
          unitStartBlock: '2000',
          unitEndBlock: '3000',
          unitCount: 75,
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: homeOrgId,
        }));

        // Create a CSV file buffer with cadTrustUnitId to trigger UPDATE
        const csvContent = `cadTrustUnitId,unitSerialId,unitStartBlock,unitEndBlock,unitCount,unitType,unitVintageYear,unitStatus,cadTrustIssuanceId
${unit1.cadTrustUnitId},CSV-UPDATE-001,1000,2000,60,Avoidance - nature,2024,Issued,${testIssuanceForAdvanced.cadTrustIssuanceId}
${unit2.cadTrustUnitId},CSV-UPDATE-002,2000,3000,80,Reduction - technical,2024,Held,${testIssuanceForAdvanced.cadTrustIssuanceId}`;

        const csvBuffer = Buffer.from(csvContent, 'utf8');

        const response = await supertest(app)
          .post('/v2/unit/batch')
          .attach('csv', csvBuffer, 'test.csv')
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('CSV processing complete');

        // Verify records were staged as UPDATE
        const stagingRecords = await StagingV2.findAll({
          where: {
            table: 'unit',
            action: 'UPDATE',
          },
        });

        expect(stagingRecords.length).to.be.at.least(2);
      });

      it('should return error if no CSV file is provided', async function () {
        const response = await supertest(app)
          .post('/v2/unit/batch')
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.message).to.include('Cannot find the required csv file');
      });
    });

    describe('GET /v2/unit - Advanced Query Features', function () {
      beforeEach(async function () {
        // Create multiple test units for query testing
        const homeOrgId = await getV2HomeOrgId();
        await UnitV2.bulkCreate([
          addUuidIfNeeded('UnitV2', {
            unitSerialId: 'QUERY-UNIT-001',
            unitStartBlock: '1000',
            unitEndBlock: '2000',
            unitCount: 50,
            unitType: 'Avoidance - nature',
            unitVintageYear: 2024,
            unitStatus: 'Issued',
            cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
            orgUid: homeOrgId,
          }),
          addUuidIfNeeded('UnitV2', {
            unitSerialId: 'QUERY-UNIT-002',
            unitStartBlock: '2000',
            unitEndBlock: '3000',
            unitCount: 75,
            unitType: 'Reduction - technical',
            unitVintageYear: 2023,
            unitStatus: 'Held',
            cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
            orgUid: homeOrgId,
          }),
          addUuidIfNeeded('UnitV2', {
            unitSerialId: 'QUERY-UNIT-003',
            unitStartBlock: '3000',
            unitEndBlock: '4000',
            unitCount: 100,
            unitType: 'Removal - nature',
            unitVintageYear: 2024,
            unitStatus: 'Retired',
            cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
            orgUid: homeOrgId,
          }),
        ]);
      });

      it('should filter by orgUid', async function () {
        const homeOrgId = await getV2HomeOrgId();
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ orgUid: homeOrgId, page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
        // All returned units should have the matching orgUid
        response.body.data.forEach(unit => {
          expect(unit.orgUid).to.equal(homeOrgId);
        });
      });

      it('should filter units by orgUid=me', async function () {
        const homeOrgId = await getV2HomeOrgId();
        await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'ME-UNIT-001',
          unitStartBlock: '1000',
          unitEndBlock: '2000',
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: 'test-home-org-v2',
        }));
        await UnitV2.create(addUuidIfNeeded('UnitV2', {
          unitSerialId: 'OTHER-UNIT-001',
          unitStartBlock: '2000',
          unitEndBlock: '3000',
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuanceForAdvanced.cadTrustIssuanceId,
          orgUid: 'other-org',
        }));

        const response = await supertest(app)
          .get('/v2/unit')
          .query({ orgUid: 'me', page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
        response.body.data.forEach(unit => {
          expect(unit.orgUid).to.equal('test-home-org-v2');
        });
      });

      it('should filter by single field using generic filter', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter: 'unitType:Avoidance - nature:eq', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        response.body.data.forEach(unit => {
          expect(unit.unitType).to.equal('Avoidance - nature');
        });
      });

      it('should filter by multiple values using generic filter', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter: 'unitStatus:["Issued","Held"]:in', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        response.body.data.forEach(unit => {
          expect(['Issued', 'Held']).to.include(unit.unitStatus);
        });
      });

      it('should select specific columns', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({
            columns: ['cadTrustUnitId', 'unitSerialId', 'unitType'].join(','),
            page: 1,
            limit: 10,
          })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        if (response.body.data.length > 0) {
          const unit = response.body.data[0];
          expect(unit).to.have.property('cadTrustUnitId');
          expect(unit).to.have.property('unitSerialId');
          expect(unit).to.have.property('unitType');
          // Should not have other fields (unless they're associations)
          expect(unit).to.not.have.property('unitCount');
        }
      });

      it('should sort by field in ascending order', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: 'unitSerialId:ASC', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        if (response.body.data.length > 1) {
          const serialIds = response.body.data.map(u => u.unitSerialId);
          const sortedSerialIds = [...serialIds].sort();
          expect(serialIds).to.deep.equal(sortedSerialIds);
        }
      });

      it('should sort by field in descending order', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: 'unitSerialId:DESC', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        if (response.body.data.length > 1) {
          const serialIds = response.body.data.map(u => u.unitSerialId);
          const sortedSerialIds = [...serialIds].sort().reverse();
          expect(serialIds).to.deep.equal(sortedSerialIds);
        }
      });

      it('should export to Excel format', async function () {
        // XLS export doesn't require pagination
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ xls: 'true' })
          .expect(200);

        // Excel export should return binary data
        expect(response.headers['content-disposition']).to.include('attachment');
        expect(response.headers['content-disposition']).to.include('.xlsx');
        expect(response.headers['content-type']).to.exist;
      });

      it('should combine multiple query parameters', async function () {
        const units = await UnitV2.findAll({ limit: 1 });
        const unitId = units[0].cadTrustUnitId;

        const response = await supertest(app)
          .get('/v2/unit')
          .query({
            filter: `cadTrustUnitId:${unitId}:eq`,
            columns: ['cadTrustUnitId', 'unitSerialId'].join(','),
            order: 'unitSerialId:ASC',
            page: 1,
            limit: 10,
          })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.equal(1);
        expect(response.body.data[0].cadTrustUnitId).to.equal(unitId);
        expect(response.body.data[0]).to.have.property('unitSerialId');
      });

      it('should reject invalid order column name (SQL injection prevention)', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: 'invalidColumn:ASC', page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid sort column');
        expect(response.body.error).to.include('invalidColumn');
      });

      it('should reject SQL injection attempt in order column name', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: "unitSerialId'; DROP TABLE unit; --:ASC", page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid sort column');
      });

      it('should reject invalid sort direction', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: 'unitSerialId:INVALID', page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid sort direction');
        expect(response.body.error).to.include('Must be ASC or DESC');
      });

      it('should reject filter parameter exceeding maximum length (ReDoS prevention)', async function () {
        const longFilter = 'unitSerialId:' + 'x'.repeat(10001) + ':eq';
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter: longFilter, page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Filter parameter exceeds maximum length');
      });

      it('should reject filter value exceeding maximum length (ReDoS prevention)', async function () {
        const longValue = 'x'.repeat(5001);
        const filter = `unitSerialId:${longValue}:eq`;
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter, page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Filter value exceeds maximum length');
      });

      it('should accept filter parameter at maximum allowed length', async function () {
        const maxLengthFilter = 'unitSerialId:' + 'x'.repeat(5000) + ':eq';
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter: maxLengthFilter, page: 1, limit: 10 })
          .expect(200);

        expect(response.body).to.have.property('data');
      });

      it('should reject filter parameter when it is an array (type confusion prevention)', async function () {
        await supertest(app)
          .get('/v2/unit')
          .query({ filter: ['field:value:eq', 'field2:value2:eq'], page: 1, limit: 10 })
          .expect(400);
      });

      it('should ignore filter parameter with extra characters (anchored regex validation)', async function () {
        // Anchored regex requires exact match - filter with extra characters won't match
        // This is safe behavior: invalid filters are ignored rather than causing errors
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter: 'unitSerialId:Test:eq extra', page: 1, limit: 10 })
          .expect(200);

        // The filter won't match due to anchoring, so filter is ignored
        // Response should still be valid (may return all results or empty if no units exist)
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
      });

      it('should accept valid filter parameter format (anchored regex)', async function () {
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ filter: 'unitType:Avoidance - nature:eq', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data).to.be.an('array');
        // Filter should work correctly with anchored regex
        response.body.data.forEach(unit => {
          expect(unit.unitType).to.equal('Avoidance - nature');
        });
      });

      it('should reject order parameter when it is an array (type confusion prevention)', async function () {
        await supertest(app)
          .get('/v2/unit')
          .query({ order: ['unitSerialId:ASC', 'unitSerialId:DESC'], page: 1, limit: 10 })
          .expect(400);
      });

      it('should reject order parameter exceeding maximum length (ReDoS prevention)', async function () {
        const longOrder = 'a'.repeat(201) + ':ASC'; // Exceeds 200 character limit
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: longOrder, page: 1, limit: 10 })
          .expect(400);

        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Order parameter exceeds maximum length');
      });

      it('should accept order parameter at maximum allowed length', async function () {
        const maxLengthOrder = 'a'.repeat(190) + ':ASC'; // Within 200 character limit
        const response = await supertest(app)
          .get('/v2/unit')
          .query({ order: maxLengthOrder, page: 1, limit: 10 })
          .expect(400); // Will fail validation because column name is invalid, but length check passes

        // Should fail on invalid column, not length
        expect(response.body.error).to.include('Invalid sort column');
      });
    });
  });
});
