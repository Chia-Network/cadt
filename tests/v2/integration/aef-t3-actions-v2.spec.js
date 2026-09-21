import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AefT3ActionsV2, AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2, IssuanceV2, VerificationV2, ProgramV2, MethodologyV2, ProjectMethodologyV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('AEF-T3-Actions V2 Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testAefT1SubmissionId;
  let testUnitId;
  let testProjectId;
  let testAefT2AuthorizationsId;
  let testIssuanceId;
  let testVerificationId;
  let testProgramId;
  let testMethodologyId;

  before(async function () {
    console.log('Setting up AEF-T3-Actions V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for AEF-T3',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-AEFT3-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for AEF-T3',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-AEFT3-001',
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
      methodologyName: 'Test Methodology for AEF-T3',
      methodologyCode: 'TEST-METH-AEFT3-001',
      methodologyType: 'Test methodology type',
      methodologyDescription: 'Test methodology description',
    });
    testMethodologyId = methodology.cadTrustMethodologyId;

    // Create test verification
    const verification = await VerificationV2.create({
      cadTrustVerificationId: uuidv4(),
      verificationId: 'TEST-VER-AEFT3-001',
      verificationStartDate: '2024-01-01',
      verificationEndDate: '2024-12-31',
      verificationBody: 'Test Verification Body',
      verificationStandard: 'Test Standard',
      verificationMethodology: 'Test Methodology',
      verificationScope: 'Test Scope',
      verificationDescription: 'Test verification description',
      cadTrustProjectId: testProjectId,
    });
    testVerificationId = verification.cadTrustVerificationId;

    // Create test project-methodology join record
    const projectMethodology = await ProjectMethodologyV2.create({
      cadTrustProjectMethodologyId: uuidv4(),
      cadTrustProjectId: testProjectId,
      cadTrustMethodologyId: testMethodologyId,
      projectMethodologyDate: '2024-01-01',
    });

    // Create test issuance
    const issuance = await IssuanceV2.create({
      cadTrustIssuanceId: uuidv4(),
      issuanceId: 'TEST-ISS-AEFT3-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerificationId,
      cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
    });
    testIssuanceId = issuance.cadTrustIssuanceId;

    // Create test unit
    const unit = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'TEST-UNIT-AEFT3-001',
      unitStartBlock: '1000',
      unitEndBlock: '2000',
      unitCount: 100.5,
      unitType: 'Test Unit Type',
      unitVintageYear: 2024,
      unitStatus: 'Active',
      unitStatusReason: 'Test reason',
      unitStatusDate: '2024-01-01',
      unitRetirementDetail: 'Test retirement detail',
      unitRetirementBeneficiary: 'Test beneficiary',
      unitRetirementBeneficiaryId: 'TEST-BEN-001',
      unitLink: 'https://example.com/unit',
      unitMetric: 'tCO2e',
      unitCurrentOwner: 'Test Owner',
      unitItmosReferenceId: 'TEST-ITMOS-001',
      cadTrustIssuanceId: testIssuanceId,
    });
    testUnitId = unit.cadTrustUnitId;

    // Create test AEF-T1-Submission
    const aefT1Submission = await AefT1SubmissionV2.create({
      cadTrustAefT1SubmissionId: uuidv4(),
      aefT1SubmissionParty: 'Test Party for AEF-T3',
      aefT1SubmissionVersion: '1.0',
      aefT1SubmissionReportYear: 2024,
      aefT1SubmissionSubmissionDate: '2024-01-15',
    });
    testAefT1SubmissionId = aefT1Submission.cadTrustAefT1SubmissionId;

    // Create test AEF-T2-Authorizations
    const aefT2Authorizations = await AefT2AuthorizationsV2.create({
      cadTrustAefT2AuthorizationsId: uuidv4(),
      aefT2AuthorizationsId: 'TEST-AUTH-AEFT3-001',
      aefT2AuthorizationsDate: '2024-02-01',
      aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-AEFT3-001',
      aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-AEFT3-001',
    });
    testAefT2AuthorizationsId = aefT2Authorizations.cadTrustAefT2AuthorizationsId;
  });

  after(async function () {
    console.log('AEF-T3-Actions V2 test cleanup completed');
  });

  describe('POST /v2/aef-t3-actions (Create)', function () {
    it('should create a new AEF-T3-Actions record via API', async function () {
      const aefT3ActionsData = {
        aefT3ActionsDate: '2024-01-15',
        aefT3ActionsCooperativeApproachId: 'TEST-CA-API',
        aefT3ActionsAuthorizationId: 'TEST-AUTH-API',
        aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-API',
        aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-API',
        aefT3ActionsItmoFirstId: 'ITMO-API-001',
        aefT3ActionsItmoLastId: 'ITMO-API-100',
        aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-API',
        aefT3ActionsUnitFirstId: 'UNIT-API-001',
        aefT3ActionsUnitLastId: 'UNIT-API-100',
        aefT3ActionsQuantityTCo2: 1000.0,
        aefT3ActionsVintageYear: 2024,
        aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-API',
        aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-API',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t3-actions')
        .send(aefT3ActionsData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T3-Actions staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustAefT3ActionsId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      expect(response.body).to.have.property('uuid');
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('aef_t3_actions');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_aef_t1_submission_id).to.equal(testAefT1SubmissionId);
      expect(stagedData[0].cad_trust_unit_id).to.equal(testUnitId);
      expect(stagedData[0].cad_trust_project_id).to.equal(testProjectId);
      expect(stagedData[0].cad_trust_aef_t3_actions_id).to.equal(response.body.cadTrustAefT3ActionsId);
    });

    it('should reject AEF-T3-Actions with invalid foreign key (non-existent)', async function () {
      const aefT3ActionsData = {
        aefT3ActionsDate: '2024-01-15',
        aefT3ActionsCooperativeApproachId: 'TEST-CA-FK',
        aefT3ActionsAuthorizationId: 'TEST-AUTH-FK',
        aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-FK',
        aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-FK',
        aefT3ActionsItmoFirstId: 'ITMO-FK-001',
        aefT3ActionsItmoLastId: 'ITMO-FK-100',
        aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-FK',
        aefT3ActionsUnitFirstId: 'UNIT-FK-001',
        aefT3ActionsUnitLastId: 'UNIT-FK-100',
        aefT3ActionsQuantityTCo2: 1000.0,
        aefT3ActionsVintageYear: 2024,
        aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-FK',
        aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-FK',
        cadTrustAefT1SubmissionId: '550e8400-e29b-41d4-a716-446655440999',
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t3-actions')
        .send(aefT3ActionsData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustAefT1SubmissionId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject AEF-T3-Actions with forbidden fields', async function () {
      const aefT3ActionsData = {
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustAefT3ActionsId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/aef-t3-actions')
        .send(aefT3ActionsData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('PUT /v2/aef-t3-actions/:id (Update)', function () {
    let createdAefT3ActionsId;

    before(async function () {
      const aefT3ActionsData = {
        aefT3ActionsDate: '2024-01-15',
        aefT3ActionsCooperativeApproachId: 'TEST-CA-UPDATE',
        aefT3ActionsAuthorizationId: 'TEST-AUTH-UPDATE',
        aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-UPDATE',
        aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-UPDATE',
        aefT3ActionsItmoFirstId: 'ITMO-UPDATE-001',
        aefT3ActionsItmoLastId: 'ITMO-UPDATE-100',
        aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-UPDATE',
        aefT3ActionsUnitFirstId: 'UNIT-UPDATE-001',
        aefT3ActionsUnitLastId: 'UNIT-UPDATE-100',
        aefT3ActionsQuantityTCo2: 1000.0,
        aefT3ActionsVintageYear: 2024,
        aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-UPDATE',
        aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-UPDATE',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t3-actions')
        .send(aefT3ActionsData);

      createdAefT3ActionsId = response.body.cadTrustAefT3ActionsId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await AefT3ActionsV2.create({
          cadTrustAefT3ActionsId: createdAefT3ActionsId,
          aefT3ActionsDate: '2024-01-15',
          aefT3ActionsCooperativeApproachId: 'TEST-CA-UPDATE',
          aefT3ActionsAuthorizationId: 'TEST-AUTH-UPDATE',
          aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-UPDATE',
          aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-UPDATE',
          aefT3ActionsItmoFirstId: 'ITMO-UPDATE-001',
          aefT3ActionsItmoLastId: 'ITMO-UPDATE-100',
          aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-UPDATE',
          aefT3ActionsUnitFirstId: 'UNIT-UPDATE-001',
          aefT3ActionsUnitLastId: 'UNIT-UPDATE-100',
          aefT3ActionsQuantityTCo2: 1000.0,
          aefT3ActionsVintageYear: 2024,
          aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-UPDATE',
          aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-UPDATE',
          cadTrustAefT1SubmissionId: testAefT1SubmissionId,
          cadTrustUnitId: testUnitId,
          cadTrustProjectId: testProjectId,
          cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
       }
    });    it('should update an AEF-T3-Actions via API', async function () {
      const updateData = {
        aefT3ActionsDate: '2024-12-31',
        aefT3ActionsCooperativeApproachId: 'TEST-CA-UPDATE',
        aefT3ActionsAuthorizationId: 'TEST-AUTH-UPDATE',
        aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-UPDATE',
        aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-UPDATE',
        aefT3ActionsItmoFirstId: 'ITMO-UPDATE-001',
        aefT3ActionsItmoLastId: 'ITMO-UPDATE-100',
        aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-UPDATE',
        aefT3ActionsUnitFirstId: 'UNIT-UPDATE-001',
        aefT3ActionsUnitLastId: 'UNIT-UPDATE-100',
        aefT3ActionsQuantityTCo2: 2000.0,
        aefT3ActionsVintageYear: 2024,
        aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-UPDATE',
        aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-UPDATE',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
      };

      const response = await supertest(app)
        .put(`/v2/aef-t3-actions/${createdAefT3ActionsId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T3-Actions update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/aef-t3-actions/:id (Delete)', function () {
    let createdAefT3ActionsId;

    before(async function () {
      const aefT3ActionsData = {
        aefT3ActionsDate: '2024-01-15',
        aefT3ActionsCooperativeApproachId: 'TEST-CA-DELETE',
        aefT3ActionsAuthorizationId: 'TEST-AUTH-DELETE',
        aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-DELETE',
        aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-DELETE',
        aefT3ActionsItmoFirstId: 'ITMO-DELETE-001',
        aefT3ActionsItmoLastId: 'ITMO-DELETE-100',
        aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-DELETE',
        aefT3ActionsUnitFirstId: 'UNIT-DELETE-001',
        aefT3ActionsUnitLastId: 'UNIT-DELETE-100',
        aefT3ActionsQuantityTCo2: 1000.0,
        aefT3ActionsVintageYear: 2024,
        aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-DELETE',
        aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-DELETE',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t3-actions')
        .send(aefT3ActionsData);

      createdAefT3ActionsId = response.body.cadTrustAefT3ActionsId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await AefT3ActionsV2.create({
          cadTrustAefT3ActionsId: createdAefT3ActionsId,
          aefT3ActionsDate: '2024-01-15',
          aefT3ActionsCooperativeApproachId: 'TEST-CA-DELETE',
          aefT3ActionsAuthorizationId: 'TEST-AUTH-DELETE',
          aefT3ActionsFirstTransferringPartyId: 'TEST-PARTY-DELETE',
          aefT3ActionsPartyItmoRegistryId: 'TEST-REGISTRY-DELETE',
          aefT3ActionsItmoFirstId: 'ITMO-DELETE-001',
          aefT3ActionsItmoLastId: 'ITMO-DELETE-100',
          aefT3ActionsUnitRegistryId: 'UNIT-REGISTRY-DELETE',
          aefT3ActionsUnitFirstId: 'UNIT-DELETE-001',
          aefT3ActionsUnitLastId: 'UNIT-DELETE-100',
          aefT3ActionsQuantityTCo2: 1000.0,
          aefT3ActionsVintageYear: 2024,
          aefT3ActionsTransferringPartyId: 'TRANSFER-PARTY-DELETE',
          aefT3ActionsAcquiringPartyId: 'ACQUIRE-PARTY-DELETE',
          cadTrustAefT1SubmissionId: testAefT1SubmissionId,
          cadTrustUnitId: testUnitId,
          cadTrustProjectId: testProjectId,
          cadTrustAefT2AuthorizationsId: testAefT2AuthorizationsId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
       }
    });it('should delete an AEF-T3-Actions via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/aef-t3-actions/${createdAefT3ActionsId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T3-Actions delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
