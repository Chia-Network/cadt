import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, IssuanceV2, VerificationV2, MethodologyV2, ProjectMethodologyV2, ProjectV2, ValidationV2, ProgramV2, UnitV2, UnitLabelV2, LabelV2 } from '../../../src/models/v2/index.js';
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

describe('V2 Issuance API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testVerification;
  let testProjectMethodology;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create a test program, project, validation, verification, methodology, and project_methodology for foreign key validation
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
      projectSector: ['Agriculture'],
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

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHOD-001',
      methodologyName: 'Test Methodology for Issuance',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      projectMethodologyDate: '2024-01-01',
      projectMethodologyDescription: 'Test project methodology for issuance tests',
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
      projectSector: ['Agriculture'],
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

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHODOLOGY-001',
      methodologyName: 'Test Methodology for Issuance',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      projectMethodologyDate: '2024-01-01',
      projectMethodologyDescription: 'Test project methodology for issuance tests',
    }));
  });

  runCrudStagingSuite({
    resource: 'issuance',
    label: 'Issuance',
    pk: 'cadTrustIssuanceId',
    pkColumn: 'cad_trust_issuance_id',
    missingId: '999999',
    requiredFields: ['issuanceId', 'cadTrustVerificationId', 'cadTrustProjectMethodologyId'],
    context: () => ({ testVerification, testProjectMethodology }),
    validPayload: (ctx) => ({
      issuanceId: 'TEST-ISSUANCE-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: ctx.testVerification.cadTrustVerificationId,
      cadTrustProjectMethodologyId: ctx.testProjectMethodology.cadTrustProjectMethodologyId,
    }),
    expectStagedInsert: (staged, ctx) => {
      expect(staged.issuance_id).to.equal('TEST-ISSUANCE-001');
      expect(staged.issuance_date).to.equal('2024-01-01');
      expect(staged.cad_trust_verification_id).to.equal(ctx.testVerification.cadTrustVerificationId);
      expect(staged.cad_trust_project_methodology_id).to.equal(ctx.testProjectMethodology.cadTrustProjectMethodologyId);
    },
  });

  describe('POST /v2/issuance (Create)', function () {
    it('should create issuance with minimal required data', async function () {
      const minimalData = {
        issuanceId: 'MIN-ISSUANCE-001',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    it('should reject issuance with invalid issuanceDate format', async function () {
      const invalidData = {
        issuanceId: 'INVALID-DATE',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
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
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustVerificationId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept issuance with valid cadTrustVerificationId', async function () {
      const validData = {
        issuanceId: 'VALID-VERIFICATION-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should reject issuance with invalid cadTrustProjectMethodologyId', async function () {
      const invalidData = {
        issuanceId: 'INVALID-PROJECT-METHODOLOGY-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: '550e8400-e29b-41d4-a716-446655440999', // Valid UUID format but non-existent
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectMethodologyId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should accept issuance with valid cadTrustProjectMethodologyId', async function () {
      const validData = {
        issuanceId: 'VALID-PROJECT-METHODOLOGY-FK',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      };

      const response = await supertest(app)
        .post('/v2/issuance')
        .send(validData)
        .expect(200);

      expect(response.body.success).to.be.true;
    });

  });

  describe('DELETE /v2/issuance/:id (Delete)', function () {
    it('should stage issuance deletion with no children', async function () {
      await waitForV2DataLayerSync();
      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'ISS-DELETE-001',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      }));

      const response = await supertest(app)
        .delete(`/v2/issuance/${issuance.cadTrustIssuanceId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Issuance delete staged successfully');
      expect(response.body.stagedChildDeletes).to.equal(0);

      const deleteRows = await StagingV2.findAll({ where: { action: 'DELETE' } });
      expect(deleteRows).to.have.lengthOf(1);
      expect(deleteRows[0].table).to.equal('issuance');
    });

    it('should cascade-stage unit and unit_label deletes when deleting an issuance', async function () {
      await waitForV2DataLayerSync();
      const homeOrgId = await getV2HomeOrgId();

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'ISS-CASCADE-001',
        issuanceDate: '2024-03-01',
        cadTrustVerificationId: testVerification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
      }));

      const unit1 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'ISS-CASCADE-UNIT-001',
        unitStartBlock: '100',
        unitEndBlock: '200',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const unit2 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'ISS-CASCADE-UNIT-002',
        unitStartBlock: '201',
        unitEndBlock: '300',
        unitCount: 100,
        unitType: 'Avoidance - nature',
        unitVintageYear: 2024,
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Issuance Cascade Label',
      });

      const unitLabel1 = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: unit1.cadTrustUnitId,
        cadTrustLabelId: label.cadTrustLabelId,
      });

      const unitLabel2 = await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: unit2.cadTrustUnitId,
        cadTrustLabelId: label.cadTrustLabelId,
      });

      const response = await supertest(app)
        .delete(`/v2/issuance/${issuance.cadTrustIssuanceId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.stagedChildDeletes).to.equal(4);

      const deleteRows = await StagingV2.findAll({
        where: { action: 'DELETE' },
        raw: true,
      });

      const expectedDeletes = [
        ['issuance', 'cad_trust_issuance_id', issuance.cadTrustIssuanceId],
        ['unit', 'cad_trust_unit_id', unit1.cadTrustUnitId],
        ['unit', 'cad_trust_unit_id', unit2.cadTrustUnitId],
        ['unit_label', 'cad_trust_unit_label_id', unitLabel1.cadTrustUnitLabelId],
        ['unit_label', 'cad_trust_unit_label_id', unitLabel2.cadTrustUnitLabelId],
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
